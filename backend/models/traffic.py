"""
WebIntel — Website Traffic Analytics Models (Module 5)
Defines normalized schemas for website traffic estimates (monthly visits, duration,
bounce rate, top countries, channels) with honest 'Unavailable' provider fallback.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CountryShare(BaseModel):
    """Country traffic percentage."""
    country: str = Field(..., description="Country name")
    code: str = Field(default="", description="ISO country code")
    share: float = Field(default=0.0, description="Traffic share percentage (0.0 - 100.0)")


class TrafficChannels(BaseModel):
    """Traffic source distribution (shares summing to ~100%)."""
    direct: float = Field(default=0.0)
    search: float = Field(default=0.0)
    social: float = Field(default=0.0)
    referral: float = Field(default=0.0)
    mail: float = Field(default=0.0)


class TrafficMetrics(BaseModel):
    """Estimated engagement and visit metrics."""
    monthly_visits: Optional[int] = Field(default=None, alias="monthlyVisits")
    avg_visit_duration: Optional[str] = Field(default=None, alias="avgVisitDuration")
    pages_per_visit: Optional[float] = Field(default=None, alias="pagesPerVisit")
    bounce_rate: Optional[float] = Field(default=None, alias="bounceRate")

    model_config = {
        "populate_by_name": True
    }


class TrafficResponse(BaseModel):
    """Normalized response payload for Module 5 (Website Analytics)."""
    url: str
    domain: str
    source: str = Field(default="Unavailable", description="Data provider or 'Unavailable'")
    status: str = Field(default="unmetered", description="'available' or 'unmetered'")
    metrics: TrafficMetrics = Field(default_factory=TrafficMetrics)
    top_countries: List[CountryShare] = Field(default_factory=list, alias="topCountries")
    traffic_channels: Optional[TrafficChannels] = Field(default=None, alias="trafficChannels")
    top_referrers: List[str] = Field(default_factory=list, alias="topReferrers")
    note: Optional[str] = Field(
        default="Direct traffic analytics require an external provider (e.g. Similarweb/Semrush API key). Real data only.",
        description="Explanation when source is Unavailable"
    )

    model_config = {
        "populate_by_name": True
    }

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump(by_alias=True)


class TrafficError(BaseModel):
    """Structured error object for Module 5 failure isolation."""
    module: str = "traffic"
    status: str = "failed"
    reason: str = "Website analytics failed"
    details: Optional[Dict[str, Any]] = None

    def serialize(self) -> Dict[str, Any]:
        return self.model_dump()
