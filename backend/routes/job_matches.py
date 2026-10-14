"""
TailorResume — Job ↔ Resume Matching API (Module 5)
Provides deterministic, explainable Job Match analysis comparing a structured
saved job against a structured resume.

Strict Guarantees:
- Authoritative backend calculation (no client-side authority).
- Identity derived strictly from Supabase Auth (auth.uid()).
- Multi-tenant isolation: Confirms job.user_id == user_id AND resume.user_id == user_id.
- Read-only with respect to job and resume contents.
- Freshness tracking: detects stale matches if job or resume was updated after analysis.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Job, Resume, JobMatch, ResumeImport
from services.auth import get_current_user
from services.matching_engine import (
    run_job_match_analysis,
    ALGORITHM_VERSION,
    MATCH_DISCLAIMER,
)
from services.rate_limiter import match_rate_limiter

router = APIRouter()


# --- Pydantic Request & Response Schemas ---

class MatchRequestSchema(BaseModel):
    resume_id: str = Field(..., description="UUID of the user's structured resume")
    force_recalculate: bool = Field(False, description="Force re-running matching engine")


class MatchSummarySchema(BaseModel):
    id: str
    job_id: str
    resume_id: str
    overall_score: int
    match_level: str
    algorithm_version: str
    is_stale: bool
    created_at: Optional[str]


# --- Helper: Stale Check ---

def check_match_freshness(match_created_at: datetime, job_updated_at: datetime, resume_updated_at: datetime) -> bool:
    """Returns True if the match was created before the latest update to the job or resume."""
    if not match_created_at:
        return True
    if job_updated_at and match_created_at < job_updated_at:
        return True
    if resume_updated_at and match_created_at < resume_updated_at:
        return True
    return False


# --- Endpoints ---

@router.post("/{job_id}/match")
async def analyze_job_match(
    job_id: str,
    payload: MatchRequestSchema,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deterministically analyzes alignment between an authenticated user's saved job
    and one of their structured resumes.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user identity required."
        )

    match_rate_limiter.check(request, user_id=user_id)

    # 1. Verify Job Ownership
    job_stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    job_res = await db.execute(job_stmt)
    job = job_res.scalars().first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="We couldn't find this job, or you do not have permission to access it."
        )

    # 2. Verify Resume Ownership
    clean_resume_id = payload.resume_id.replace("draft-", "") if payload.resume_id else payload.resume_id
    is_draft = bool(payload.resume_id and payload.resume_id.startswith("draft-"))

    resume_stmt = select(Resume).where(
        (Resume.id == payload.resume_id) | (Resume.id == clean_resume_id),
        Resume.user_id == user_id,
    )
    resume_res = await db.execute(resume_stmt)
    resume = resume_res.scalars().first()

    if not resume and is_draft:
        # Fallback 1: Check resume_imports table
        import_stmt = select(ResumeImport).where(
            (ResumeImport.id == payload.resume_id) | (ResumeImport.id == clean_resume_id),
            ResumeImport.user_id == user_id,
        )
        import_rec = (await db.execute(import_stmt)).scalars().first()
        if import_rec and import_rec.file_sha256:
            existing_by_sha = await db.execute(
                select(Resume).where(
                    Resume.file_sha256 == import_rec.file_sha256,
                    Resume.user_id == user_id,
                )
            )
            resume = existing_by_sha.scalars().first()

        # Fallback 2: Check user's default master resume
        if not resume:
            default_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_default == True,
                Resume.is_tailored == False,
            )
            resume = (await db.execute(default_stmt)).scalars().first()

        # Fallback 3: Check any master resume for this user
        if not resume:
            any_master_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_tailored == False,
            ).order_by(Resume.created_at.desc())
            resume = (await db.execute(any_master_stmt)).scalars().first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="We couldn't find this resume, or you do not have permission to access it."
        )

    # 3. Check for existing match & freshness (unless force_recalculate is requested)
    if not payload.force_recalculate:
        existing_stmt = select(JobMatch).where(
            JobMatch.user_id == user_id,
            JobMatch.job_id == job.id,
            JobMatch.resume_id == resume.id,
            JobMatch.algorithm_version == ALGORITHM_VERSION,
        ).order_by(JobMatch.created_at.desc()).limit(1)
        existing_res = await db.execute(existing_stmt)
        existing_match = existing_res.scalars().first()

        if existing_match:
            is_stale = check_match_freshness(
                existing_match.created_at, job.updated_at, resume.updated_at
            )
            if not is_stale:
                return {
                    "match_id": existing_match.id,
                    "job_id": job.id,
                    "job_title": job.job_title,
                    "company_name": job.company_name,
                    "resume_id": resume.id,
                    "resume_name": resume.name,
                    "is_stale": False,
                    "cached": True,
                    "overall_score": existing_match.overall_score,
                    "category_scores": existing_match.category_scores,
                    "matched_skills": existing_match.matched_skills,
                    "missing_skills": existing_match.missing_skills,
                    "responsibilities_analysis": existing_match.responsibilities_analysis,
                    "experience_assessment": existing_match.experience_assessment,
                    "qualification_assessment": existing_match.qualification_assessment,
                    "keyword_coverage": existing_match.keyword_coverage,
                    "evidence": existing_match.evidence,
                    "algorithm_version": existing_match.algorithm_version,
                    "disclaimer": MATCH_DISCLAIMER,
                    "created_at": existing_match.created_at.isoformat() if existing_match.created_at else None,
                }

    # 4. Authoritative Calculation via Deterministic Matching Engine
    job_dict = job.to_dict()
    resume_dict = resume.to_full_dict()

    analysis = run_job_match_analysis(job_dict, resume_dict)

    # 5. Persist / Update JobMatch Record
    existing_stmt = select(JobMatch).where(
        JobMatch.user_id == user_id,
        JobMatch.job_id == job.id,
        JobMatch.resume_id == resume.id,
        JobMatch.algorithm_version == ALGORITHM_VERSION,
    )
    existing_res = await db.execute(existing_stmt)
    db_match = existing_res.scalars().first()

    now_utc = datetime.now(timezone.utc)
    if db_match:
        db_match.overall_score = analysis.get("overall_score", 0)
        db_match.category_scores = analysis.get("category_scores", {})
        db_match.matched_skills = analysis.get("matched_skills", [])
        db_match.missing_skills = analysis.get("missing_skills", [])
        db_match.responsibilities_analysis = analysis.get("responsibilities_analysis", [])
        db_match.experience_assessment = analysis.get("experience_assessment", {})
        db_match.qualification_assessment = analysis.get("qualification_assessment", {})
        db_match.keyword_coverage = analysis.get("keyword_coverage", {})
        db_match.evidence = analysis.get("evidence", [])
        db_match.updated_at = now_utc
        match_id = db_match.id
    else:
        new_match = JobMatch(
            id=str(uuid.uuid4()),
            user_id=user_id,
            job_id=job.id,
            resume_id=resume.id,
            overall_score=analysis.get("overall_score", 0),
            category_scores=analysis.get("category_scores", {}),
            matched_skills=analysis.get("matched_skills", []),
            missing_skills=analysis.get("missing_skills", []),
            responsibilities_analysis=analysis.get("responsibilities_analysis", []),
            experience_assessment=analysis.get("experience_assessment", {}),
            qualification_assessment=analysis.get("qualification_assessment", {}),
            keyword_coverage=analysis.get("keyword_coverage", {}),
            evidence=analysis.get("evidence", []),
            algorithm_version=ALGORITHM_VERSION,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(new_match)
        match_id = new_match.id

    await db.commit()

    return {
        "match_id": match_id,
        "job_id": job.id,
        "job_title": job.job_title,
        "company_name": job.company_name,
        "resume_id": resume.id,
        "resume_name": resume.name,
        "is_stale": False,
        "cached": False,
        "created_at": now_utc.isoformat(),
        **analysis,
    }


@router.get("/{job_id}/matches")
async def list_job_matches(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all match analyses for a specific job owned by the authenticated user."""
    user_id = current_user.get("id")

    # Verify job ownership
    job_stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    job_res = await db.execute(job_stmt)
    job = job_res.scalars().first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or access denied."
        )

    stmt = select(JobMatch).where(
        JobMatch.job_id == job_id,
        JobMatch.user_id == user_id
    ).order_by(JobMatch.created_at.desc())

    res = await db.execute(stmt)
    matches = res.scalars().all()

    # Enrich with resume names and staleness
    results = []
    for m in matches:
        resume_stmt = select(Resume).where(Resume.id == m.resume_id)
        resume_res = await db.execute(resume_stmt)
        resume = resume_res.scalars().first()

        is_stale = check_match_freshness(
            m.created_at, job.updated_at, resume.updated_at if resume else None
        )

        results.append({
            "id": m.id,
            "job_id": m.job_id,
            "resume_id": m.resume_id,
            "resume_name": resume.name if resume else "Deleted Resume",
            "overall_score": m.overall_score,
            "category_scores": m.category_scores,
            "algorithm_version": m.algorithm_version,
            "is_stale": is_stale,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return results


@router.get("/matches/{match_id}")
async def get_match_detail(
    match_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full details of a specific match analysis."""
    user_id = current_user.get("id")

    stmt = select(JobMatch).where(JobMatch.id == match_id, JobMatch.user_id == user_id)
    res = await db.execute(stmt)
    match = res.scalars().first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match analysis not found or access denied."
        )

    job_stmt = select(Job).where(Job.id == match.job_id)
    job = (await db.execute(job_stmt)).scalars().first()

    resume_stmt = select(Resume).where(Resume.id == match.resume_id)
    resume = (await db.execute(resume_stmt)).scalars().first()

    is_stale = check_match_freshness(
        match.created_at,
        job.updated_at if job else None,
        resume.updated_at if resume else None
    )

    return {
        "match_id": match.id,
        "job_id": match.job_id,
        "job_title": job.job_title if job else "Unknown Job",
        "company_name": job.company_name if job else None,
        "resume_id": match.resume_id,
        "resume_name": resume.name if resume else "Unknown Resume",
        "is_stale": is_stale,
        "overall_score": match.overall_score,
        "category_scores": match.category_scores,
        "matched_skills": match.matched_skills,
        "missing_skills": match.missing_skills,
        "responsibilities_analysis": match.responsibilities_analysis,
        "experience_assessment": match.experience_assessment,
        "qualification_assessment": match.qualification_assessment,
        "keyword_coverage": match.keyword_coverage,
        "evidence": match.evidence,
        "algorithm_version": match.algorithm_version,
        "disclaimer": MATCH_DISCLAIMER,
        "created_at": match.created_at.isoformat() if match.created_at else None,
    }


@router.delete("/matches/{match_id}")
async def delete_job_match(
    match_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a match analysis record owned by the authenticated user."""
    user_id = current_user.get("id")

    stmt = select(JobMatch).where(JobMatch.id == match_id, JobMatch.user_id == user_id)
    res = await db.execute(stmt)
    match = res.scalars().first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match analysis not found or access denied."
        )

    await db.delete(match)
    await db.commit()

    return {"status": "success", "message": "Match analysis deleted successfully."}
