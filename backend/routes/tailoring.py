"""
TailorResume — Resume Tailoring API (Module 6)
Provides secure endpoints for generating, reviewing, and saving factually grounded
job-tailored resume drafts.

Strict Guarantees:
- Server-side identity derived strictly from Supabase Auth (auth.uid()).
- Multi-tenant isolation: Source resume and target job must both belong to the authenticated user.
- Master resume immutability: Master resume is never modified or overwritten.
- Saves tailored resumes as distinct, user-owned entities with full source traceability.
- Integrity checks enforced before saving.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import (
    get_db,
    Resume,
    ResumePersonalInfo,
    ResumeSummary,
    ResumeExperience,
    ResumeExperienceBullet,
    ResumeEducation,
    ResumeSkill,
    ResumeProject,
    ResumeProjectBullet,
    ResumeCertification,
    ResumeLink,
    Job,
    TailoredResume,
    ResumeImport,
    ResumeChangeRecord,
)
from services.auth import get_current_user
from services.matching_engine import run_job_match_analysis
from services.tailoring_engine import (
    execute_tailoring_pipeline,
    verify_resume_integrity,
    TailoringOptions,
    TAILORING_ALGORITHM_VERSION,
)
from services.rate_limiter import tailor_rate_limiter
from services.ai.tailoring_orchestrator import execute_ai_tailoring_pipeline
from services.ai.groq_provider import GroqProvider
from services.job_context import InvalidJobDescriptionError
from services.change_tracker import compute_resume_diff

router = APIRouter()


# --- Pydantic Schemas ---

class TailorDraftRequest(BaseModel):
    job_id: str = Field(..., description="Target job UUID")
    tailoring_mode: str = Field("balanced", description="conservative, balanced, or strong")
    prioritize_skills: bool = Field(True)
    prioritize_experience_bullets: bool = Field(True)
    prioritize_projects: bool = Field(True)
    adapt_summary: bool = Field(True)
    concise_mode: bool = Field(False)
    bullet_rewriting: str = Field("balanced")
    use_ai: bool = Field(True, description="Enable context-aware AI tailoring via Groq if configured")


class SaveTailoredResumeRequest(BaseModel):
    job_id: str = Field(..., description="Target job UUID")
    name: str = Field(..., min_length=1, max_length=255, description="Name for the tailored resume")
    tailored_resume: Dict[str, Any] = Field(..., description="Reviewed structured resume data")
    change_log: List[Dict[str, Any]] = Field(default_factory=list, description="User accepted change log")
    tailoring_mode: str = Field("balanced", description="Tailoring mode applied")
    original_match_score: Optional[int] = Field(None)
    tailored_match_score: Optional[int] = Field(None)


class DirectTailorRequest(BaseModel):
    resume_id: str = Field(..., description="Target master resume UUID")
    job_id: str = Field(..., description="Target job UUID")
    name: Optional[str] = Field(None, description="Optional custom name for tailored resume")


# --- Endpoints ---

@router.get("/tailor/ai-status")
async def get_ai_tailoring_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns non-sensitive AI provider configuration and readiness status.
    Never exposes API keys or internal secrets.
    """
    return {
        "provider": "groq",
        "configured": settings.is_groq_configured,
        "model": settings.GROQ_MODEL,
        "base_url": settings.GROQ_BASE_URL,
        "ai_enabled": settings.is_groq_configured,
    }


@router.post("/tailor/verify-model")
async def verify_groq_model(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Queries Groq API /models endpoint to verify if the configured model ID
    is available to the account.
    """
    provider = GroqProvider()
    if not provider.is_configured:
        return {
            "verified": False,
            "model": settings.GROQ_MODEL,
            "error": "GROQ_API_KEY is not configured in .env.local",
        }
    is_valid, err = await provider.verify_model(settings.GROQ_MODEL)
    return {
        "verified": is_valid,
        "model": settings.GROQ_MODEL,
        "error": err,
    }


@router.post("/{resume_id}/tailor")
async def generate_tailored_draft(
    resume_id: str,
    payload: TailorDraftRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates an in-memory job-specific tailored resume draft for user review.
    Uses Groq AI inference when configured; falls back gracefully to deterministic
    rules when offline or unconfigured.
    Does NOT modify or overwrite the source resume.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    tailor_rate_limiter.check(request, user_id=user_id)

    # 1. Verify Source Resume Ownership
    clean_id = resume_id.replace("draft-", "") if resume_id else resume_id
    is_draft = bool(resume_id and resume_id.startswith("draft-"))
    res_stmt = select(Resume).where(
        (Resume.id == resume_id) | (Resume.id == clean_id),
        Resume.user_id == user_id,
    )
    source_resume = (await db.execute(res_stmt)).scalars().first()

    if not source_resume and is_draft:
        # Fallback 1: Check resume_imports table
        import_stmt = select(ResumeImport).where(
            (ResumeImport.id == resume_id) | (ResumeImport.id == clean_id),
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
            source_resume = existing_by_sha.scalars().first()

        # Fallback 2: Check user's default master resume
        if not source_resume:
            default_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_default == True,
                Resume.is_tailored == False,
            )
            source_resume = (await db.execute(default_stmt)).scalars().first()

        # Fallback 3: Check any master resume for this user
        if not source_resume:
            any_master_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_tailored == False,
            ).order_by(Resume.created_at.desc())
            source_resume = (await db.execute(any_master_stmt)).scalars().first()

    if not source_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source resume not found or access denied."
        )

    # 2. Verify Target Job Ownership
    job_stmt = select(Job).where(Job.id == payload.job_id, Job.user_id == user_id)
    job = (await db.execute(job_stmt)).scalars().first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target job not found or access denied."
        )

    # 3. Load structured dictionaries
    source_resume_dict = source_resume.to_full_dict()
    job_dict = job.to_dict()

    # 4. Configure options
    options = TailoringOptions(
        tailoring_mode=payload.tailoring_mode,
        prioritize_skills=payload.prioritize_skills,
        prioritize_experience_bullets=payload.prioritize_experience_bullets,
        prioritize_projects=payload.prioritize_projects,
        adapt_summary=payload.adapt_summary,
        concise_mode=payload.concise_mode,
        bullet_rewriting=payload.bullet_rewriting,
    )

    # 5. Execute AI or deterministic tailoring
    try:
        if payload.use_ai and settings.is_groq_configured:
            result = await execute_ai_tailoring_pipeline(source_resume_dict, job_dict, options=options)
        else:
            result = execute_tailoring_pipeline(source_resume_dict, job_dict, options=options)
            if payload.use_ai and not settings.is_groq_configured:
                result["ai_metadata"] = {
                    "ai_enabled": False,
                    "provider": "groq",
                    "model": settings.GROQ_MODEL,
                    "reason": "GROQ_API_KEY is not configured in .env.local. Executed deterministic engine.",
                }
    except InvalidJobDescriptionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "status": "success",
        "source_resume_id": source_resume.id,
        "source_resume_name": source_resume.name,
        "target_job_id": job.id,
        "job_id": job.id,
        "job_title": job.job_title,
        "company_name": job.company_name,
        **result,
    }


@router.post("/{resume_id}/tailor/save")
async def save_tailored_resume(
    resume_id: str,
    payload: SaveTailoredResumeRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Persists the reviewed tailored resume as a NEW, separate structured resume entity.
    Guarantees master resume immutability.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    tailor_rate_limiter.check(request, user_id=user_id)

    # 1. Verify Source Resume Ownership
    clean_id = resume_id.replace("draft-", "") if resume_id else resume_id
    is_draft = bool(resume_id and resume_id.startswith("draft-"))
    res_stmt = select(Resume).where(
        (Resume.id == resume_id) | (Resume.id == clean_id),
        Resume.user_id == user_id,
    )
    source_resume = (await db.execute(res_stmt)).scalars().first()

    if not source_resume and is_draft:
        # Fallback 1: Check resume_imports table
        import_stmt = select(ResumeImport).where(
            (ResumeImport.id == resume_id) | (ResumeImport.id == clean_id),
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
            source_resume = existing_by_sha.scalars().first()

        # Fallback 2: Check user's default master resume
        if not source_resume:
            default_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_default == True,
                Resume.is_tailored == False,
            )
            source_resume = (await db.execute(default_stmt)).scalars().first()

        # Fallback 3: Check any master resume for this user
        if not source_resume:
            any_master_stmt = select(Resume).where(
                Resume.user_id == user_id,
                Resume.is_tailored == False,
            ).order_by(Resume.created_at.desc())
            source_resume = (await db.execute(any_master_stmt)).scalars().first()

    if not source_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source resume not found or access denied."
        )

    # 2. Verify Target Job Ownership
    job_stmt = select(Job).where(Job.id == payload.job_id, Job.user_id == user_id)
    job = (await db.execute(job_stmt)).scalars().first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target job not found or access denied."
        )

    tailored_data = payload.tailored_resume

    # 3. Enforce Strict Factual Integrity Check
    source_dict = source_resume.to_full_dict()
    integrity_ok, integrity_err = verify_resume_integrity(source_dict, tailored_data)
    if not integrity_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Factual integrity validation failed: {integrity_err}"
        )

    # 4. Create New Resume Entity (Zero mutation to master resume)
    new_resume_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)

    new_resume = Resume(
        id=new_resume_id,
        user_id=user_id,
        name=payload.name.strip(),
        is_default=False,  # Tailored resumes are never default master resumes
        status="ready",
        source_resume_id=source_resume.id,
        target_job_id=job.id,
        is_tailored=True,
        template_id=getattr(source_resume, "template_id", "ats-classic") or "ats-classic",
        template_version=getattr(source_resume, "template_version", "v1.0.0") or "v1.0.0",
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(new_resume)

    # Personal Information
    p_info = tailored_data.get("personal_info") or {}
    personal_info = ResumePersonalInfo(
        id=str(uuid.uuid4()),
        resume_id=new_resume_id,
        full_name=p_info.get("full_name"),
        headline=p_info.get("headline"),
        email=p_info.get("email"),
        phone=p_info.get("phone"),
        location=p_info.get("location"),
        website=p_info.get("website"),
        linkedin_url=p_info.get("linkedin_url"),
        github_url=p_info.get("github_url"),
        portfolio_url=p_info.get("portfolio_url"),
    )
    db.add(personal_info)

    # Professional Summary
    sum_data = tailored_data.get("summary") or {}
    summary_text = sum_data.get("summary") or sum_data.get("content") or ""
    summary_obj = ResumeSummary(
        id=str(uuid.uuid4()),
        resume_id=new_resume_id,
        summary=summary_text,
    )
    db.add(summary_obj)

    # Experiences & Bullets
    for exp_order, exp in enumerate(tailored_data.get("experiences") or []):
        exp_id = str(uuid.uuid4())
        db_exp = ResumeExperience(
            id=exp_id,
            resume_id=new_resume_id,
            company=exp.get("company") or exp.get("company_name", "Company"),
            job_title=exp.get("job_title", "Position"),
            location=exp.get("location"),
            employment_type=exp.get("employment_type"),
            start_date=exp.get("start_date"),
            end_date=exp.get("end_date"),
            is_current=exp.get("is_current", False),
            description=exp.get("description"),
            display_order=exp_order,
        )
        db.add(db_exp)

        for b_order, bullet in enumerate(exp.get("bullets") or []):
            b_text = bullet.get("content", "") if isinstance(bullet, dict) else str(bullet)
            db_bullet = ResumeExperienceBullet(
                id=str(uuid.uuid4()),
                experience_id=exp_id,
                content=b_text,
                display_order=b_order,
            )
            db.add(db_bullet)

    # Skills
    for s_order, sk in enumerate(tailored_data.get("skills") or []):
        s_name = (sk.get("skill_name") or sk.get("name") or "").strip()
        if s_name:
            db_skill = ResumeSkill(
                id=str(uuid.uuid4()),
                resume_id=new_resume_id,
                skill_name=s_name,
                category=sk.get("category", "Technical"),
                display_order=s_order,
            )
            db.add(db_skill)

    # Projects & Project Bullets
    for p_order, proj in enumerate(tailored_data.get("projects") or []):
        proj_id = str(uuid.uuid4())
        tech_val = proj.get("technologies") or ""
        db_proj = ResumeProject(
            id=proj_id,
            resume_id=new_resume_id,
            name=proj.get("name", "Project"),
            description=proj.get("description"),
            url=proj.get("url"),
            technologies=", ".join(tech_val) if isinstance(tech_val, list) else str(tech_val),
            display_order=p_order,
        )
        db.add(db_proj)

        for pb_order, pb in enumerate(proj.get("bullets") or []):
            pb_text = pb.get("content", "") if isinstance(pb, dict) else str(pb)
            db_pb = ResumeProjectBullet(
                id=str(uuid.uuid4()),
                project_id=proj_id,
                content=pb_text,
                display_order=pb_order,
            )
            db.add(db_pb)

    # Educations
    for edu_order, edu in enumerate(tailored_data.get("educations") or []):
        db_edu = ResumeEducation(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            institution=edu.get("institution", "Institution"),
            degree=edu.get("degree"),
            field_of_study=edu.get("field_of_study"),
            location=edu.get("location"),
            start_date=edu.get("start_date"),
            end_date=edu.get("end_date"),
            description=edu.get("description"),
            display_order=edu_order,
        )
        db.add(db_edu)

    # Certifications
    for cert_order, cert in enumerate(tailored_data.get("certifications") or []):
        c_name = cert.get("name") if isinstance(cert, dict) else str(cert)
        db_cert = ResumeCertification(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            name=c_name,
            issuer=cert.get("issuer") or cert.get("issuing_organization") if isinstance(cert, dict) else None,
            issue_date=cert.get("issue_date") if isinstance(cert, dict) else None,
            expiration_date=cert.get("expiration_date") if isinstance(cert, dict) else None,
            credential_id=cert.get("credential_id") if isinstance(cert, dict) else None,
            credential_url=cert.get("credential_url") if isinstance(cert, dict) else None,
            display_order=cert_order,
        )
        db.add(db_cert)

    # Links
    for link_order, link in enumerate(tailored_data.get("links") or []):
        db_link = ResumeLink(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            label=link.get("label", "Link"),
            url=link.get("url", ""),
            display_order=link_order,
        )
        db.add(db_link)

    # 5. Record Tailored Resume Metadata (public.tailored_resumes)
    tailored_meta = TailoredResume(
        id=str(uuid.uuid4()),
        user_id=user_id,
        source_resume_id=source_resume.id,
        target_job_id=job.id,
        tailored_resume_id=new_resume_id,
        tailoring_mode=payload.tailoring_mode,
        tailoring_plan=tailored_data.get("tailoring_plan") or {},
        change_log=payload.change_log,
        original_match_score=payload.original_match_score,
        tailored_match_score=payload.tailored_match_score,
        algorithm_version=TAILORING_ALGORITHM_VERSION,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(tailored_meta)

    await db.commit()

    loaded_stmt = select(Resume).where(Resume.id == new_resume.id)
    loaded_resume = (await db.execute(loaded_stmt)).scalars().first()

    return {
        "status": "success",
        "message": "Tailored resume saved successfully as a separate version.",
        "tailored_resume_id": new_resume.id,
        "tailored_resume": loaded_resume.to_full_dict() if loaded_resume else payload.tailored_resume,
        "source_resume_id": source_resume.id,
        "target_job_id": job.id,
    }


@router.post("/direct-tailor")
async def direct_tailor_resume(
    payload: DirectTailorRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Directly generates and persists a tailored resume from the selected master resume
    and target job description using the server-side AI provider (Groq) or deterministic pipeline.
    Preserves original document formatting & structure, never overwrites master resume.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    tailor_rate_limiter.check(request, user_id=user_id)

    # 1. Look up master resume
    clean_id = payload.resume_id.replace("draft-", "") if payload.resume_id else payload.resume_id
    res_stmt = select(Resume).where(
        (Resume.id == payload.resume_id) | (Resume.id == clean_id),
        Resume.user_id == user_id,
    )
    source_resume = (await db.execute(res_stmt)).scalars().first()

    if not source_resume:
        import_stmt = select(ResumeImport).where(
            (ResumeImport.id == payload.resume_id) | (ResumeImport.id == clean_id),
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
            source_resume = existing_by_sha.scalars().first()

    if not source_resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master resume not found or access denied.")

    if source_resume.is_tailored:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected resume is already a tailored resume. Please choose a master resume as the source.")

    # 2. Look up job
    job_stmt = select(Job).where(Job.id == payload.job_id, Job.user_id == user_id)
    job = (await db.execute(job_stmt)).scalars().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target job not found or access denied.")

    # 3. Generate tailored content using configured pipeline
    job_dict = job.to_dict()
    source_dict = source_resume.to_full_dict()

    opts = TailoringOptions(
        tailoring_mode="balanced",
        prioritize_skills=True,
        prioritize_experience_bullets=True,
        prioritize_projects=True,
        adapt_summary=True,
        concise_mode=False,
        bullet_rewriting="balanced",
    )

    if settings.is_groq_configured:
        try:
            result = await execute_ai_tailoring_pipeline(source_dict, job_dict, options=opts)
        except Exception:
            result = execute_tailoring_pipeline(source_dict, job_dict, options=opts)
    else:
        result = execute_tailoring_pipeline(source_dict, job_dict, options=opts)

    tailored_data = result.get("tailored_resume") or source_dict
    change_log = result.get("change_log") or []

    # 4. Save as a separate tailored resume record
    new_resume_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    job_title_short = (job.job_title or "Target Job")[:40]
    tailored_name = (payload.name or f"Tailored — {job_title_short}").strip()

    new_resume = Resume(
        id=new_resume_id,
        user_id=user_id,
        name=tailored_name[:250],
        is_default=False,
        status="ready",
        source_resume_id=source_resume.id,
        target_job_id=job.id,
        is_tailored=True,
        template_id=source_resume.template_id or "ats-classic",
        template_version=source_resume.template_version or "v1.0.0",
        original_filename=source_resume.original_filename,
        original_file_path=source_resume.original_file_path,
        original_file_data=source_resume.original_file_data,
        file_type=source_resume.file_type,
        file_size=source_resume.file_size,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(new_resume)

    # Personal Information
    p_info = tailored_data.get("personal_info") or {}
    personal_info = ResumePersonalInfo(
        id=str(uuid.uuid4()),
        resume_id=new_resume_id,
        full_name=p_info.get("full_name"),
        headline=p_info.get("headline"),
        email=p_info.get("email"),
        phone=p_info.get("phone"),
        location=p_info.get("location"),
        website=p_info.get("website"),
        linkedin_url=p_info.get("linkedin_url"),
        github_url=p_info.get("github_url"),
        portfolio_url=p_info.get("portfolio_url"),
    )
    db.add(personal_info)

    # Professional Summary
    sum_data = tailored_data.get("summary") or {}
    summary_text = sum_data.get("summary") or sum_data.get("content") or ""
    summary_obj = ResumeSummary(
        id=str(uuid.uuid4()),
        resume_id=new_resume_id,
        summary=summary_text,
    )
    db.add(summary_obj)

    # Experiences & Bullets
    for exp_order, exp in enumerate(tailored_data.get("experiences") or []):
        exp_id = str(uuid.uuid4())
        db_exp = ResumeExperience(
            id=exp_id,
            resume_id=new_resume_id,
            company=exp.get("company") or exp.get("company_name", "Company"),
            job_title=exp.get("job_title", "Position"),
            location=exp.get("location"),
            employment_type=exp.get("employment_type"),
            start_date=exp.get("start_date"),
            end_date=exp.get("end_date"),
            is_current=exp.get("is_current", False),
            description=exp.get("description"),
            display_order=exp_order,
        )
        db.add(db_exp)

        for b_order, bullet in enumerate(exp.get("bullets") or []):
            b_text = bullet.get("content", "") if isinstance(bullet, dict) else str(bullet)
            db_bullet = ResumeExperienceBullet(
                id=str(uuid.uuid4()),
                experience_id=exp_id,
                content=b_text,
                display_order=b_order,
            )
            db.add(db_bullet)

    # Skills
    for s_order, sk in enumerate(tailored_data.get("skills") or []):
        s_name = (sk.get("skill_name") or sk.get("name") or "").strip()
        if s_name:
            db_skill = ResumeSkill(
                id=str(uuid.uuid4()),
                resume_id=new_resume_id,
                skill_name=s_name,
                category=sk.get("category", "Technical") if isinstance(sk, dict) else "Technical",
                display_order=s_order,
            )
            db.add(db_skill)

    # Projects
    for p_order, proj in enumerate(tailored_data.get("projects") or []):
        proj_id = str(uuid.uuid4())
        tech_val = proj.get("technologies") or ""
        db_proj = ResumeProject(
            id=proj_id,
            resume_id=new_resume_id,
            name=proj.get("name", "Project"),
            description=proj.get("description"),
            url=proj.get("url"),
            technologies=", ".join(tech_val) if isinstance(tech_val, list) else str(tech_val),
            display_order=p_order,
        )
        db.add(db_proj)

        for pb_order, pb in enumerate(proj.get("bullets") or []):
            pb_text = pb.get("content", "") if isinstance(pb, dict) else str(pb)
            db_pb = ResumeProjectBullet(
                id=str(uuid.uuid4()),
                project_id=proj_id,
                content=pb_text,
                display_order=pb_order,
            )
            db.add(db_pb)

    # Educations
    for edu_order, edu in enumerate(tailored_data.get("educations") or []):
        db_edu = ResumeEducation(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            institution=edu.get("institution", "Institution"),
            degree=edu.get("degree"),
            field_of_study=edu.get("field_of_study"),
            location=edu.get("location"),
            start_date=edu.get("start_date"),
            end_date=edu.get("end_date"),
            description=edu.get("description"),
            display_order=edu_order,
        )
        db.add(db_edu)

    # Certifications
    for cert_order, cert in enumerate(tailored_data.get("certifications") or []):
        c_name = cert.get("name") if isinstance(cert, dict) else str(cert)
        db_cert = ResumeCertification(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            name=c_name,
            issuer=cert.get("issuer") if isinstance(cert, dict) else None,
            issue_date=cert.get("issue_date") if isinstance(cert, dict) else None,
            expiration_date=cert.get("expiration_date") if isinstance(cert, dict) else None,
            display_order=cert_order,
        )
        db.add(db_cert)

    # Links
    for link_order, link in enumerate(tailored_data.get("links") or []):
        db_link = ResumeLink(
            id=str(uuid.uuid4()),
            resume_id=new_resume_id,
            label=link.get("label", "Link"),
            url=link.get("url", ""),
            display_order=link_order,
        )
        db.add(db_link)

    # Compute and persist precise change records between source and tailored resumes
    diff_changes = compute_resume_diff(
        source_resume=source_dict,
        tailored_resume=tailored_data,
        source_id=source_resume.id,
        tailored_id=new_resume_id,
    )
    for ch in diff_changes:
        ch_rec = ResumeChangeRecord(
            id=ch.get("id") or str(uuid.uuid4()),
            user_id=user_id,
            source_resume_id=source_resume.id,
            tailored_resume_id=new_resume_id,
            section=ch["section"],
            paragraph_id=ch["paragraph_id"],
            section_title=ch["section_title"],
            item_title=ch.get("item_title"),
            change_type=ch["change_type"],
            original_text=ch.get("original_text"),
            proposed_text=ch.get("proposed_text"),
            diff_segments=ch.get("diff_segments") or [],
            explanation=ch.get("explanation"),
            status=ch.get("status", "accepted"),
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(ch_rec)

    # TailoredResume audit/metadata
    tailored_meta = TailoredResume(
        id=str(uuid.uuid4()),
        user_id=user_id,
        source_resume_id=source_resume.id,
        target_job_id=job.id,
        tailored_resume_id=new_resume_id,
        tailoring_mode="balanced",
        tailoring_plan=result.get("tailoring_plan") or {},
        change_log=diff_changes,
        original_match_score=result.get("original_match_score"),
        tailored_match_score=result.get("tailored_match_score"),
        algorithm_version=TAILORING_ALGORITHM_VERSION,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(tailored_meta)
    await db.commit()

    return {
        "status": "success",
        "message": "Tailored resume generated and saved successfully.",
        "tailored_resume_id": new_resume.id,
        "name": new_resume.name,
        "source_resume_id": source_resume.id,
        "source_resume_name": source_resume.name,
        "target_job_id": job.id,
        "target_job_title": job.job_title,
        "target_company_name": job.company_name,
        "preview_url": f"/api/resumes/{new_resume.id}/export?format=pdf&inline=true",
        "download_pdf_url": f"/api/resumes/{new_resume.id}/export?format=pdf",
        "download_docx_url": f"/api/resumes/{new_resume.id}/export?format=docx",
        "created_at": now_utc.isoformat(),
    }


@router.get("/tailored")
@router.get("/tailored/list")
async def list_tailored_resumes(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all tailored resumes belonging to the authenticated user with rich metadata:
    target job title & company, source master resume name, template, and stale status.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    # 1. Fetch TailoredResume records
    tr_stmt = (
        select(TailoredResume)
        .where(TailoredResume.user_id == user_id)
        .order_by(TailoredResume.created_at.desc())
    )
    records = (await db.execute(tr_stmt)).scalars().all()

    # 2. Collect IDs to bulk fetch related records
    tailored_resume_ids = {r.tailored_resume_id for r in records if r.tailored_resume_id}
    source_resume_ids = {r.source_resume_id for r in records if r.source_resume_id}
    job_ids = {r.target_job_id for r in records if r.target_job_id}

    all_res_ids = list(tailored_resume_ids | source_resume_ids)
    res_map = {}
    if all_res_ids:
        res_stmt = select(Resume).where(Resume.id.in_(all_res_ids), Resume.user_id == user_id)
        res_rows = (await db.execute(res_stmt)).scalars().all()
        res_map = {r.id: r for r in res_rows}

    job_map = {}
    if job_ids:
        job_stmt = select(Job).where(Job.id.in_(list(job_ids)), Job.user_id == user_id)
        job_rows = (await db.execute(job_stmt)).scalars().all()
        job_map = {j.id: j for j in job_rows}

    results = []
    seen_tailored_resume_ids = set()

    for r in records:
        d = r.to_dict()
        tailored_res = res_map.get(r.tailored_resume_id)
        source_res = res_map.get(r.source_resume_id) if r.source_resume_id else None
        job_item = job_map.get(r.target_job_id) if r.target_job_id else None

        d["name"] = tailored_res.name if tailored_res else "Tailored Resume"
        d["tailored_resume_name"] = tailored_res.name if tailored_res else "Tailored Resume"
        d["template_id"] = (tailored_res.template_id if tailored_res else "ats-classic") or "ats-classic"
        d["template_version"] = (tailored_res.template_version if tailored_res else "v1.0.0") or "v1.0.0"

        # Source resume info
        d["source_resume_name"] = source_res.name if source_res else None
        d["source_resume_deleted"] = bool(r.source_resume_id and not source_res)

        # Target job info
        d["target_job_title"] = job_item.job_title if job_item else None
        d["target_company_name"] = job_item.company_name if job_item else None
        d["target_job_deleted"] = bool(r.target_job_id and not job_item)

        # Stale detection: source resume modified after tailored resume creation
        is_stale = False
        if source_res and source_res.updated_at and r.created_at:
            if source_res.updated_at > r.created_at:
                is_stale = True
        d["is_stale"] = is_stale

        results.append(d)
        if r.tailored_resume_id:
            seen_tailored_resume_ids.add(r.tailored_resume_id)

    # Also include any resumes where is_tailored=True that might not have a TailoredResume row
    tailored_res_stmt = (
        select(Resume)
        .where(Resume.user_id == user_id, Resume.is_tailored == True)
        .order_by(Resume.created_at.desc())
    )
    all_tailored_resumes = (await db.execute(tailored_res_stmt)).scalars().all()
    for tr in all_tailored_resumes:
        if tr.id not in seen_tailored_resume_ids:
            src = res_map.get(tr.source_resume_id) if tr.source_resume_id else None
            jb = job_map.get(tr.target_job_id) if tr.target_job_id else None
            results.append({
                "id": tr.id,
                "user_id": user_id,
                "source_resume_id": tr.source_resume_id,
                "target_job_id": tr.target_job_id,
                "job_id": tr.target_job_id,
                "tailored_resume_id": tr.id,
                "resume_id": tr.id,
                "name": tr.name,
                "tailored_resume_name": tr.name,
                "tailoring_mode": "balanced",
                "tailoring_plan": {},
                "change_log": [],
                "original_match_score": None,
                "tailored_match_score": None,
                "algorithm_version": "v1",
                "template_id": tr.template_id or "ats-classic",
                "template_version": tr.template_version or "v1.0.0",
                "source_resume_name": src.name if src else None,
                "source_resume_deleted": bool(tr.source_resume_id and not src),
                "target_job_title": jb.job_title if jb else None,
                "target_company_name": jb.company_name if jb else None,
                "target_job_deleted": bool(tr.target_job_id and not jb),
                "is_stale": False,
                "created_at": tr.created_at.isoformat() if tr.created_at else None,
                "updated_at": tr.updated_at.isoformat() if tr.updated_at else None,
            })

    return results


@router.get("/tailored/{tailoring_id}")
async def get_tailored_resume_detail(
    tailoring_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full metadata and change log of a tailored resume."""
    user_id = current_user.get("id")
    stmt = select(TailoredResume).where(
        TailoredResume.id == tailoring_id,
        TailoredResume.user_id == user_id
    )
    record = (await db.execute(stmt)).scalars().first()
    if not record:
        # Check by tailored_resume_id as fallback
        stmt2 = select(TailoredResume).where(
            TailoredResume.tailored_resume_id == tailoring_id,
            TailoredResume.user_id == user_id
        )
        record = (await db.execute(stmt2)).scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tailored resume record not found or access denied."
        )
    return record.to_dict()


@router.delete("/tailored/{tailoring_id}")
async def delete_tailored_resume(
    tailoring_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a tailored resume and cleans up its structured resume entity and metadata.
    """
    user_id = current_user.get("id")
    stmt = select(TailoredResume).where(
        TailoredResume.id == tailoring_id,
        TailoredResume.user_id == user_id
    )
    record = (await db.execute(stmt)).scalars().first()

    tailored_resume_id = None
    if record:
        tailored_resume_id = record.tailored_resume_id
        await db.delete(record)
    else:
        # Check if tailoring_id was the resume ID
        tailored_resume_id = tailoring_id

    if tailored_resume_id:
        res_stmt = select(Resume).where(Resume.id == tailored_resume_id, Resume.user_id == user_id)
        res_item = (await db.execute(res_stmt)).scalars().first()
        if res_item:
            await db.delete(res_item)

    await db.commit()
    return {"deleted": True, "id": tailoring_id}


# ==============================================================================
# AI CHANGE TRACKING & REVIEW ENDPOINTS
# ==============================================================================

class ChangeReviewPayload(BaseModel):
    status: str = Field(..., description="'accepted' or 'rejected'")


class BatchReviewPayload(BaseModel):
    action: str = Field(..., description="'accept_all' or 'reject_all'")


@router.get("/{resume_id}/changes")
async def get_tailored_resume_changes(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves the complete AI change tracking records for a given tailored resume.
    If change records were not previously stored, computes them dynamically against the source resume.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    # 1. Fetch Tailored Resume
    res_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    resume = (await db.execute(res_stmt)).scalars().first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tailored resume not found or access denied.")

    # 2. Check existing change records
    ch_stmt = select(ResumeChangeRecord).where(
        ResumeChangeRecord.tailored_resume_id == resume_id,
        ResumeChangeRecord.user_id == user_id,
    ).order_by(ResumeChangeRecord.created_at)
    records = (await db.execute(ch_stmt)).scalars().all()

    source_resume = None
    if resume.source_resume_id:
        src_stmt = select(Resume).where(Resume.id == resume.source_resume_id, Resume.user_id == user_id)
        source_resume = (await db.execute(src_stmt)).scalars().first()

    # 3. If records don't exist yet, compute dynamically from source resume
    if not records and source_resume:
        diff_changes = compute_resume_diff(
            source_resume=source_resume.to_full_dict(),
            tailored_resume=resume.to_full_dict(),
            source_id=source_resume.id,
            tailored_id=resume.id,
        )
        now_utc = datetime.now(timezone.utc)
        records = []
        for ch in diff_changes:
            rec = ResumeChangeRecord(
                id=ch.get("id") or str(uuid.uuid4()),
                user_id=user_id,
                source_resume_id=source_resume.id,
                tailored_resume_id=resume.id,
                section=ch["section"],
                paragraph_id=ch["paragraph_id"],
                section_title=ch["section_title"],
                item_title=ch.get("item_title"),
                change_type=ch["change_type"],
                original_text=ch.get("original_text"),
                proposed_text=ch.get("proposed_text"),
                diff_segments=ch.get("diff_segments") or [],
                explanation=ch.get("explanation"),
                status=ch.get("status", "accepted"),
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(rec)
            records.append(rec)
        await db.commit()

    changes_dict = [r.to_dict() for r in records]
    added_count = sum(1 for c in changes_dict if c["change_type"] == "added")
    modified_count = sum(1 for c in changes_dict if c["change_type"] == "modified")
    removed_count = sum(1 for c in changes_dict if c["change_type"] == "removed")
    unchanged_count = sum(1 for c in changes_dict if c["change_type"] == "unchanged")

    return {
        "status": "success",
        "tailored_resume_id": resume.id,
        "tailored_resume_name": resume.name,
        "source_resume_id": resume.source_resume_id,
        "source_resume_name": source_resume.name if source_resume else "Source Master Resume",
        "total_changes": added_count + modified_count + removed_count,
        "counts": {
            "added": added_count,
            "modified": modified_count,
            "removed": removed_count,
            "unchanged": unchanged_count,
        },
        "changes": changes_dict,
    }


@router.post("/{resume_id}/changes/{change_id}/review")
async def review_resume_change(
    resume_id: str,
    change_id: str,
    payload: ChangeReviewPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts or rejects an individual AI change.
    When rejected, the underlying resume entity is cleanly reverted to original source text.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    # 1. Fetch Change Record
    stmt = select(ResumeChangeRecord).where(
        ResumeChangeRecord.id == change_id,
        ResumeChangeRecord.tailored_resume_id == resume_id,
        ResumeChangeRecord.user_id == user_id,
    )
    change = (await db.execute(stmt)).scalars().first()
    if not change:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Change record not found or access denied.")

    # 2. Fetch Resume Record
    res_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    resume = (await db.execute(res_stmt)).scalars().first()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found or access denied.")

    new_status = payload.status.lower().strip()
    if new_status not in ("accepted", "rejected", "pending"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'accepted' or 'rejected'.")

    target_text = change.proposed_text if new_status == "accepted" else (change.original_text or "")

    # 3. Apply target text to live Resume entities
    if change.section == "summary":
        sum_stmt = select(ResumeSummary).where(ResumeSummary.resume_id == resume_id)
        summary_obj = (await db.execute(sum_stmt)).scalars().first()
        if summary_obj:
            summary_obj.summary = target_text
            summary_obj.updated_at = datetime.now(timezone.utc)
    elif change.section == "experience_bullet":
        m = re.match(r"exp_(\d+)_b_(\d+)", change.paragraph_id)
        if m:
            e_idx = int(m.group(1))
            b_idx = int(m.group(2))
            exp_stmt = select(ResumeExperience).where(
                ResumeExperience.resume_id == resume_id
            ).order_by(ResumeExperience.display_order)
            exps = (await db.execute(exp_stmt)).scalars().all()
            if e_idx < len(exps):
                exp_rec = exps[e_idx]
                bullet_stmt = select(ResumeExperienceBullet).where(
                    ResumeExperienceBullet.experience_id == exp_rec.id
                ).order_by(ResumeExperienceBullet.display_order)
                bullets = (await db.execute(bullet_stmt)).scalars().all()
                if b_idx < len(bullets):
                    bullets[b_idx].content = target_text
        else:
            exp_stmt = select(ResumeExperience).where(ResumeExperience.resume_id == resume_id)
            exps = (await db.execute(exp_stmt)).scalars().all()
            for exp_rec in exps:
                bullet_stmt = select(ResumeExperienceBullet).where(
                    ResumeExperienceBullet.experience_id == exp_rec.id
                )
                bullets = (await db.execute(bullet_stmt)).scalars().all()
                for b in bullets:
                    if b.content in (change.proposed_text, change.original_text):
                        b.content = target_text
                        break
    elif change.section == "skills":
        if change.change_type == "added" and new_status == "rejected":
            await db.execute(
                delete(ResumeSkill).where(
                    ResumeSkill.resume_id == resume_id,
                    ResumeSkill.skill_name == change.proposed_text,
                )
            )
        elif change.change_type == "removed" and new_status == "rejected":
            restored_skill = ResumeSkill(
                id=str(uuid.uuid4()),
                resume_id=resume_id,
                skill_name=change.original_text or "",
                category="Technical",
                display_order=99,
            )
            db.add(restored_skill)
    elif change.section == "project":
        proj_stmt = select(ResumeProject).where(ResumeProject.resume_id == resume_id)
        projs = (await db.execute(proj_stmt)).scalars().all()
        for p in projs:
            if p.description in (change.proposed_text, change.original_text):
                p.description = target_text

    # 4. Update change status
    change.status = new_status
    change.updated_at = datetime.now(timezone.utc)

    # 5. Sync TailoredResume.change_log if present
    tailored_meta_stmt = select(TailoredResume).where(
        TailoredResume.tailored_resume_id == resume_id,
        TailoredResume.user_id == user_id,
    )
    tailored_meta = (await db.execute(tailored_meta_stmt)).scalars().first()
    if tailored_meta and tailored_meta.change_log:
        updated_log = []
        for item in tailored_meta.change_log:
            if item.get("id") == change_id or item.get("paragraph_id") == change.paragraph_id:
                item["status"] = new_status
            updated_log.append(item)
        tailored_meta.change_log = updated_log

    await db.commit()

    return {
        "status": "success",
        "message": f"Change marked as {new_status}.",
        "change": change.to_dict(),
    }


@router.post("/{resume_id}/review-batch")
async def batch_review_changes(
    resume_id: str,
    payload: BatchReviewPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts all or rejects all AI changes for a tailored resume in a single action.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    action = payload.action.lower().strip()
    target_status = "accepted" if action == "accept_all" else "rejected"

    stmt = select(ResumeChangeRecord).where(
        ResumeChangeRecord.tailored_resume_id == resume_id,
        ResumeChangeRecord.user_id == user_id,
    )
    changes = (await db.execute(stmt)).scalars().all()
    if not changes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No changes found for this resume.")

    for ch in changes:
        ch.status = target_status
        ch.updated_at = datetime.now(timezone.utc)
        if target_status == "rejected":
            target_text = ch.original_text or ""
            if ch.section == "summary":
                sum_stmt = select(ResumeSummary).where(ResumeSummary.resume_id == resume_id)
                summary_obj = (await db.execute(sum_stmt)).scalars().first()
                if summary_obj:
                    summary_obj.summary = target_text
            elif ch.section == "experience_bullet":
                m = re.match(r"exp_(\d+)_b_(\d+)", ch.paragraph_id)
                if m:
                    e_idx = int(m.group(1))
                    b_idx = int(m.group(2))
                    exp_stmt = select(ResumeExperience).where(
                        ResumeExperience.resume_id == resume_id
                    ).order_by(ResumeExperience.display_order)
                    exps = (await db.execute(exp_stmt)).scalars().all()
                    if e_idx < len(exps):
                        exp_rec = exps[e_idx]
                        bullet_stmt = select(ResumeExperienceBullet).where(
                            ResumeExperienceBullet.experience_id == exp_rec.id
                        ).order_by(ResumeExperienceBullet.display_order)
                        bullets = (await db.execute(bullet_stmt)).scalars().all()
                        if b_idx < len(bullets):
                            bullets[b_idx].content = target_text

    await db.commit()
    return {
        "status": "success",
        "action": action,
        "affected_count": len(changes),
    }
