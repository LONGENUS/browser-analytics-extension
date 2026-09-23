"""
WebIntel — Export Routes
POST /export/csv, /export/xlsx, /export/json — File download endpoints.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any

from services.exporter import ExporterService


router = APIRouter()
exporter = ExporterService()


class ExportRequest(BaseModel):
    """Accepts the full analysis data for export."""
    url: str = ""
    domain: str = ""
    title: str = ""
    summary: str = ""
    analytics: dict = {}
    seo: dict = {}
    products: list = []
    created_at: str = ""


@router.post("/csv")
async def export_csv(body: ExportRequest):
    """Export analysis results as CSV."""
    try:
        data = body.model_dump()
        stream = exporter.to_csv(data)

        filename = _make_filename(data, "csv")

        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {str(e)}")


@router.post("/xlsx")
async def export_xlsx(body: ExportRequest):
    """Export analysis results as multi-sheet Excel workbook."""
    try:
        data = body.model_dump()
        stream = exporter.to_xlsx(data)

        filename = _make_filename(data, "xlsx")

        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel export failed: {str(e)}")


@router.post("/json")
async def export_json(body: ExportRequest):
    """Export full analysis results as JSON."""
    try:
        data = body.model_dump()
        stream = exporter.to_json(data)

        filename = _make_filename(data, "json")

        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON export failed: {str(e)}")


def _make_filename(data: dict, ext: str) -> str:
    """Generate a descriptive filename from the analysis data."""
    domain = data.get("domain", "analysis")
    # Clean domain for filename
    safe_domain = "".join(c if c.isalnum() or c in "-_" else "_" for c in domain)
    return f"webintel-{safe_domain}.{ext}"
