"""
WebIntel — History Routes
Protected past analysis history linked to authenticated users.
"""

from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Analysis
from services.auth import get_current_user, get_optional_user


router = APIRouter()


@router.get("")
async def list_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    domain: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List past analyses with pagination.
    If authenticated, returns analyses belonging to the current user.
    """
    try:
        query = select(Analysis).order_by(desc(Analysis.created_at))

        # Filter by user if logged in
        if current_user and current_user.get("id"):
            query = query.where(Analysis.user_id == current_user["id"])

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
            "authenticated": bool(current_user),
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
            ],
        }
    except Exception as e:
        print(f"[WARN] History query failed: {e}")
        return {"page": page, "limit": limit, "items": []}


@router.post("", status_code=status.HTTP_201_CREATED)
async def save_analysis(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves a completed analysis linked to the authenticated user.
    """
    try:
        url = data.get("url") or ""
        domain = data.get("domain") or "website"
        title = data.get("title") or domain

        analysis = Analysis(
            user_id=current_user["id"],
            url=url,
            domain=domain,
            title=title,
            status="completed",
            summary=data.get("overview") or {},
            analytics=data.get("products_intelligence") or {},
            seo_data=data.get("seo_intelligence") or {},
            raw_products=data.get("products") or [],
        )

        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)

        return {"success": True, "id": analysis.id, "user_id": current_user["id"]}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to save analysis to history: {str(e)}"
        )


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
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

        # If analysis belongs to a user, enforce ownership check
        if analysis.user_id and current_user and analysis.user_id != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this analysis.",
            )

        return analysis.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an analysis owned by the authenticated user."""
    try:
        result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()

        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        if analysis.user_id and analysis.user_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own saved analyses.",
            )

        analysis.status = "deleted"
        await db.commit()

        return {"status": "deleted", "id": analysis_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")
