"""
WebIntel — Overview Domain Model (Module 1)
Defines normalized data structures, validation rules, serializers, and export mappers.
"""

from datetime import datetime, timezone
from typing import Optional, Union, Dict, Any, List
from pydantic import BaseModel, Field, HttpUrl, field_validator


class PageTypeClassification(BaseModel):
    """Detailed classification with confidence score."""
    page_type: str = Field(..., alias="pageType", description="Marketplace, Ecommerce, SaaS, Blog, Company, News, Documentation, Portfolio, or Generic")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "pageType": "Ecommerce",
                "confidence": 0.94
            }
        }
    }


class OverviewData(BaseModel):
    """Normalized domain model for Website Overview."""
    url: str = Field(..., description="Canonical or requested page URL")
    domain: str = Field(..., description="Clean root domain")
    title: str = Field(default="", description="HTML title tag or primary heading")
    favicon: Optional[str] = Field(default=None, description="Absolute URL to the favicon")
    industry: str = Field(default="General", description="Classified industry vertical")
    page_type: str = Field(..., alias="pageType", description="Classified category: Marketplace, Ecommerce, SaaS, Blog, Company, News, Documentation, Portfolio")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Classification confidence score")
    language: str = Field(default="en", description="Page primary language (ISO 639-1)")
    currency: Optional[str] = Field(default=None, description="Detected currency code or symbol (e.g. USD, EUR, INR)")
    scraped_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        alias="scrapedAt",
        description="ISO 8601 UTC timestamp of crawl"
    )
    status_code: int = Field(default=200, alias="statusCode", description="HTTP response status code")
    canonical_url: Optional[str] = Field(default=None, alias="canonicalUrl", description="Canonical URL from link tag")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "url": "https://example.com/products/shoes",
                "domain": "example.com",
                "title": "Running Shoes & Sneakers | Example Store",
                "favicon": "https://example.com/favicon.ico",
                "industry": "Retail & Ecommerce",
                "pageType": "Ecommerce",
                "confidence": 0.95,
                "language": "en",
                "currency": "USD",
                "scrapedAt": "2026-09-23T17:00:00Z",
                "statusCode": 200,
                "canonicalUrl": "https://example.com/products/shoes"
            }
        }
    }

    def serialize(self) -> Dict[str, Any]:
        """Return standardized camelCase dictionary for JSON responses."""
        return self.model_dump(by_alias=True)

    def to_export_row(self) -> Dict[str, Any]:
        """Convert into a flat dictionary suitable for CSV / Excel tabular export."""
        return {
            "URL": self.url,
            "Domain": self.domain,
            "Title": self.title,
            "Favicon": self.favicon or "",
            "Industry": self.industry,
            "Page Type": self.page_type,
            "Confidence": f"{self.confidence * 100:.1f}%",
            "Language": self.language,
            "Currency": self.currency or "N/A",
            "Status Code": self.status_code,
            "Canonical URL": self.canonical_url or "",
            "Scraped At": self.scraped_at,
        }


class OverviewError(BaseModel):
    """Structured error object for Module 1 failure isolation."""
    module: str = "overview"
    status: str = "failed"
    reason: str = "Unknown error occurred during overview extraction"
    details: Optional[Dict[str, Any]] = None

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()
