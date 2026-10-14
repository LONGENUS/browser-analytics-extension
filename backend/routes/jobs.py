"""
TailorResume — Job Ingestion API (Module 4)
Handles job creation, retrieval, updates, and deletion with strict user ownership and isolation.
Guarantees:
- Every route strictly derives identity from Supabase Auth (auth.uid()).
- Client-supplied user IDs are never trusted or accepted.
- User isolation: User A cannot read, update, or delete User B's jobs.
- Duplicate detection by canonical source_url per user.
- Deterministic validation and plain text normalization without LLM dependencies.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Job, Resume, TailoredResume, JobMatch
from services.auth import get_current_user

router = APIRouter()


# --- URL Normalization Utility ---

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "refid", "trackingid", "ref", "fbclid", "gclid", "msclkid", "trk",
    "tracking_id", "li_fat_id", "mc_cid", "mc_eid"
}

def canonicalize_job_url(raw_url: Optional[str]) -> Optional[str]:
    """
    Conservatively normalizes a job posting URL.
    Strips non-essential analytics tracking parameters while strictly preserving
    crucial identification parameters (e.g. currentJobId, jk, id, job_id).
    """
    if not raw_url:
        return None
    url = raw_url.strip()
    if not url:
        return None

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return url

        # Normalize scheme to lower and netloc
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Filter query params
        query_items = parse_qsl(parsed.query, keep_blank_values=True)
        filtered_query = [
            (k, v) for k, v in query_items
            if k.lower() not in TRACKING_PARAMS
        ]

        # Rebuild query
        new_query = urlencode(filtered_query)

        # Remove trailing slash unless root path
        path = parsed.path
        if path != "/" and path.endswith("/"):
            path = path[:-1]

        clean = urlunparse((scheme, netloc, path, parsed.params, new_query, ""))
        return clean
    except Exception:
        return url


# --- Pydantic Schemas ---

ALLOWED_SOURCES = {"linkedin", "naukri", "indeed", "company_site", "job_board", "other"}

class JobCreateSchema(BaseModel):
    job_title: str = Field(..., min_length=1, max_length=255, description="Job title")
    company_name: Optional[str] = Field(None, max_length=255, description="Company or organization name")
    company_url: Optional[str] = Field(None, max_length=500, description="Company website or careers URL")
    location: Optional[str] = Field(None, max_length=255, description="Location or remote indicator")
    source: str = Field("other", max_length=50, description="Platform source")
    source_url: Optional[str] = Field(None, max_length=2048, description="Original job URL")
    employment_type: Optional[str] = Field(None, max_length=100, description="Full-time, Part-time, Contract, etc.")
    work_mode: Optional[str] = Field(None, max_length=50, description="Remote, Hybrid, On-site")
    department: Optional[str] = Field(None, max_length=100, description="Department or business team")
    job_description: str = Field(..., min_length=10, max_length=100000, description="Cleaned job description text")
    requirements: Optional[str] = Field(None, description="Extracted requirements section")
    responsibilities: Optional[str] = Field(None, description="Extracted responsibilities section")
    qualifications: Optional[str] = Field(None, description="Extracted qualifications section")
    salary_text: Optional[str] = Field(None, max_length=255, description="Salary or compensation text")
    job_posted_at: Optional[str] = Field(None, max_length=100, description="Posting date text")

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        s = (v or "").strip().lower()
        if s not in ALLOWED_SOURCES:
            return "other"
        return s

    @field_validator("job_title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        cleaned = re.sub(r"\s+", " ", (v or "").strip())
        if not cleaned:
            raise ValueError("Job title cannot be empty.")
        return cleaned

    @field_validator("job_description")
    @classmethod
    def clean_description(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if len(cleaned) < 10:
            raise ValueError("Job description must contain at least 10 characters.")
        return cleaned


class JobUpdateSchema(BaseModel):
    job_title: Optional[str] = Field(None, min_length=1, max_length=255)
    company_name: Optional[str] = Field(None, max_length=255)
    company_url: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=255)
    source: Optional[str] = Field(None, max_length=50)
    source_url: Optional[str] = Field(None, max_length=2048)
    employment_type: Optional[str] = Field(None, max_length=100)
    work_mode: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    job_description: Optional[str] = Field(None, min_length=10, max_length=100000)
    requirements: Optional[str] = None
    responsibilities: Optional[str] = None
    qualifications: Optional[str] = None
    salary_text: Optional[str] = Field(None, max_length=255)
    job_posted_at: Optional[str] = Field(None, max_length=100)

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip().lower()
        return s if s in ALLOWED_SOURCES else "other"


# --- Routes ---

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreateSchema,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    update_if_exists: bool = Query(False, description="Update job if canonical URL is already saved"),
):
    """
    Saves a new job opportunity for the authenticated user.
    Server derives user_id strictly from Supabase Auth session.
    Checks for existing duplicate by canonical source_url.
    """
    user_id = user["id"]
    canonical_url = canonicalize_job_url(payload.source_url)

    # Duplicate check if source_url is present
    if canonical_url:
        dup_stmt = select(Job).where(
            Job.user_id == user_id,
            Job.source_url == canonical_url
        )
        dup_res = await db.execute(dup_stmt)
        existing_job = dup_res.scalars().first()

        if existing_job:
            if not update_if_exists:
                return {
                    "duplicate": True,
                    "message": "This job is already saved.",
                    "existing_job": existing_job.to_dict(),
                    "job": existing_job.to_dict(),
                }
            # Update existing job in place
            existing_job.job_title = payload.job_title
            existing_job.company_name = payload.company_name
            existing_job.company_url = payload.company_url
            existing_job.location = payload.location
            existing_job.source = payload.source
            existing_job.employment_type = payload.employment_type
            existing_job.work_mode = payload.work_mode
            existing_job.department = payload.department
            existing_job.job_description = payload.job_description
            existing_job.requirements = payload.requirements
            existing_job.responsibilities = payload.responsibilities
            existing_job.qualifications = payload.qualifications
            existing_job.salary_text = payload.salary_text
            existing_job.job_posted_at = payload.job_posted_at
            existing_job.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing_job)
            return {
                "duplicate": False,
                "updated": True,
                "message": "Existing saved job updated.",
                "job": existing_job.to_dict(),
            }

    # Create new job
    new_job = Job(
        id=str(uuid.uuid4()),
        user_id=user_id,
        source=payload.source,
        source_url=canonical_url,
        job_title=payload.job_title,
        company_name=payload.company_name,
        company_url=payload.company_url,
        location=payload.location,
        employment_type=payload.employment_type,
        work_mode=payload.work_mode,
        department=payload.department,
        job_description=payload.job_description,
        requirements=payload.requirements,
        responsibilities=payload.responsibilities,
        qualifications=payload.qualifications,
        salary_text=payload.salary_text,
        job_posted_at=payload.job_posted_at,
        extracted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)

    return {
        "duplicate": False,
        "job": new_job.to_dict(),
    }


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
async def list_jobs(
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Lists saved jobs for the authenticated user, ordered by creation date descending.
    """
    user_id = user["id"]
    stmt = (
        select(Job)
        .where(Job.user_id == user_id)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return [j.to_dict() for j in jobs]


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves a single saved job by ID.
    Strictly verifies user ownership.
    """
    user_id = user["id"]
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    result = await db.execute(stmt)
    job = result.scalars().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or access denied.",
        )

    return job.to_dict()


@router.put("/{job_id}")
@router.patch("/{job_id}")
async def update_job(
    job_id: str,
    payload: JobUpdateSchema,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates an existing saved job.
    User cannot transfer job ownership to another user.
    """
    user_id = user["id"]
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    result = await db.execute(stmt)
    job = result.scalars().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or access denied.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "source_url" in update_data and update_data["source_url"]:
        update_data["source_url"] = canonicalize_job_url(update_data["source_url"])

    for field, val in update_data.items():
        if hasattr(job, field):
            setattr(job, field, val)

    job.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)

    return job.to_dict()


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes a saved job for the authenticated user.
    """
    user_id = user["id"]
    stmt = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    result = await db.execute(stmt)
    job = result.scalars().first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or access denied.",
        )

    # 1. Preserve historical tailored resumes by nullifying target_job_id
    await db.execute(
        update(TailoredResume)
        .where(TailoredResume.target_job_id == job_id)
        .values(target_job_id=None)
    )
    await db.execute(
        update(Resume)
        .where(Resume.target_job_id == job_id)
        .values(target_job_id=None)
    )

    # 2. Clean up associated JobMatch records
    await db.execute(
        delete(JobMatch).where(JobMatch.job_id == job_id)
    )

    await db.delete(job)
    await db.commit()

    return {"deleted": True, "id": job_id}
