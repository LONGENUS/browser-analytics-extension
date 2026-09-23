"""
WebIntel — Product Intelligence Routes (Module 2)
Provides dedicated endpoints for paginated product extraction, advanced analytics,
schema inspection, and multi-format dataset export (CSV, JSON, XLSX).
"""

import json
from typing import Optional, Dict, Any, Union, List
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from models.product import (
    ProductIntelligenceResponse,
    ProductError,
    ProductItem,
)
from services.product import product_service


router = APIRouter()


class ProductAnalyzeRequest(BaseModel):
    url: str
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100, alias="pageSize")


class ProductExportRequest(BaseModel):
    products: List[Dict[str, Any]]
    format: str = "json"  # "json", "csv", "xlsx"


@router.post("", response_model=Union[ProductIntelligenceResponse, ProductError])
@router.post("/", response_model=Union[ProductIntelligenceResponse, ProductError], include_in_schema=False)
async def analyze_products(request: Request, body: ProductAnalyzeRequest):
    """
    Extract and analyze products from a website URL.
    Returns 13 standardized product fields, duplicate detection, discount distribution,
    and paginated product listing.
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
        result = product_service.analyze(
            crawl_result=crawl_result,
            page=body.page,
            page_size=body.page_size,
        )
        return result

    except Exception as e:
        return ProductError(
            reason=f"Product analysis failed: {str(e)}",
            details={"url": url, "error_type": type(e).__name__}
        ).serialize()


@router.get("/schema")
async def get_products_schema():
    """Returns the JSON schema specification for Module 2 (Product Intelligence)."""
    return ProductIntelligenceResponse.model_json_schema()


@router.post("/export")
async def export_products(body: ProductExportRequest):
    """Export product items into CSV, JSON, or XLSX format."""
    fmt = body.format.lower().strip()
    try:
        exported = product_service.export(body.products, format=fmt)

        if fmt == "csv":
            return Response(
                content=exported,
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="products.csv"'}
            )
        elif fmt in ("xlsx", "excel"):
            return Response(
                content=exported,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="products.xlsx"'}
            )
        return JSONResponse(content=json.loads(exported) if isinstance(exported, str) else exported)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Export failed: {str(e)}")
