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
from schemas.amazon import AMAZON_SCHEMA
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
        """Detect the domain category from a URL."""
        hostname = urlparse(url).hostname or ""
        hostname = hostname.lower()

        if "amazon" in hostname:
            return "amazon"
        elif "flipkart" in hostname:
            return "flipkart"
        else:
            return "generic"

    def _get_extraction_strategy(self, domain: str) -> Optional[JsonCssExtractionStrategy]:
        """Return the appropriate extraction schema for the domain."""
        schemas = {
            "amazon": AMAZON_SCHEMA,
            "flipkart": FLIPKART_SCHEMA,
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
                raise RuntimeError("Crawler not initialized. Call start() first.")

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

            # Execute the crawl
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
            products = self._normalize_products(products, domain)

            # Extract metadata from HTML
            metadata = self._extract_metadata(result)

            return {
                "url": url,
                "domain": domain,
                "title": result.metadata.get("title", "") if result.metadata else "",
                "html_length": len(result.html or ""),
                "products": products,
                "links": self._extract_links(result),
                "images": self._extract_images(result),
                "metadata": metadata,
                "raw_markdown": (result.markdown or "")[:5000],  # First 5K chars
            }

    def _normalize_products(self, products: list, domain: str) -> list:
        """Clean and normalize extracted product data."""
        normalized = []

        for p in products:
            if not isinstance(p, dict):
                continue

            product = {
                "title": self._clean_text(p.get("title", "")),
                "price": self._parse_price(p.get("price", "")),
                "rating": self._parse_rating(p.get("rating", "")),
                "reviews": self._clean_text(p.get("reviews", "")),
                "brand": self._clean_text(p.get("brand", "")),
                "url": p.get("link", p.get("url", "")),
                "image_url": p.get("image", p.get("image_url", "")),
                "asin": p.get("asin", ""),
            }

            # Skip empty products
            if product["title"] or product["price"]:
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
                "title": result.metadata.get("title", ""),
                "description": result.metadata.get("description", ""),
                "keywords": result.metadata.get("keywords", ""),
                "author": result.metadata.get("author", ""),
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
