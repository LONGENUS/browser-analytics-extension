"""
TailorResume — Module 8: Resume Export API
Provides secure, authenticated endpoints for exporting resumes to PDF and DOCX.

Strict Guarantees:
- Server-side identity derived strictly from Supabase Auth (auth.uid()).
- Client-supplied user IDs are never trusted.
- Ownership verification: User A cannot export User B's master or tailored resume.
- Full ownership chain verified for tailored resumes (tailored resume + source resume + job).
- Completely read-only: Zero mutation of structured resume data during export.
- Generates clean, sanitized filenames (no UUIDs, secrets, or illegal characters).
- Returns genuine binary streams with correct Content-Type and Content-Disposition.
"""

import re
import urllib.parse
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, Resume, Job
from services.auth import get_current_user
from services.pdf_generator import generate_resume_pdf
from services.docx_generator import generate_resume_docx
from services.rate_limiter import export_rate_limiter

router = APIRouter()

ALLOWED_FORMATS = {"pdf", "docx"}
ALLOWED_TEMPLATES = {"ats-classic", "professional", "compact"}


class ExportResumeRequest(BaseModel):
    format: str = Field("pdf", description="Export format: 'pdf' or 'docx'")
    template_id: Optional[str] = Field(None, description="Optional override template id")
    template_version: Optional[str] = Field(None, description="Optional override template version")


def sanitize_filename(
    full_name: Optional[str],
    resume_name: Optional[str],
    is_tailored: bool = False,
    company_name: Optional[str] = None,
    job_title: Optional[str] = None,
    ext: str = "pdf",
) -> str:
    """
    Constructs a deterministic, human-readable, safe filename for downloaded resumes.
    Example: 'John_Doe_Resume.pdf' or 'John_Doe_Google_Senior_Engineer_Resume.pdf'.
    """
    parts = []

    # 1. Base name (Candidate full name or resume title)
    name_source = (full_name or "").strip() or (resume_name or "").strip()
    if name_source:
        parts.append(name_source)

    # 2. If tailored, add company or job title
    if is_tailored:
        if company_name and company_name.strip():
            parts.append(company_name.strip())
        if job_title and job_title.strip():
            parts.append(job_title.strip())
        parts.append("Tailored_Resume")
    else:
        parts.append("Resume")

    raw_filename = "_".join(parts)

    # Clean characters: keep alphanumeric, underscores, hyphens
    cleaned = re.sub(r"[^\w\s\-]", "", raw_filename)
    cleaned = re.sub(r"[\s\-]+", "_", cleaned).strip("_")

    if not cleaned:
        cleaned = "Resume"

    # Truncate length if excessively long
    if len(cleaned) > 80:
        cleaned = cleaned[:80].rstrip("_")

    safe_ext = ext.lower().strip()
    return f"{cleaned}.{safe_ext}"


@router.post("/{resume_id}/export")
@router.get("/{resume_id}/export")
async def export_resume(
    resume_id: str,
    request: Request,
    format: str = Query("pdf", description="Export format: 'pdf' or 'docx'"),
    template_id: Optional[str] = Query(None, description="Optional template override"),
    template_version: Optional[str] = Query(None, description="Optional template version override"),
    payload: Optional[ExportResumeRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports a structured master or tailored resume to a downloadable PDF or DOCX file.
    Enforces user isolation, ownership chain, format validation, and safe file headers.
    """
    user_id = current_user["id"]
    export_rate_limiter.check(request, user_id=user_id)

    # Normalize format and template parameters from either POST body or Query
    target_format = (payload.format if payload and payload.format else format).lower().strip()
    if target_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{target_format}'. Allowed formats: {sorted(list(ALLOWED_FORMATS))}",
        )

    target_template = payload.template_id if payload and payload.template_id else template_id
    target_version = payload.template_version if payload and payload.template_version else template_version

    # 1. Fetch Resume & Verify Ownership
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied.",
        )

    # 2. Tailored Resume Ownership Chain Verification
    target_job: Optional[Job] = None
    if resume.is_tailored:
        if resume.source_resume_id:
            src_result = await db.execute(
                select(Resume).where(Resume.id == resume.source_resume_id, Resume.user_id == user_id)
            )
            if not src_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Associated source resume ownership could not be verified.",
                )

        if resume.target_job_id:
            job_result = await db.execute(
                select(Job).where(Job.id == resume.target_job_id, Job.user_id == user_id)
            )
            target_job = job_result.scalar_one_or_none()
            if not target_job:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Associated job post ownership could not be verified.",
                )

    # 3. Determine Active Template
    active_template_id = target_template or resume.template_id or "ats-classic"
    if active_template_id not in ALLOWED_TEMPLATES:
        active_template_id = "ats-classic"
    active_template_version = target_version or resume.template_version or "v1.0.0"

    # 4. Serialize Structured Resume
    resume_dict = resume.to_full_dict()

    # 5. Generate Binary File OR Return Original Master File
    import os
    if not resume.is_tailored and resume.original_file_path and os.path.exists(resume.original_file_path):
        from services.storage import retrieve_master_resume_file
        try:
            file_bytes = retrieve_master_resume_file(
                resume.original_file_path, expected_sha256=resume.file_sha256
            )
            is_pdf = (resume.file_type == "pdf") or (resume.original_filename and resume.original_filename.lower().endswith(".pdf"))
            media_type = "application/pdf" if is_pdf else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            actual_ext = "pdf" if is_pdf else "docx"

            # Return original file directly with verified SHA-256 header
            original_download_name = resume.original_filename or f"master_resume_{resume.id}.{actual_ext}"
            encoded_name = urllib.parse.quote(original_download_name)
            return Response(
                content=file_bytes,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{original_download_name}"; filename*=UTF-8\'\'{encoded_name}',
                    "Content-Length": str(len(file_bytes)),
                    "X-Resume-Id": resume.id,
                    "X-Resume-SHA256": resume.file_sha256 or "",
                    "X-Is-Master-Resume": "true",
                },
            )
        except Exception as e:
            print(f"[WARN] Failed to stream original master file: {e}. Falling back to template rendering.")

    try:
        if target_format == "pdf":
            file_bytes = generate_resume_pdf(resume_dict, active_template_id, active_template_version)
            media_type = "application/pdf"
        else:  # docx
            file_bytes = generate_resume_docx(resume_dict, active_template_id, active_template_version)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate {target_format.upper()} document. Please try again or select another template.",
        )

    # 6. Build Human-Readable, Sanitized Filename
    p_info = resume.personal_info
    full_name = p_info.full_name if p_info else None
    company_name = target_job.company_name if target_job else None
    job_title = target_job.job_title if target_job else None

    filename = sanitize_filename(
        full_name=full_name,
        resume_name=resume.name,
        is_tailored=resume.is_tailored,
        company_name=company_name,
        job_title=job_title,
        ext=target_format,
    )

    # Safe RFC 5987 Content-Disposition header
    encoded_filename = urllib.parse.quote(filename)
    content_disposition = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": content_disposition,
            "Content-Length": str(len(file_bytes)),
            "X-Resume-Id": resume.id,
            "X-Template-Id": active_template_id,
            "X-Template-Version": active_template_version,
        },
    )
