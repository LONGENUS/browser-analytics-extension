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


class UniversalExportAllRequest(BaseModel):
    dossier: dict
    format: str = "xlsx"  # "xlsx", "csv", "json"


class UniversalExportModuleRequest(BaseModel):
    module: str
    data: Any
    format: str = "json"  # "xlsx", "csv", "json"


@router.post("/all")
async def export_all_modules(body: UniversalExportAllRequest):
    """
    Module 6 Universal Dossier Export:
    Exports all platform modules (Overview, Products, SEO, Tech Stack, Traffic)
    into a unified multi-sheet Excel workbook, consolidated CSV, or JSON.
    """
    from services.universal_export import universal_export_service
    fmt = body.format.lower().strip()
    domain = body.dossier.get("domain", "webintel")
    safe_domain = "".join(c if c.isalnum() or c in "-_" else "_" for c in domain)

    try:
        exported = universal_export_service.export_all(body.dossier, format=fmt)

        if fmt in ("xlsx", "excel"):
            return StreamingResponse(
                iter([exported]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="webintel-dossier-{safe_domain}.xlsx"'}
            )
        elif fmt == "csv":
            return StreamingResponse(
                iter([exported.encode("utf-8") if isinstance(exported, str) else exported]),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="webintel-dossier-{safe_domain}.csv"'}
            )
        else:
            return StreamingResponse(
                iter([exported.encode("utf-8") if isinstance(exported, str) else exported]),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="webintel-dossier-{safe_domain}.json"'}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Universal export failed: {str(e)}")


@router.post("/module")
async def export_single_module(body: UniversalExportModuleRequest):
    """
    Module 6 Independent Module Export:
    Export any individual module independently in CSV, XLSX, or JSON format.
    """
    from services.universal_export import universal_export_service
    fmt = body.format.lower().strip()
    try:
        exported = universal_export_service.export_module(body.module, body.data, format=fmt)

        if fmt in ("xlsx", "excel"):
            return StreamingResponse(
                iter([exported]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{body.module}_export.xlsx"'}
            )
        elif fmt == "csv":
            return StreamingResponse(
                iter([exported.encode("utf-8") if isinstance(exported, str) else exported]),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{body.module}_export.csv"'}
            )
        else:
            return StreamingResponse(
                iter([exported.encode("utf-8") if isinstance(exported, str) else exported]),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{body.module}_export.json"'}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Module export failed: {str(e)}")


def _make_filename(data: dict, ext: str) -> str:
    """Generate a descriptive filename from the analysis data."""
    domain = data.get("domain", "analysis")
    # Clean domain for filename
    safe_domain = "".join(c if c.isalnum() or c in "-_" else "_" for c in domain)
    return f"webintel-{safe_domain}.{ext}"
