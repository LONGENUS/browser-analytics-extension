"""
TailorResume — Dashboard Overview API (Module 10)
Provides aggregated, grounded overview data for the authenticated user's central dashboard.

Strict Guarantees:
- Server-side identity derived strictly from Supabase Auth (auth.uid()).
- Real counts computed from persisted user data: Master Resumes, Tailored Resumes, Saved Jobs.
- Zero fake analytics, zero fabricated charts, zero synthetic metrics.
- Recent items strictly grounded in persisted timestamps (created_at / updated_at).
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Resume, Job, TailoredResume
from services.auth import get_current_user

router = APIRouter()


@router.get("/overview")
@router.get("/stats")
async def get_dashboard_overview(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns authentic dashboard overview statistics and recent activity items.
    All data is strictly derived from the authenticated user's persisted records.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required."
        )

    # 1. Real Counts
    # Count Master Resumes (is_tailored == False)
    master_count_res = await db.execute(
        select(func.count(Resume.id)).where(
            and_(Resume.user_id == user_id, Resume.is_tailored == False)
        )
    )
    master_resumes_count = master_count_res.scalar_one_or_none() or 0

    # Count Tailored Resumes (is_tailored == True)
    tailored_count_res = await db.execute(
        select(func.count(Resume.id)).where(
            and_(Resume.user_id == user_id, Resume.is_tailored == True)
        )
    )
    tailored_resumes_count = tailored_count_res.scalar_one_or_none() or 0

    # Count Saved Jobs
    jobs_count_res = await db.execute(
        select(func.count(Job.id)).where(Job.user_id == user_id)
    )
    saved_jobs_count = jobs_count_res.scalar_one_or_none() or 0

    # 2. Recent Items (Derived strictly from timestamps)
    # Recent Master Resumes
    recent_master_res = await db.execute(
        select(Resume)
        .where(and_(Resume.user_id == user_id, Resume.is_tailored == False))
        .order_by(Resume.updated_at.desc())
        .limit(5)
    )
    recent_masters = recent_master_res.scalars().all()

    # Recent Tailored Resumes
    recent_tailored_res = await db.execute(
        select(Resume)
        .where(and_(Resume.user_id == user_id, Resume.is_tailored == True))
        .order_by(Resume.created_at.desc())
        .limit(5)
    )
    recent_tailored = recent_tailored_res.scalars().all()

    # Recent Saved Jobs
    recent_jobs_res = await db.execute(
        select(Job)
        .where(Job.user_id == user_id)
        .order_by(Job.created_at.desc())
        .limit(5)
    )
    recent_jobs = recent_jobs_res.scalars().all()

    # Combine into a unified chronological feed
    recent_items: List[Dict[str, Any]] = []

    for r in recent_masters:
        ts = r.updated_at or r.created_at
        recent_items.append({
            "id": r.id,
            "type": "master_resume",
            "title": r.name,
            "subtitle": "Master Resume" + (" (Default)" if r.is_default else ""),
            "timestamp": ts.isoformat() if ts else None,
            "metadata": {
                "template_id": r.template_id or "ats-classic",
                "is_default": r.is_default,
                "status": r.status,
            }
        })

    for tr in recent_tailored:
        ts = tr.created_at or tr.updated_at
        recent_items.append({
            "id": tr.id,
            "type": "tailored_resume",
            "title": tr.name,
            "subtitle": "Tailored Resume",
            "timestamp": ts.isoformat() if ts else None,
            "metadata": {
                "template_id": tr.template_id or "ats-classic",
                "source_resume_id": tr.source_resume_id,
                "target_job_id": tr.target_job_id,
            }
        })

    for j in recent_jobs:
        ts = j.created_at
        recent_items.append({
            "id": j.id,
            "type": "job",
            "title": j.job_title,
            "subtitle": j.company_name or f"Source: {j.source}",
            "timestamp": ts.isoformat() if ts else None,
            "metadata": {
                "source": j.source,
                "location": j.location,
                "company_name": j.company_name,
            }
        })

    # Sort deterministically by timestamp descending
    recent_items.sort(
        key=lambda x: x["timestamp"] or "",
        reverse=True
    )

    return {
        "status": "success",
        "counts": {
            "master_resumes": master_resumes_count,
            "tailored_resumes": tailored_resumes_count,
            "saved_jobs": saved_jobs_count,
        },
        "recent_items": recent_items[:10],
        "recent_activity": recent_items[:10],
    }
