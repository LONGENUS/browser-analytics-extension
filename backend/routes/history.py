"""
WebIntel — History Routes
GET /history — Past analysis history from database.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Analysis


router = APIRouter()


@router.get("")
async def list_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List past analyses with pagination.

    Query params:
    - page: Page number (default 1)
    - limit: Items per page (default 20, max 100)
    - domain: Filter by domain (optional)
    """
    try:
        query = select(Analysis).order_by(desc(Analysis.created_at))

        if domain:
            query = query.where(Analysis.domain == domain)

        # Pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        analyses = result.scalars().all()

        return {
            "page": page,
            "limit": limit,
            "items": [
                {
                    "id": a.id,
                    "url": a.url,
                    "domain": a.domain,
                    "title": a.title,
                    "status": a.status,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                    "product_count": len(a.raw_products) if a.raw_products else 0,
                }
                for a in analyses
            ]
        }
    except Exception as e:
        # Return empty list if database is unavailable
        print(f"[WARN] History query failed: {e}")
        return {"page": page, "limit": limit, "items": []}


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full details of a specific analysis."""
    try:
        result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()

        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        return analysis.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete an analysis (soft delete by setting status)."""
    try:
        result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()

        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        analysis.status = "deleted"
        await db.commit()

        return {"status": "deleted", "id": analysis_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")
