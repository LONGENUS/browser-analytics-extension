"""
WebIntel — Crawl4AI Crawler Service
Wraps AsyncWebCrawler with domain-specific extraction strategies.
"""

import asyncio
import json
import re
from typing import Optional
from urllib.parse import urlparse

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
    JsonCssExtractionStrategy,
)

from config import settings
from schemas.amazon import AMAZON_SCHEMA, AMAZON_PRODUCT_DETAIL_SCHEMA
from schemas.flipkart import FLIPKART_SCHEMA
from schemas.generic import GENERIC_SCHEMA


class CrawlService:
    """
    Manages the Crawl4AI browser lifecycle and provides
    domain-aware crawling with structured extraction.
    """

    def __init__(self):
        self._crawler: Optional[AsyncWebCrawler] = None
        self._semaphore = asyncio.Semaphore(settings.CRAWL_MAX_CONCURRENT)
        self._browser_config = BrowserConfig(
            headless=settings.CRAWL_HEADLESS,
            viewport_width=settings.CRAWL_VIEWPORT_WIDTH,
            viewport_height=settings.CRAWL_VIEWPORT_HEIGHT,
        )

    async def start(self):
        """Initialize the browser."""
        self._crawler = AsyncWebCrawler(config=self._browser_config)
        await self._crawler.__aenter__()
        print("[CRAWL] Crawl4AI browser initialized")

    async def stop(self):
        """Shut down the browser."""
        if self._crawler:
            await self._crawler.__aexit__(None, None, None)
            print("[CRAWL] Crawl4AI browser closed")

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

    def _get_extraction_strategy(self, domain: str) -> Optional[JsonCssExtractionStrategy]:
        """Return the appropriate extraction schema for the domain."""
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

        Returns:
            {
                "url": str,
                "domain": str,
                "title": str,
                "html_length": int,
                "products": list[dict],
                "links": list[str],
                "images": list[str],
                "metadata": dict,
                "raw_markdown": str
            }
        """
        async with self._semaphore:
            if not self._crawler:
                await self.start()

            domain = self._detect_domain(url)
            extraction_strategy = self._get_extraction_strategy(domain)

            # Configure the crawl run
            run_config = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                extraction_strategy=extraction_strategy,
                wait_until="domcontentloaded",  # Don't wait for networkidle (Amazon never reaches it)
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
                result = await self._crawler.arun(url=url, config=run_config)

            if not result.success:
                raise RuntimeError(
                    f"Crawl failed for {url}: {result.error_message or 'Unknown error'}"
                )

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
            if domain == "amazon_product" and not products:
                raw_title = (result.metadata.get("title") or "") if result.metadata else ""
                clean_title = re.sub(r'\s*:\s*Amazon\.[a-z.]+(?::.*)?$', '', raw_title, flags=re.IGNORECASE).strip()
                if clean_title:
                    asin_match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{10})', url)
                    asin = asin_match.group(1) if asin_match else ""
                    # Look for price in html
                    price = None
                    price_match = re.search(r'class="a-price-whole"[^>]*>([0-9,]+)', result.html or "")
                    if price_match:
                        try:
                            price = float(price_match.group(1).replace(',', ''))
                        except ValueError:
                            pass
                    products.append({
                        "title": clean_title,
                        "price": price,
                        "rating": None,
                        "reviews": "",
                        "brand": "",
                        "url": url,
                        "image_url": "",
                        "asin": asin,
                    })

            # Extract metadata from HTML
            metadata = self._extract_metadata(result)

            return {
                "url": url,
                "domain": domain,
                "title": (result.metadata.get("title") or "") if result.metadata else "",
                "html_length": len(result.html or ""),
                "products": products,
                "links": self._extract_links(result),
                "images": self._extract_images(result),
                "metadata": metadata,
                "raw_markdown": (result.markdown or "")[:5000],  # First 5K chars
            }

    def _normalize_products(self, products: list, domain: str, page_url: str = "") -> list:
        """Clean and normalize extracted product data."""
        normalized = []

        for p in products:
            if not isinstance(p, dict):
                continue

            title = self._clean_text(p.get("title", ""))
            # Require minimum title length to eliminate empty container matches
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

        # Remove currency symbols and commas
        cleaned = re.sub(r'[₹$€£¥,\s]', '', str(price_str))
        # Extract the first number
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
        if result.metadata:
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
        if result.links:
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
        if result.media and isinstance(result.media, dict):
            img_list = result.media.get("images", [])
            for img in img_list[:50]:
                if isinstance(img, dict):
                    images.append(img.get("src", ""))
                elif isinstance(img, str):
                    images.append(img)
        return [i for i in images if i]
