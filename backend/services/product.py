"""
WebIntel — Product Intelligence Service (Module 2)
Implements full product extraction normalization with 13 standard attributes,
automated analytics (price stats, duplicates, discount distribution), pagination,
and multi-format export (CSV, JSON, XLSX).
"""

import csv
import io
import json
import re
from statistics import mean, median
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse

from models.product import (
    ProductItem,
    ProductAnalytics,
    PaginatedProducts,
    ProductIntelligenceResponse,
    ProductError,
)


class ProductService:
    """
    Product Intelligence Engine.
    Exposes: analyze(), validate(), normalize(), export()
    """

    def analyze(
        self,
        crawl_result: dict,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Analyze products from a crawl result and compute advanced Product Intelligence.

        Args:
            crawl_result: Dict containing products, url, domain, html, etc.
            page: Pagination page (1-indexed)
            page_size: Items per page

        Returns:
            Standardized ProductIntelligenceResponse dictionary or structured ProductError.
        """
        try:
            url = crawl_result.get("url", "")
            domain = crawl_result.get("domain", "") or urlparse(url).netloc
            raw_products = crawl_result.get("products", []) or []

            # 1. Normalize all products to 13 required fields with position index
            normalized_products = self.normalize(
                raw_products=raw_products,
                domain=domain,
                page_url=url,
                html=crawl_result.get("html", "")
            )

            # 2. Compute Analytics across the full dataset
            analytics = self._compute_analytics(normalized_products)

            # 3. Paginate products
            total = len(normalized_products)
            page = max(1, page)
            page_size = max(1, min(100, page_size))
            total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            page_items = normalized_products[start_idx:end_idx]

            response = ProductIntelligenceResponse(
                url=url,
                domain=domain,
                analytics=analytics,
                pagination=PaginatedProducts(
                    page=page,
                    pageSize=page_size,
                    total=total,
                    totalPages=total_pages,
                    items=page_items,
                ),
                products=page_items,
            )

            return response.serialize()

        except Exception as e:
            return ProductError(
                reason=f"Product Intelligence analysis failed: {str(e)}",
                details={"error_type": type(e).__name__}
            ).serialize()

    def validate(self, data: dict) -> bool:
        """Validate product intelligence dictionary."""
        try:
            ProductItem(**data)
            return True
        except Exception:
            return False

    def normalize(
        self,
        raw_products: list,
        domain: str = "",
        page_url: str = "",
        html: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Normalize raw product items into the 13 required fields.
        """
        normalized: List[Dict[str, Any]] = []

        for idx, item in enumerate(raw_products, start=1):
            if not isinstance(item, dict):
                continue

            title = self._clean_text(item.get("product_name") or item.get("title") or "")
            if not title or len(title) < 2:
                continue

            # Pricing
            price = self._parse_numeric(item.get("price"))
            original_price = self._parse_numeric(item.get("original_price") or item.get("mrp") or item.get("list_price"))

            # Calculate or extract discount
            discount = item.get("discount_percent")
            if discount is not None:
                discount = float(discount)
            elif original_price and price and original_price > price:
                discount = round(((original_price - price) / original_price) * 100, 1)
            else:
                discount = 0.0

            # If original price missing but price and discount exist, estimate original
            if original_price is None and price is not None and discount > 0:
                original_price = round(price / (1 - (discount / 100)), 2)

            # Rating & Review Count
            rating = self._parse_rating(item.get("rating"))
            reviews = self._parse_int(item.get("review_count") or item.get("reviews_count") or item.get("reviews"))

            # Identifier (ASIN / SKU)
            asin_sku = item.get("asin_sku") or item.get("asin") or item.get("sku") or ""
            product_url = item.get("product_url") or item.get("url") or item.get("link") or page_url

            # Extract ASIN from URL if missing and domain is Amazon
            if not asin_sku and "amazon" in domain:
                match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", product_url)
                if match:
                    asin_sku = match.group(1)

            # Stock & Shipping
            availability = item.get("availability") or "In Stock"
            shipping = item.get("prime_shipping") or item.get("shipping") or ("Prime" if "amazon" in domain else "Standard")

            # Brand
            brand = self._clean_text(item.get("brand") or "Unknown")

            # Image URL
            image_url = item.get("image_url") or item.get("image") or ""

            # Position
            position = item.get("position") or idx

            product_obj = ProductItem(
                title=title,
                brand=brand or "Unknown",
                price=price,
                original_price=original_price,
                discount_percent=max(0.0, min(100.0, discount)),
                rating=rating,
                reviews_count=reviews,
                asin=asin_sku,
                availability=availability,
                shipping=shipping,
                image=image_url,
                url=product_url,
                position=position,
            )

            normalized.append(product_obj.serialize())

        return normalized

    def _compute_analytics(self, products: List[Dict[str, Any]]) -> ProductAnalytics:
        """Compute advanced metrics, duplicate detection, and discount distribution."""
        total = len(products)
        if total == 0:
            return ProductAnalytics()

        # Prices
        prices = [p["price"] for p in products if p.get("price") is not None]
        avg_price = round(mean(prices), 2) if prices else None
        med_price = round(median(prices), 2) if prices else None
        lowest_price = min(prices) if prices else None
        highest_price = max(prices) if prices else None

        # Duplicates Detection
        seen_titles = set()
        seen_asins = set()
        duplicate_products = 0
        duplicate_asins = 0

        for p in products:
            clean_t = p.get("product_name", "").strip().lower()
            if clean_t:
                if clean_t in seen_titles:
                    duplicate_products += 1
                else:
                    seen_titles.add(clean_t)

            clean_asin = p.get("asin_sku", "").strip().upper()
            if clean_asin:
                if clean_asin in seen_asins:
                    duplicate_asins += 1
                else:
                    seen_asins.add(clean_asin)

        unique_products = total - duplicate_products

        # Brands
        brand_counts: Dict[str, int] = {}
        for p in products:
            b = p.get("brand") or "Unknown"
            if b != "Unknown":
                brand_counts[b] = brand_counts.get(b, 0) + 1

        top_brands = [
            {"brand": k, "count": v}
            for k, v in sorted(brand_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        brand_count = len(brand_counts)

        # Discount Distribution
        distribution = {"0%": 0, "1-10%": 0, "11-25%": 0, "26-50%": 0, "50%+": 0}
        for p in products:
            disc = p.get("discount_percent") or 0.0
            if disc <= 0:
                distribution["0%"] += 1
            elif disc <= 10:
                distribution["1-10%"] += 1
            elif disc <= 25:
                distribution["11-25%"] += 1
            elif disc <= 50:
                distribution["26-50%"] += 1
            else:
                distribution["50%+"] += 1

        return ProductAnalytics(
            total_products=total,
            unique_products=unique_products,
            duplicate_products=duplicate_products,
            duplicate_asins=duplicate_asins,
            brand_count=brand_count,
            average_price=avg_price,
            median_price=med_price,
            lowest_price=lowest_price,
            highest_price=highest_price,
            discount_distribution=distribution,
            top_brands=top_brands,
        )

    def export(self, products: list, format: str = "json") -> Union[str, bytes]:
        """
        Export products list into CSV, JSON, or XLSX.
        """
        fmt = (format or "json").lower().strip()

        # Ensure normalized rows
        rows = []
        for p in products:
            if isinstance(p, dict):
                try:
                    row = ProductItem(**p).to_export_row()
                except Exception:
                    row = {k: str(v) for k, v in p.items()}
                rows.append(row)

        if fmt == "json":
            return json.dumps(products, indent=2, ensure_ascii=False)

        elif fmt == "csv":
            output = io.StringIO()
            if rows:
                writer = csv.writer(output)
                writer.writerow(list(rows[0].keys()))
                for r in rows:
                    writer.writerow(list(r.values()))
            return output.getvalue()

        elif fmt in ("xlsx", "excel"):
            stream = io.BytesIO()
            try:
                import pandas as pd
                df = pd.DataFrame(rows)
                with pd.ExcelWriter(stream, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="Products", index=False)
                stream.seek(0)
                return stream.getvalue()
            except Exception:
                # If pandas or openpyxl fails, return clean CSV as fallback bytes
                csv_bytes = self.export(products, format="csv").encode("utf-8")
                return csv_bytes

        elif fmt == "dict":
            return products

        raise ValueError(f"Unsupported format '{format}'. Supported: json, csv, xlsx, dict.")

    # --- Cleaners ---

    def _clean_text(self, text: Any) -> str:
        if not text:
            return ""
        return re.sub(r"\s+", " ", str(text)).strip()

    def _parse_numeric(self, val: Any) -> Optional[float]:
        if val is None or val == "":
            return None
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = re.sub(r"[₹$€£¥,\s]", "", str(val))
        match = re.search(r"(\d+\.?\d*)", cleaned)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return None

    def _parse_rating(self, val: Any) -> Optional[float]:
        num = self._parse_numeric(val)
        if num is not None and 0.0 <= num <= 5.0:
            return round(num, 1)
        return None

    def _parse_int(self, val: Any) -> int:
        if val is None:
            return 0
        if isinstance(val, int):
            return val
        cleaned = re.sub(r"[^\d]", "", str(val))
        if cleaned:
            try:
                return int(cleaned)
            except ValueError:
                pass
        return 0


# Singleton
product_service = ProductService()
