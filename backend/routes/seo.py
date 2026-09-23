"""
WebIntel — SEO Intelligence Routes (Module 3)
Provides dedicated endpoints for standalone SEO auditing, schema inspection,
and multi-format report exports (CSV, JSON, XLSX).
"""

import json
from typing import Any, Dict, Optional, Union
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models.seo import SeoIntelligenceResponse, SeoError
from services.seo import seo_service

router = APIRouter()


class SeoAnalyzeRequest(BaseModel):
    url: str


class SeoExportRequest(BaseModel):
    data: Dict[str, Any]
    format: str = "json"  # "json", "csv", "xlsx"


@router.post("", response_model=Union[SeoIntelligenceResponse, SeoError])
@router.post("/", response_model=Union[SeoIntelligenceResponse, SeoError], include_in_schema=False)
async def analyze_seo(request: Request, body: SeoAnalyzeRequest):
    """
    Perform a comprehensive Technical SEO audit for a URL.
    Returns metadata, heading hierarchy, image ALT audit, links audit,
    JSON-LD structured data, and rule-based 0-100 SEO score.
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
        return seo_service.analyze(crawl_result)
    except Exception as e:
        return SeoError(
            reason=f"SEO analysis failed: {str(e)}",
            details={"url": url, "error_type": type(e).__name__}
        ).serialize()


@router.get("/schema")
async def get_seo_schema():
    """Returns the JSON schema specification for Module 3 (SEO Intelligence)."""
    return SeoIntelligenceResponse.model_json_schema()


@router.post("/export")
async def export_seo(body: SeoExportRequest):
    """Export SEO audit report into CSV, JSON, or XLSX format."""
    fmt = body.format.lower().strip()
    try:
        exported = seo_service.export(body.data, format=fmt)

        if fmt == "csv":
            return Response(
                content=exported,
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="seo_audit.csv"'}
            )
        elif fmt in ("xlsx", "excel"):
            return Response(
                content=exported,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="seo_audit.xlsx"'}
            )
        return JSONResponse(content=json.loads(exported) if isinstance(exported, str) else exported)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")
