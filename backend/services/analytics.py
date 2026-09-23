"""
WebIntel — Analytics Engine
Computes product, price, brand, rating, and SEO metrics from extracted data.
"""

import re
from collections import Counter
from typing import Optional
from statistics import mean, median, stdev


class AnalyticsService:
    """Computes structured analytics from extracted product and page data."""

    def compute(self, crawl_result: dict) -> dict:
        """
        Main entry point. Takes raw crawl result and returns analytics dict.

        Args:
            crawl_result: Output from CrawlService.crawl_url()

        Returns:
            {
                "analytics": { product/price/brand/rating metrics },
                "seo": { SEO audit data }
            }
        """
        products = crawl_result.get("products", [])
        links = crawl_result.get("links", [])
        images = crawl_result.get("images", [])
        metadata = crawl_result.get("metadata", {})
        domain = crawl_result.get("domain", "")
        url = crawl_result.get("url", "")

        return {
            "analytics": self._compute_product_analytics(products),
            "seo": self._compute_seo(metadata, links, images, url),
        }

    # --- Product Analytics ---

    def _compute_product_analytics(self, products: list) -> dict:
        """Compute product-level metrics."""
        if not products:
            return {
                "total_products": 0,
                "unique_products": 0,
                "duplicates": 0,
                "avg_price": None,
                "median_price": None,
                "min_price": None,
                "max_price": None,
                "std_price": None,
                "price_distribution": [],
                "avg_rating": None,
                "rating_distribution": {},
                "unique_brands": 0,
                "top_brands": [],
                "products_with_price": 0,
                "products_with_rating": 0,
                "products_with_brand": 0,
            }

        # Deduplicate by URL
        seen_urls = set()
        unique_products = []
        for p in products:
            url_key = p.get("url", "") or p.get("title", "")
            if url_key and url_key not in seen_urls:
                seen_urls.add(url_key)
                unique_products.append(p)
            elif not url_key:
                unique_products.append(p)

        # Price analytics
        prices = [p["price"] for p in unique_products if p.get("price") and p["price"] > 0]
        price_stats = self._compute_price_stats(prices)

        # Rating analytics
        ratings = [p["rating"] for p in unique_products if p.get("rating") and 0 < p["rating"] <= 5]
        rating_stats = self._compute_rating_stats(ratings)

        # Brand analytics
        brands = [p["brand"] for p in unique_products if p.get("brand")]
        brand_stats = self._compute_brand_stats(brands)

        return {
            "total_products": len(products),
            "unique_products": len(unique_products),
            "duplicates": len(products) - len(unique_products),
            **price_stats,
            **rating_stats,
            **brand_stats,
            "products_with_price": len(prices),
            "products_with_rating": len(ratings),
            "products_with_brand": len(brands),
        }

    def _compute_price_stats(self, prices: list) -> dict:
        """Calculate price distribution metrics."""
        if not prices:
            return {
                "avg_price": None,
                "median_price": None,
                "min_price": None,
                "max_price": None,
                "std_price": None,
                "price_distribution": [],
            }

        avg = round(mean(prices), 2)
        med = round(median(prices), 2)
        mn = round(min(prices), 2)
        mx = round(max(prices), 2)
        sd = round(stdev(prices), 2) if len(prices) > 1 else 0

        # Price distribution (buckets)
        distribution = self._create_price_buckets(prices)

        return {
            "avg_price": avg,
            "median_price": med,
            "min_price": mn,
            "max_price": mx,
            "std_price": sd,
            "price_distribution": distribution,
        }

    def _create_price_buckets(self, prices: list, num_buckets: int = 5) -> list:
        """Create price distribution buckets."""
        if not prices:
            return []

        mn, mx = min(prices), max(prices)
        if mn == mx:
            return [{"range": f"{mn:.0f}", "count": len(prices)}]

        bucket_size = (mx - mn) / num_buckets
        buckets = []

        for i in range(num_buckets):
            low = mn + (i * bucket_size)
            high = mn + ((i + 1) * bucket_size)
            count = sum(1 for p in prices if low <= p < high or (i == num_buckets - 1 and p == high))
            buckets.append({
                "range": f"₹{low:.0f}-₹{high:.0f}",
                "count": count,
            })

        return buckets

    def _compute_rating_stats(self, ratings: list) -> dict:
        """Calculate rating distribution metrics."""
        if not ratings:
            return {
                "avg_rating": None,
                "rating_distribution": {},
            }

        avg = round(mean(ratings), 1)

        # Rating buckets (1-5 stars)
        dist = {
            "5_star": sum(1 for r in ratings if r >= 4.5),
            "4_star": sum(1 for r in ratings if 3.5 <= r < 4.5),
            "3_star": sum(1 for r in ratings if 2.5 <= r < 3.5),
            "2_star": sum(1 for r in ratings if 1.5 <= r < 2.5),
            "1_star": sum(1 for r in ratings if r < 1.5),
        }

        return {
            "avg_rating": avg,
            "rating_distribution": dist,
        }

    def _compute_brand_stats(self, brands: list) -> dict:
        """Calculate brand frequency metrics."""
        if not brands:
            return {
                "unique_brands": 0,
                "top_brands": [],
            }

        # Normalize brand names
        normalized = [b.strip().title() for b in brands if b.strip()]
        counter = Counter(normalized)

        top_brands = [
            {"name": name, "count": count}
            for name, count in counter.most_common(10)
        ]

        return {
            "unique_brands": len(counter),
            "top_brands": top_brands,
        }

    # --- SEO Analytics ---

    def _compute_seo(self, metadata: dict, links: list, images: list, url: str) -> dict:
        """Compute SEO audit metrics."""
        metadata = metadata or {}
        links = links or []
        images = images or []

        meta_title = (metadata.get("title") or "").strip()
        meta_description = (metadata.get("description") or "").strip()
        meta_keywords = (metadata.get("keywords") or "").strip()

        return {
            "meta_title": meta_title,
            "meta_title_length": len(meta_title),
            "meta_description": meta_description,
            "meta_description_length": len(meta_description),
            "meta_keywords": meta_keywords,

            # Heading analysis (approximate from metadata)
            "h1_count": None,  # Will be populated from content script data
            "h2_count": None,

            # Links
            "link_count": len(links),
            "internal_links": sum(1 for l in links if l and self._is_internal_link(l, url)),
            "external_links": sum(1 for l in links if l and not self._is_internal_link(l, url)),

            # Images
            "image_count": len(images),

            # JSON-LD
            "json_ld_count": None,  # Populated from content script
            "og_tags_present": bool(metadata.get("og_title") or metadata.get("og_image")),

            # Scores
            "title_score": self._score_title(meta_title),
            "description_score": self._score_description(meta_description),
        }

    def _is_internal_link(self, link: str, page_url: str) -> bool:
        """Check if a link is internal to the same domain."""
        try:
            from urllib.parse import urlparse
            link_host = urlparse(link).hostname or ""
            page_host = urlparse(page_url).hostname or ""
            return link_host == page_host or not link_host
        except Exception:
            return False

    def _score_title(self, title: Optional[str]) -> str:
        """Score the meta title quality."""
        if not title:
            return "missing"
        title_len = len(title)
        if title_len < 30:
            return "too_short"
        if title_len > 60:
            return "too_long"
        return "good"

    def _score_description(self, description: Optional[str]) -> str:
        """Score the meta description quality."""
        if not description:
            return "missing"
        desc_len = len(description)
        if desc_len < 70:
            return "too_short"
        if desc_len > 160:
            return "too_long"
        return "good"
