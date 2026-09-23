"""
WebIntel — Overview Routes (Module 1)
Endpoints for standalone website overview analysis, schema inspection, and export.
"""

from typing import Optional, Dict, Any, Union
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Query, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, HttpUrl

from models.overview import OverviewData, OverviewError
from services.overview import overview_service


router = APIRouter()


class OverviewRequest(BaseModel):
    url: str
    title: Optional[str] = ""


class OverviewExportRequest(BaseModel):
    data: Dict[str, Any]
    format: str = "json"  # "json" or "csv"


@router.post("", response_model=Union[OverviewData, OverviewError])
@router.post("/", response_model=Union[OverviewData, OverviewError], include_in_schema=False)
async def analyze_overview(request: Request, body: OverviewRequest):
    """
    Generate normalized website overview for a given URL.
    Runs in < 3 seconds using fast crawler or lightweight HTTP fallback.
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

    crawler = getattr(request.app.state, "crawler", None)
    if not crawler:
        from services.crawler import CrawlService
        crawler = CrawlService()
        await crawler.start()
        request.app.state.crawler = crawler

    try:
        crawl_result = await crawler.crawl_url(url)
        if body.title and not crawl_result.get("title"):
            crawl_result["title"] = body.title

        result = overview_service.analyze(crawl_result, status_code=200)
        return result

    except Exception as e:
        return OverviewError(
            reason=f"Overview analysis failed: {str(e)}",
            details={"url": url, "error_type": type(e).__name__}
        ).serialize()


@router.get("/schema")
async def get_overview_schema():
    """Returns the JSON schema specification for Module 1 (Overview)."""
    return OverviewData.model_json_schema()


@router.post("/export")
async def export_overview(body: OverviewExportRequest):
    """Export overview data as JSON or CSV."""
    fmt = body.format.lower().strip()
    try:
        exported = overview_service.export(body.data, format=fmt)
        if fmt == "csv":
            return Response(
                content=exported,
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="overview.csv"'}
            )
        return JSONResponse(content=body.data if isinstance(exported, str) else exported)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")
