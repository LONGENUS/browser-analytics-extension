"""
WebIntel — Technology Detection Routes (Module 4)
Provides dedicated endpoints for standalone tech stack discovery, schema inspection,
and multi-format export (CSV, JSON, XLSX).
"""

import json
from typing import Any, Dict, Optional, Union
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models.tech import TechStackResponse, TechError
from services.techstack import techstack_service

router = APIRouter()


class TechAnalyzeRequest(BaseModel):
    url: str


class TechExportRequest(BaseModel):
    data: Dict[str, Any]
    format: str = "json"  # "json", "csv", "xlsx"


@router.post("", response_model=Union[TechStackResponse, TechError])
@router.post("/", response_model=Union[TechStackResponse, TechError], include_in_schema=False)
async def analyze_tech(request: Request, body: TechAnalyzeRequest):
    """
    Detect technologies, libraries, CMS, and frameworks across 11 categories.
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
        return techstack_service.analyze(crawl_result)
    except Exception as e:
        return TechError(
            reason=f"Technology detection failed: {str(e)}",
            details={"url": url, "error_type": type(e).__name__}
        ).serialize()


@router.get("/schema")
async def get_tech_schema():
    """Returns the JSON schema specification for Module 4 (Technology Detection)."""
    return TechStackResponse.model_json_schema()


@router.post("/export")
async def export_tech(body: TechExportRequest):
    """Export technology detection report into CSV, JSON, or XLSX format."""
    fmt = body.format.lower().strip()
    try:
        exported = techstack_service.export(body.data, format=fmt)

        if fmt == "csv":
            return Response(
                content=exported,
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="tech_stack.csv"'}
            )
        elif fmt in ("xlsx", "excel"):
            return Response(
                content=exported,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="tech_stack.xlsx"'}
            )
        return JSONResponse(content=json.loads(exported) if isinstance(exported, str) else exported)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")
