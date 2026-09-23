"""
WebIntel — Website Traffic Analytics Service (Module 5)
Provides pluggable, provider-agnostic domain traffic estimates.
Adheres strictly to the user guideline:
If external provider metrics are unavailable, returns 'source': 'Unavailable'
instead of fake/hallucinated data.
"""

import csv
import io
import json
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

from models.traffic import (
    TrafficMetrics,
    CountryShare,
    TrafficChannels,
    TrafficResponse,
    TrafficError,
)


class TrafficService:
    """
    Website Traffic & Audience Analytics Service.
    Exposes: analyze(), validate(), normalize(), export()
    """

    def analyze(self, crawl_result: dict, provider_data: Optional[dict] = None) -> Dict[str, Any]:
        """
        Analyze domain traffic metrics.
        If third-party provider data is not available, honestly returns 'source': 'Unavailable'.
        """
        if not crawl_result or not isinstance(crawl_result, dict):
            return TrafficError(reason="Invalid crawl result provided").serialize()

        try:
            url = crawl_result.get("url", "")
            domain = crawl_result.get("domain", "") or urlparse(url).netloc

            if provider_data and isinstance(provider_data, dict):
                # If an external provider integration payload exists
                metrics = TrafficMetrics(
                    monthlyVisits=provider_data.get("monthlyVisits"),
                    avgVisitDuration=provider_data.get("avgVisitDuration"),
                    pagesPerVisit=provider_data.get("pagesPerVisit"),
                    bounceRate=provider_data.get("bounceRate"),
                )
                countries = [
                    CountryShare(**c) for c in provider_data.get("topCountries", [])
                ]
                channels = TrafficChannels(**provider_data["trafficChannels"]) if "trafficChannels" in provider_data else None
                referrers = provider_data.get("topReferrers", [])

                response = TrafficResponse(
                    url=url,
                    domain=domain,
                    source=provider_data.get("source", "Connected Provider"),
                    status="available",
                    metrics=metrics,
                    topCountries=countries,
                    trafficChannels=channels,
                    topReferrers=referrers,
                    note=None,
                )
            else:
                # Provider-agnostic honest fallback: No fake data
                response = TrafficResponse(
                    url=url,
                    domain=domain,
                    source="Unavailable",
                    status="unmetered",
                    metrics=TrafficMetrics(),
                    topCountries=[],
                    trafficChannels=None,
                    topReferrers=[],
                    note="External traffic metrics provider not connected. Returning honest 'Unavailable' state without synthetic data.",
                )

            return response.serialize()

        except Exception as e:
            return TrafficError(
                reason=f"Traffic analytics failed: {str(e)}",
                details={"error_type": type(e).__name__}
            ).serialize()

    def validate(self, data: dict) -> bool:
        """Validate traffic response dictionary."""
        try:
            TrafficResponse(**data)
            return True
        except Exception:
            return False

    def normalize(self, data: dict) -> Dict[str, Any]:
        """Serialize and validate traffic data."""
        return TrafficResponse(**data).serialize()

    def export(self, data: dict, format: str = "json") -> Union[str, bytes]:
        """Export traffic metrics into CSV, JSON, or XLSX."""
        fmt = (format or "json").lower().strip()

        if fmt == "json":
            return json.dumps(data, indent=2, ensure_ascii=False)

        metrics = data.get("metrics", {})
        rows = [
            {"Metric": "Domain", "Value": data.get("domain", "")},
            {"Metric": "Data Source", "Value": data.get("source", "Unavailable")},
            {"Metric": "Status", "Value": data.get("status", "unmetered")},
            {"Metric": "Estimated Monthly Visits", "Value": str(metrics.get("monthlyVisits") or "Unavailable")},
            {"Metric": "Average Visit Duration", "Value": str(metrics.get("avgVisitDuration") or "Unavailable")},
            {"Metric": "Pages Per Visit", "Value": str(metrics.get("pagesPerVisit") or "Unavailable")},
            {"Metric": "Bounce Rate", "Value": f"{metrics.get('bounceRate')}%" if metrics.get("bounceRate") is not None else "Unavailable"},
            {"Metric": "Top Referrers", "Value": ", ".join(data.get("topReferrers", [])) or "None recorded"},
        ]

        if fmt == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["Metric", "Value"])
            writer.writeheader()
            writer.writerows(rows)
            return output.getvalue()

        elif fmt in ("xlsx", "excel"):
            stream = io.BytesIO()
            try:
                import pandas as pd
                df = pd.DataFrame(rows)
                with pd.ExcelWriter(stream, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="Traffic Analytics", index=False)
                stream.seek(0)
                return stream.getvalue()
            except Exception:
                return self.export(data, "csv").encode("utf-8")

        raise ValueError(f"Unsupported format '{format}'. Supported: json, csv, xlsx.")


traffic_service = TrafficService()
