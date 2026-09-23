"""
WebIntel — Website Traffic Analytics Routes (Module 5)
Provides dedicated endpoints for traffic estimation, schema inspection,
and multi-format export (CSV, JSON, XLSX).
"""

import json
from typing import Any, Dict, Optional, Union
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models.traffic import TrafficResponse, TrafficError
from services.traffic import traffic_service

router = APIRouter()


class TrafficAnalyzeRequest(BaseModel):
    url: str
    provider_data: Optional[Dict[str, Any]] = None


class TrafficExportRequest(BaseModel):
    data: Dict[str, Any]
    format: str = "json"  # "json", "csv", "xlsx"


@router.post("", response_model=Union[TrafficResponse, TrafficError])
@router.post("/", response_model=Union[TrafficResponse, TrafficError], include_in_schema=False)
async def analyze_traffic(request: Request, body: TrafficAnalyzeRequest):
    """
    Get website traffic and audience analytics.
    Returns honest 'Unavailable' status when external unmetered metrics are not connected.
    """
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        parsed = urlparse(url)
        if not parsed.hostname:
            raise ValueError("Invalid hostname")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    try:
        crawl_result = {"url": url, "domain": parsed.hostname}
        return traffic_service.analyze(crawl_result, provider_data=body.provider_data)
    except Exception as e:
        return TrafficError(
            reason=f"Traffic analytics failed: {str(e)}",
            details={"url": url, "error_type": type(e).__name__}
        ).serialize()


@router.get("/schema")
async def get_traffic_schema():
    """Returns the JSON schema specification for Module 5 (Website Analytics)."""
    return TrafficResponse.model_json_schema()


@router.post("/export")
async def export_traffic(body: TrafficExportRequest):
    """Export traffic analytics report into CSV, JSON, or XLSX format."""
    fmt = body.format.lower().strip()
    try:
        exported = traffic_service.export(body.data, format=fmt)

        if fmt == "csv":
            return Response(
                content=exported,
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="traffic_analytics.csv"'}
            )
        elif fmt in ("xlsx", "excel"):
            return Response(
                content=exported,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="traffic_analytics.xlsx"'}
            )
        return JSONResponse(content=json.loads(exported) if isinstance(exported, str) else exported)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")
