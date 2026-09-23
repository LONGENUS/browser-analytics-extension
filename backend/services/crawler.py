"""
WebIntel — Crawl4AI & Hybrid HTTP Crawler Service
Wraps AsyncWebCrawler with domain-specific extraction strategies,
with graceful HTTP fallback for serverless environments (Vercel).
"""

import asyncio
import json
import re
from typing import Optional, Any
from urllib.parse import urlparse

try:
    from crawl4ai import (
        AsyncWebCrawler,
        BrowserConfig,
        CrawlerRunConfig,
        CacheMode,
        JsonCssExtractionStrategy,
    )
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False
    AsyncWebCrawler = None
    BrowserConfig = None
    CrawlerRunConfig = None
    CacheMode = None
    JsonCssExtractionStrategy = None

from config import settings
from schemas.amazon import AMAZON_SCHEMA, AMAZON_PRODUCT_DETAIL_SCHEMA
from schemas.flipkart import FLIPKART_SCHEMA
from schemas.generic import GENERIC_SCHEMA


class CrawlService:
    """
    Manages the Crawl4AI browser lifecycle when available,
    and provides a lightweight HTTP fallback in serverless environments.
    """

    def __init__(self):
        self._crawler: Optional[Any] = None
        self._semaphore = asyncio.Semaphore(settings.CRAWL_MAX_CONCURRENT)
        if CRAWL4AI_AVAILABLE and BrowserConfig:
            self._browser_config = BrowserConfig(
                headless=settings.CRAWL_HEADLESS,
                viewport_width=settings.CRAWL_VIEWPORT_WIDTH,
                viewport_height=settings.CRAWL_VIEWPORT_HEIGHT,
            )
        else:
            self._browser_config = None

    async def start(self):
        """Initialize the browser if Crawl4AI is available."""
        if not CRAWL4AI_AVAILABLE or not AsyncWebCrawler or not self._browser_config:
            print("[CRAWL] Crawl4AI not available; running in lightweight HTTP crawler mode")
            self._crawler = None
            return
        try:
            self._crawler = AsyncWebCrawler(config=self._browser_config)
            await self._crawler.__aenter__()
            print("[CRAWL] Crawl4AI browser initialized")
        except Exception as e:
            print(f"[CRAWL] Browser start skipped ({e}); falling back to HTTP crawler")
            self._crawler = None

    async def stop(self):
        """Shut down the browser."""
        if self._crawler:
            try:
                await self._crawler.__aexit__(None, None, None)
            except Exception:
                pass
            print("[CRAWL] Crawl4AI browser closed")
            self._crawler = None

    def _detect_domain(self, url: str) -> str:
        """Detect the domain category and page type from a URL."""
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        path = parsed.path

        if "amazon" in hostname:
            if "/dp/" in path or "/gp/product/" in path or re.search(r'/[A-Z0-9]{10}(?:[/?]|$)', path):
                return "amazon_product"
            return "amazon"
        elif "flipkart" in hostname:
            if "/p/" in path:
                return "flipkart_product"
            return "flipkart"
        else:
            return "generic"

    def _get_extraction_strategy(self, domain: str) -> Optional[Any]:
        """Return the appropriate extraction schema for the domain."""
        if not CRAWL4AI_AVAILABLE or not JsonCssExtractionStrategy:
            return None
        schemas = {
            "amazon": AMAZON_SCHEMA,
            "amazon_product": AMAZON_PRODUCT_DETAIL_SCHEMA,
            "flipkart": FLIPKART_SCHEMA,
            "flipkart_product": FLIPKART_SCHEMA,
            "generic": GENERIC_SCHEMA,
        }

        schema = schemas.get(domain)
        if schema:
            return JsonCssExtractionStrategy(schema, verbose=False)
        return None

    async def crawl_url(self, url: str) -> dict:
        """
        Crawl a URL and extract structured data.
        Uses Crawl4AI if available, or falls back to fast HTTP crawling.
        """
        async with self._semaphore:
            if not self._crawler and CRAWL4AI_AVAILABLE:
                await self.start()

            # If crawler is not available (e.g. serverless Vercel or browser start skipped)
            if not self._crawler:
                return await self._crawl_http_fallback(url)

            domain = self._detect_domain(url)
            extraction_strategy = self._get_extraction_strategy(domain)

            # Configure the crawl run
            run_config = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                extraction_strategy=extraction_strategy,
                wait_until="domcontentloaded",  # Don't wait for networkidle
                page_timeout=60000,  # 60 seconds
                scan_full_page=False,  # Avoid extra scroll delays on detail pages
            )

            # Execute the crawl (with automatic browser reconnect if connection dropped)
            try:
                result = await self._crawler.arun(url=url, config=run_config)
            except Exception as crawl_err:
                print(f"[WARN] Crawl error encountered ({crawl_err}). Reconnecting browser instance...")
                try:
                    await self.stop()
                except Exception:
                    pass
                await self.start()
                if self._crawler:
                    result = await self._crawler.arun(url=url, config=run_config)
                else:
                    return await self._crawl_http_fallback(url)

            if not result.success:
                print(f"[WARN] Crawl4AI unsuccesful ({result.error_message}); falling back to HTTP crawler")
                return await self._crawl_http_fallback(url)

            # Parse extracted content
            products = []
            if result.extracted_content:
                try:
                    products = json.loads(result.extracted_content)
                    if isinstance(products, dict):
                        products = products.get("items", [products])
                    elif not isinstance(products, list):
                        products = []
                except (json.JSONDecodeError, TypeError):
                    products = []

            # Clean and normalize products
            products = self._normalize_products(products, domain, url)

            # Fallback for Amazon product detail pages if schema didn't catch fields
            if domain == "amazon_product" and result.html:
                products = self._fallback_amazon_detail(result.html, products, url)

            # Extract page title
            title = ""
            if result.metadata and result.metadata.get("title"):
                title = result.metadata["title"].strip()
            elif products and products[0].get("title"):
                title = products[0]["title"]
            else:
                title = urlparse(url).netloc

            return {
                "url": url,
                "domain": domain,
                "title": title,
                "html_length": len(result.html) if result.html else 0,
                "products": products,
                "links": self._extract_links(result),
                "images": self._extract_images(result),
                "metadata": self._extract_metadata(result),
                "raw_markdown": result.markdown[:5000] if result.markdown else "",
                "html": result.html if result.html else "",
            }

    async def _crawl_http_fallback(self, url: str) -> dict:
        """
        Lightweight HTTP fallback for serverless environments (Vercel) without Playwright.
        Uses httpx and BeautifulSoup for zero-binary, low-latency extraction.
        """
        import httpx
        from bs4 import BeautifulSoup

        domain = self._detect_domain(url)
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            html = resp.text

        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else urlparse(url).netloc

        # Meta tags
        meta_desc = ""
        desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        if desc_tag and desc_tag.get("content"):
            meta_desc = desc_tag["content"].strip()

        # Links
        links = []
        for a in soup.find_all("a", href=True)[:100]:
            href = a["href"]
            if href.startswith("/"):
                parsed = urlparse(url)
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
            if href.startswith("http"):
                links.append(href)

        # Images
        images = []
        for img in soup.find_all("img", src=True)[:50]:
            src = img["src"]
            if src.startswith("http"):
                images.append(src)

        # Basic product extraction heuristic
        raw_products = []
        if "amazon" in domain:
            title_tag = soup.find(id="productTitle")
            if title_tag:
                price_tag = soup.find("span", class_="a-price-whole")
                raw_products.append({
                    "title": title_tag.get_text(strip=True),
                    "price": price_tag.get_text(strip=True) if price_tag else "",
                    "url": url,
                    "image": images[0] if images else "",
                })
            else:
                items = soup.find_all("div", attrs={"data-component-type": "s-search-result"})[:20]
                for item in items:
                    h2 = item.find("h2")
                    p_title = h2.get_text(strip=True) if h2 else ""
                    p_price = ""
                    price_el = item.find("span", class_="a-price-whole")
                    if price_el:
                        p_price = price_el.get_text(strip=True)
                    if p_title:
                        raw_products.append({"title": p_title, "price": p_price, "url": url})
        elif "flipkart" in domain:
            for item in soup.find_all("div", class_="_1AtVbE")[:15]:
                title_el = item.find("div", class_="_4rR01T") or item.find("a", class_="s1Q9rs")
                price_el = item.find("div", class_="_30jeq3")
                if title_el:
                    raw_products.append({
                        "title": title_el.get_text(strip=True),
                        "price": price_el.get_text(strip=True) if price_el else "",
                        "url": url,
                    })

        products = self._normalize_products(raw_products, domain, url)

        return {
            "url": url,
            "domain": domain,
            "title": title,
            "html_length": len(html),
            "products": products,
            "links": links,
            "images": images,
            "metadata": {
                "title": title,
                "description": meta_desc,
                "keywords": "",
                "author": "",
            },
            "raw_markdown": f"# {title}\n\n{meta_desc}",
            "html": html,
        }

    def _fallback_amazon_detail(self, html: str, products: list[dict], url: str) -> list[dict]:
        """Regex fallback to extract price, title, rating from Amazon detail page HTML."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        product = products[0] if products else {
            "title": None, "price": None, "rating": None,
            "reviews": None, "brand": None, "url": url,
            "image_url": None, "asin": None,
        }

        # Title
        if not product.get("title"):
            title_el = soup.find(id="productTitle")
            if title_el:
                product["title"] = self._clean_text(title_el.get_text())

        # Price
        if not product.get("price"):
            price_el = soup.find("span", class_="a-price-whole")
            if price_el:
                product["price"] = self._parse_price(price_el.get_text())

        # Rating
        if not product.get("rating"):
            rating_el = soup.find("span", class_="a-icon-alt")
            if rating_el:
                product["rating"] = self._parse_rating(rating_el.get_text())

        # Brand
        if not product.get("brand"):
            brand_el = soup.find(id="bylineInfo")
            if brand_el:
                product["brand"] = self._clean_text(
                    re.sub(r'^(?:Brand:|Visit the)\s*', '', brand_el.get_text())
                )

        # ASIN from URL
        if not product.get("asin"):
            asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url)
            if asin_match:
                product["asin"] = asin_match.group(1)

        product["url"] = url
        return [product]

    def _normalize_products(self, raw_products: list, domain: str, page_url: str = "") -> list[dict]:
        """Normalize raw extracted products into consistent format."""
        normalized = []
        for p in raw_products:
            if not isinstance(p, dict):
                continue

            title = self._clean_text(p.get("title", ""))
            if not title or len(title) < 2:
                continue

            product_url = p.get("link", p.get("url", ""))
            asin = p.get("asin", "")

            # Fix relative URLs
            if product_url and not product_url.startswith("http"):
                if page_url:
                    parsed_base = urlparse(page_url)
                    prefix = "" if product_url.startswith("/") else "/"
                    product_url = f"{parsed_base.scheme}://{parsed_base.netloc}{prefix}{product_url}"

            # Extract ASIN from URL if missing and domain is Amazon
            if not asin and "amazon" in domain:
                target_url = product_url or page_url
                asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', target_url)
                if asin_match:
                    asin = asin_match.group(1)

            if not product_url and "amazon" in domain and asin and page_url:
                parsed_base = urlparse(page_url)
                product_url = f"{parsed_base.scheme}://{parsed_base.netloc}/dp/{asin}"

            product = {
                "title": title,
                "price": self._parse_price(p.get("price", "")),
                "rating": self._parse_rating(p.get("rating", "")),
                "reviews": self._clean_text(p.get("reviews", "")),
                "brand": self._clean_text(p.get("brand", "")),
                "url": product_url or page_url,
                "image_url": p.get("image", p.get("image_url", "")),
                "asin": asin,
            }

            normalized.append(product)

        return normalized

    def _parse_price(self, price_str) -> Optional[float]:
        """Extract numeric price from string like '₹2,140' or '$29.99'."""
        if isinstance(price_str, (int, float)):
            return float(price_str)
        if not price_str:
            return None

        cleaned = re.sub(r'[₹$€£¥,\s]', '', str(price_str))
        match = re.search(r'(\d+\.?\d*)', cleaned)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return None

    def _parse_rating(self, rating_str) -> Optional[float]:
        """Extract numeric rating from string like '4.5 out of 5'."""
        if isinstance(rating_str, (int, float)):
            return float(rating_str)
        if not rating_str:
            return None

        match = re.search(r'(\d+\.?\d*)', str(rating_str))
        if match:
            try:
                val = float(match.group(1))
                return val if val <= 5 else None
            except ValueError:
                pass
        return None

    def _clean_text(self, text) -> str:
        """Clean extracted text."""
        if not text:
            return ""
        return re.sub(r'\s+', ' ', str(text)).strip()

    def _extract_metadata(self, result) -> dict:
        """Extract page metadata from crawl result."""
        metadata = {}
        if hasattr(result, "metadata") and result.metadata:
            metadata = {
                "title": (result.metadata.get("title") or "").strip(),
                "description": (result.metadata.get("description") or "").strip(),
                "keywords": (result.metadata.get("keywords") or "").strip(),
                "author": (result.metadata.get("author") or "").strip(),
            }
        return metadata

    def _extract_links(self, result) -> list:
        """Extract links from crawl result."""
        links = []
        if hasattr(result, "links") and result.links:
            if isinstance(result.links, dict):
                for link_type, link_list in result.links.items():
                    if isinstance(link_list, list):
                        for link in link_list[:100]:
                            if isinstance(link, dict):
                                links.append(link.get("href", ""))
                            elif isinstance(link, str):
                                links.append(link)
            elif isinstance(result.links, list):
                for link in result.links[:100]:
                    if isinstance(link, dict):
                        links.append(link.get("href", ""))
                    elif isinstance(link, str):
                        links.append(link)
        return [l for l in links if l]

    def _extract_images(self, result) -> list:
        """Extract image URLs from crawl result."""
        images = []
        if hasattr(result, "media") and result.media and isinstance(result.media, dict):
            img_list = result.media.get("images", [])
            for img in img_list[:50]:
                if isinstance(img, dict):
                    images.append(img.get("src", ""))
                elif isinstance(img, str):
                    images.append(img)
        return [i for i in images if i]
