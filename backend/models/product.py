"""
WebIntel — Product Domain Models (Module 2)
Defines normalized schemas for Product Intelligence, including 13 standardized
attributes per product, duplicate detection, discount distribution, and pagination.
"""

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator


class ProductItem(BaseModel):
    """
    Standardized 13-field product model.
    Supports dual aliases for complete backward compatibility with existing UI.
    """
    product_name: str = Field(..., alias="title", description="Clean product title")
    brand: str = Field(default="Unknown", description="Brand, seller, or manufacturer")
    price: Optional[float] = Field(default=None, description="Current selling price")
    original_price: Optional[float] = Field(default=None, description="Original list / MRP / strikethrough price")
    discount_percent: float = Field(default=0.0, description="Calculated discount percentage (0.0 to 100.0)")
    rating: Optional[float] = Field(default=None, description="Product star rating (0.0 to 5.0)")
    review_count: int = Field(default=0, alias="reviews_count", description="Total user review count")
    asin_sku: str = Field(default="", alias="asin", description="Unique identifier (Amazon ASIN, SKU, or hash)")
    availability: str = Field(default="In Stock", description="Stock status (In Stock, Out of Stock, etc.)")
    prime_shipping: str = Field(default="Standard", alias="shipping", description="Prime / shipping eligibility")
    image_url: str = Field(default="", alias="image", description="High-resolution primary product image URL")
    product_url: str = Field(default="", alias="url", description="Canonical product link")
    position: int = Field(default=1, description="1-indexed rank/order of appearance on page")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "title": "Sony WH-1000XM5 Wireless Headphones",
                "brand": "Sony",
                "price": 348.00,
                "original_price": 399.99,
                "discount_percent": 13.0,
                "rating": 4.6,
                "reviews_count": 8940,
                "asin": "B09XS7JWHH",
                "availability": "In Stock",
                "shipping": "Prime",
                "image": "https://m.media-amazon.com/images/I/61+elLGNVqL._AC_SX679_.jpg",
                "url": "https://www.amazon.com/dp/B09XS7JWHH",
                "position": 1
            }
        }
    }

    def serialize(self) -> Dict[str, Any]:
        """Returns normalized dictionary exposing both standard and legacy field names for UI compatibility."""
        data = self.model_dump()
        # Ensure backward compatibility aliases exist in payload
        data["title"] = self.product_name
        data["product_name"] = self.product_name
        data["asin"] = self.asin_sku
        data["asin_sku"] = self.asin_sku
        data["image"] = self.image_url
        data["image_url"] = self.image_url
        data["url"] = self.product_url
        data["product_url"] = self.product_url
        data["link"] = self.product_url
        data["reviews"] = str(self.review_count) if self.review_count else ""
        data["reviews_count"] = self.review_count
        data["shipping"] = self.prime_shipping
        data["prime_shipping"] = self.prime_shipping
        return data

    def to_export_row(self) -> Dict[str, Any]:
        """Convert into a flat dictionary suitable for CSV / Excel tabular export."""
        return {
            "Position": self.position,
            "Product Name": self.product_name,
            "Brand": self.brand,
            "Price": f"${self.price:.2f}" if self.price is not None else "N/A",
            "Original Price": f"${self.original_price:.2f}" if self.original_price is not None else "N/A",
            "Discount %": f"{self.discount_percent:.1f}%" if self.discount_percent > 0 else "0%",
            "Rating": f"{self.rating:.1f}" if self.rating is not None else "N/A",
            "Review Count": self.review_count,
            "ASIN / SKU": self.asin_sku or "N/A",
            "Availability": self.availability,
            "Shipping": self.prime_shipping,
            "Product URL": self.product_url,
            "Image URL": self.image_url,
        }


class ProductAnalytics(BaseModel):
    """Aggregate analytics computed across all extracted products."""
    total_products: int = Field(default=0, description="Total number of items extracted")
    unique_products: int = Field(default=0, description="Number of unique products after deduplication")
    duplicate_products: int = Field(default=0, description="Count of duplicate products")
    duplicate_asins: int = Field(default=0, description="Count of duplicate ASINs/SKUs")
    brand_count: int = Field(default=0, description="Number of distinct brands found")
    average_price: Optional[float] = Field(default=None, description="Arithmetic mean price")
    median_price: Optional[float] = Field(default=None, description="Median selling price")
    lowest_price: Optional[float] = Field(default=None, description="Minimum price")
    highest_price: Optional[float] = Field(default=None, description="Maximum price")
    discount_distribution: Dict[str, int] = Field(
        default_factory=lambda: {"0%": 0, "1-10%": 0, "11-25%": 0, "26-50%": 0, "50%+": 0},
        description="Bucket breakdown of discount percentages"
    )
    top_brands: List[Dict[str, Any]] = Field(default_factory=list, description="Top brands by frequency")

    model_config = {
        "populate_by_name": True
    }

    def serialize(self) -> Dict[str, Any]:
        data = self.model_dump()
        # Aliases for backward compatibility with existing popup UI
        data["avg_price"] = self.average_price
        data["min_price"] = self.lowest_price
        data["max_price"] = self.highest_price
        data["unique_brands"] = self.brand_count
        data["duplicates"] = self.duplicate_products
        return data


class PaginatedProducts(BaseModel):
    """Pagination wrapper for product listing."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100, alias="pageSize")
    total: int = Field(default=0, ge=0)
    total_pages: int = Field(default=1, ge=1, alias="totalPages")
    items: List[Dict[str, Any]] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True
    }


class ProductIntelligenceResponse(BaseModel):
    """Normalized response payload for Module 2 Product Intelligence."""
    url: str
    domain: str
    analytics: ProductAnalytics
    pagination: PaginatedProducts
    products: List[Dict[str, Any]] = Field(default_factory=list, description="Current page product items")

    def serialize(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "domain": self.domain,
            "analytics": self.analytics.serialize(),
            "pagination": self.pagination.model_dump(by_alias=True),
            "products": self.products,
        }


class ProductError(BaseModel):
    """Structured error object for Module 2 failure isolation."""
    module: str = "products"
    status: str = "failed"
    reason: str = "Product extraction failed"
    details: Optional[Dict[str, Any]] = None

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()
