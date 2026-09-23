"""
WebIntel — Technology Stack Detection Models (Module 4)
Defines normalized schemas for technology fingerprints across 11 categories
with confidence scoring (0-100) and multi-format exports.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TechItem(BaseModel):
    """Detected technology entry."""
    name: str = Field(..., description="Name of technology or library")
    category: str = Field(..., description="Classification category (e.g. Frontend Framework, CMS, Analytics)")
    confidence: int = Field(default=90, ge=1, le=100, description="Confidence score 1 - 100")
    version: Optional[str] = Field(default=None, description="Detected version string if identifiable")
    icon: Optional[str] = Field(default=None, description="Icon identifier or SVG hint")


class TechCategoryGroup(BaseModel):
    """Grouped view by technology category."""
    category: str
    count: int = 0
    technologies: List[TechItem] = Field(default_factory=list)


class TechStackResponse(BaseModel):
    """Normalized response payload for Module 4 (Technology Detection)."""
    url: str
    domain: str
    total_detected: int = 0
    categories: Dict[str, List[TechItem]] = Field(default_factory=dict)
    technologies: List[TechItem] = Field(default_factory=list)

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()


class TechError(BaseModel):
    """Structured error object for Module 4 failure isolation."""
    module: str = "techstack"
    status: str = "failed"
    reason: str = "Technology detection failed"
    details: Optional[Dict[str, Any]] = None

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()
