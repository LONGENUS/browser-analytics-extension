"""
WebIntel — SEO Intelligence Models (Module 3)
Defines normalized schemas for technical SEO audit, heading hierarchy,
image ALT analysis, internal/external links, JSON-LD structured data, and rule-based scoring (0-100).
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class SeoMetadata(BaseModel):
    """HTML Header and metadata directives."""
    title: str = Field(default="", description="HTML title tag content")
    title_length: int = Field(default=0, description="Character length of title")
    description: str = Field(default="", description="Meta description content")
    description_length: int = Field(default=0, description="Character length of meta description")
    canonical: str = Field(default="", description="Canonical link URL")
    robots: str = Field(default="", description="Robots meta directive (e.g. index, follow)")
    charset: str = Field(default="UTF-8", description="Character encoding")
    viewport: str = Field(default="", description="Viewport meta tag configuration")


class HeadingItem(BaseModel):
    """Individual heading element."""
    tag: str = Field(..., description="h1, h2, or h3")
    text: str = Field(..., description="Clean text content")
    level: int = Field(..., description="1, 2, or 3")


class HeadingsAudit(BaseModel):
    """Analysis of document heading structure."""
    h1_count: int = Field(default=0)
    h2_count: int = Field(default=0)
    h3_count: int = Field(default=0)
    h1_tags: List[str] = Field(default_factory=list)
    hierarchy_issues: List[str] = Field(
        default_factory=list,
        description="Warnings such as missing H1, multiple H1s, or skipped heading levels"
    )
    all_headings: List[HeadingItem] = Field(default_factory=list)


class ImageAuditItem(BaseModel):
    """Audited image item."""
    src: str = Field(default="")
    alt: str = Field(default="")
    has_alt: bool = Field(default=False)
    format: str = Field(default="unknown")


class ImagesAudit(BaseModel):
    """Image SEO and accessibility audit."""
    total_images: int = Field(default=0)
    missing_alt_count: int = Field(default=0)
    alt_coverage_percent: float = Field(default=100.0)
    format_breakdown: Dict[str, int] = Field(default_factory=dict)
    sample_missing_alt: List[str] = Field(default_factory=list)


class LinksAudit(BaseModel):
    """Link distribution and health audit."""
    total_links: int = Field(default=0)
    internal_links_count: int = Field(default=0)
    external_links_count: int = Field(default=0)
    nofollow_count: int = Field(default=0)
    empty_anchor_count: int = Field(default=0)
    internal_sample: List[str] = Field(default_factory=list)
    external_sample: List[str] = Field(default_factory=list)


class StructuredDataItem(BaseModel):
    """Detected Schema.org or JSON-LD item."""
    schema_type: str = Field(default="Thing")
    context: str = Field(default="https://schema.org")
    name: Optional[str] = None
    raw_snippet: Optional[Dict[str, Any]] = None


class StructuredDataAudit(BaseModel):
    """Structured data audit."""
    has_json_ld: bool = Field(default=False)
    detected_types: List[str] = Field(default_factory=list)
    has_product_schema: bool = Field(default=False)
    has_breadcrumb_schema: bool = Field(default=False)
    has_faq_schema: bool = Field(default=False)
    items: List[StructuredDataItem] = Field(default_factory=list)


class SeoScore(BaseModel):
    """Rule-based SEO score (0 - 100)."""
    score: int = Field(default=0, ge=0, le=100)
    rating: str = Field(default="Poor", description="Poor, Fair, Good, Excellent")
    breakdown: Dict[str, int] = Field(
        default_factory=dict,
        description="Category points: title, description, canonical, headings, images, schema"
    )
    recommendations: List[str] = Field(default_factory=list)


class SeoIntelligenceResponse(BaseModel):
    """Normalized response payload for Module 3 (SEO Intelligence)."""
    url: str
    domain: str
    seo_score: SeoScore
    metadata: SeoMetadata
    headings: HeadingsAudit
    images: ImagesAudit
    links: LinksAudit
    structured_data: StructuredDataAudit

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()


class SeoError(BaseModel):
    """Structured error object for Module 3 failure isolation."""
    module: str = "seo"
    status: str = "failed"
    reason: str = "SEO analysis failed"
    details: Optional[Dict[str, Any]] = None

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()
