"""
TailorResume — AI Resume Tailoring Assistant — Resume Foundation API (Module 2)
Provides secure CRUD operations, atomic section updates, and duplication for structured resumes.
Guarantees:
- Every route strictly derives identity from Supabase Auth (auth.uid()).
- Client-supplied user IDs are never trusted.
- User isolation: User A cannot read, update, or delete User B's resume.
- Single default resume per user enforced.
- Cascading delete prevents orphaned child records.
- Deterministic, structured relational persistence without AI/LLM dependencies.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import re

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

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
    ResumeImport,
    TailoredResume,
    JobMatch,
)
from services.auth import get_current_user

router = APIRouter()


# --- Pydantic Schemas for Validation ---

class BulletSchema(BaseModel):
    id: Optional[str] = None
    content: str = Field(..., min_length=1, max_length=2000)
    display_order: int = Field(0, ge=0)


class PersonalInfoSchema(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    headline: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)


class SummarySchema(BaseModel):
    summary: Optional[str] = Field(None, max_length=5000)


class ExperienceSchema(BaseModel):
    id: Optional[str] = None
    company: str = Field(..., min_length=1, max_length=255)
    job_title: str = Field(..., min_length=1, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    employment_type: Optional[str] = Field(None, max_length=100)
    start_date: Optional[str] = Field(None, max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    is_current: bool = False
    description: Optional[str] = Field(None, max_length=3000)
    display_order: int = Field(0, ge=0)
    bullets: List[BulletSchema] = []


class EducationSchema(BaseModel):
    id: Optional[str] = None
    institution: str = Field(..., min_length=1, max_length=255)
    degree: Optional[str] = Field(None, max_length=255)
    field_of_study: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    start_date: Optional[str] = Field(None, max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    display_order: int = Field(0, ge=0)


class SkillSchema(BaseModel):
    id: Optional[str] = None
    skill_name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    display_order: int = Field(0, ge=0)


class ProjectSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=3000)
    url: Optional[str] = Field(None, max_length=500)
    technologies: Optional[str] = Field(None, max_length=500)
    display_order: int = Field(0, ge=0)
    bullets: List[BulletSchema] = []


class CertificationSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    issuer: Optional[str] = Field(None, max_length=255)
    issue_date: Optional[str] = Field(None, max_length=50)
    expiration_date: Optional[str] = Field(None, max_length=50)
    credential_id: Optional[str] = Field(None, max_length=255)
    credential_url: Optional[str] = Field(None, max_length=500)
    display_order: int = Field(0, ge=0)


class LinkSchema(BaseModel):
    id: Optional[str] = None
    label: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    display_order: int = Field(0, ge=0)


class CreateResumeRequest(BaseModel):
    name: str = Field("Untitled Resume", min_length=1, max_length=255)
    is_default: bool = False
    file_sha256: Optional[str] = Field(None, max_length=64)
    original_filename: Optional[str] = Field(None, max_length=255)
    original_file_path: Optional[str] = Field(None, max_length=500)
    file_type: Optional[str] = Field(None, max_length=50)
    file_size: Optional[int] = None


class UpdateResumeRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_default: Optional[bool] = None
    status: Optional[str] = Field(None, max_length=50)
    template_id: Optional[str] = Field(None, max_length=50)
    template_version: Optional[str] = Field(None, max_length=50)
    file_sha256: Optional[str] = Field(None, max_length=64)
    original_filename: Optional[str] = Field(None, max_length=255)
    original_file_path: Optional[str] = Field(None, max_length=500)
    file_type: Optional[str] = Field(None, max_length=50)
    file_size: Optional[int] = None
    personal_info: Optional[PersonalInfoSchema] = None
    summary: Optional[SummarySchema] = None
    experiences: Optional[List[ExperienceSchema]] = None
    educations: Optional[List[EducationSchema]] = None
    skills: Optional[List[SkillSchema]] = None
    projects: Optional[List[ProjectSchema]] = None
    certifications: Optional[List[CertificationSchema]] = None
    links: Optional[List[LinkSchema]] = None


ALLOWED_TEMPLATES = {"ats-classic", "professional", "compact"}


class TemplateUpdateRequest(BaseModel):
    template_id: str = Field(..., min_length=1, max_length=50)
    template_version: Optional[str] = Field("v1.0.0", max_length=50)


# --- URL Validation Helper ---
URL_REGEX = re.compile(r'^(https?://|www\.)[^\s/$.?#].[^\s]*$', re.IGNORECASE)

def validate_url(url: Optional[str], field_name: str):
    if not url:
        return
    url_clean = url.strip()
    if not URL_REGEX.match(url_clean) and not url_clean.startswith('/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid URL format for {field_name}."
        )


# --- API Routes ---

@router.get("", response_model=List[Dict[str, Any]])
async def list_user_resumes(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all resumes owned by the authenticated user.
    Enforces user isolation: queries only where user_id == current_user['id'].
    """
    user_id = current_user["id"]
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.is_default.desc(), Resume.updated_at.desc())
    )
    resumes = result.scalars().all()
    return [r.to_summary_dict() for r in resumes]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_resume(
    payload: CreateResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new resume for the authenticated user.
    If this is the user's first resume or is_default is True, sets is_default correctly.
    """
    user_id = current_user["id"]

    # Check existing count
    existing_result = await db.execute(
        select(Resume).where(Resume.user_id == user_id)
    )
    existing_resumes = existing_result.scalars().all()
    is_first = len(existing_resumes) == 0

    should_be_default = payload.is_default or is_first

    if should_be_default:
        # Demote any current default resumes for this user
        await db.execute(
            update(Resume)
            .where(Resume.user_id == user_id)
            .values(is_default=False)
        )

    new_resume = Resume(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=payload.name.strip() or "Untitled Resume",
        is_default=should_be_default,
        status="draft",
        template_id="ats-classic",
        template_version="v1.0.0",
        file_sha256=payload.file_sha256,
        original_filename=payload.original_filename,
        original_file_path=payload.original_file_path,
        file_type=payload.file_type,
        file_size=payload.file_size,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_resume)
    await db.flush()

    # Pre-populate empty PersonalInfo and Summary structures
    personal_info = ResumePersonalInfo(
        id=str(uuid.uuid4()),
        resume_id=new_resume.id,
        email=current_user.get("email"),
        full_name=current_user.get("user_metadata", {}).get("full_name"),
    )
    summary = ResumeSummary(
        id=str(uuid.uuid4()),
        resume_id=new_resume.id,
        summary="",
    )
    db.add(personal_info)
    db.add(summary)

    await db.commit()
    await db.refresh(new_resume)

    return new_resume.to_full_dict()


@router.get("/{resume_id}")
async def get_resume_by_id(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve full structured resume by ID.
    Strictly verifies ownership: user_id == current_user['id'].
    """
    user_id = current_user["id"]
    clean_id = resume_id.replace("draft-", "") if resume_id else resume_id
    result = await db.execute(
        select(Resume).where(
            (Resume.id == resume_id) | (Resume.id == clean_id),
            Resume.user_id == user_id,
        )
    )
    resume = result.scalar_one_or_none()

    if not resume:
        # Fallback 1: check resume_imports table
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
            resume = existing_by_sha.scalars().first()

    if not resume:
        # Fallback 2: check default master resume
        default_stmt = select(Resume).where(
            Resume.user_id == user_id,
            Resume.is_default == True,
            Resume.is_tailored == False,
        )
        resume = (await db.execute(default_stmt)).scalars().first()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    return resume.to_full_dict()


@router.get("/{resume_id}/original")
async def download_original_master_resume(
    resume_id: str,
    inline: bool = Query(False, description="Display inline in browser preview viewer"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads or previews the exact, byte-for-byte unmodified original uploaded master resume file.
    Validates user ownership and cryptographic SHA-256 hash before delivery.
    Never uses parsed or tailored resume data; strictly serves original master files.
    """
    import os
    from fastapi.responses import Response
    from services.storage import retrieve_master_resume_file, MasterResumeTamperError

    user_id = current_user["id"]
    clean_id = resume_id.removeprefix("draft-")

    # 1. Look up in resumes table
    result = await db.execute(
        select(Resume).where(
            (Resume.id == resume_id) | (Resume.id == clean_id),
            Resume.user_id == user_id,
        )
    )
    resume = result.scalar_one_or_none()

    storage_path = None
    expected_sha256 = None
    file_type = None
    original_filename = None
    fallback_base64 = None

    if resume:
        # Master Preview Guarantee: Tailored resumes are generated representations, NOT original master documents
        if resume.is_tailored:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Original document preview is only available for master resumes. Tailored resumes are generated representations."
            )
        storage_path = resume.original_file_path
        expected_sha256 = resume.file_sha256
        file_type = resume.file_type
        original_filename = resume.original_filename
        fallback_base64 = getattr(resume, "original_file_data", None)
    else:
        # 2. Look up in resume_imports table as fallback
        import_result = await db.execute(
            select(ResumeImport).where(
                (ResumeImport.id == resume_id) | (ResumeImport.id == clean_id),
                ResumeImport.user_id == user_id,
            )
        )
        import_rec = import_result.scalar_one_or_none()
        if import_rec:
            storage_path = import_rec.storage_path
            expected_sha256 = import_rec.file_sha256
            file_type = import_rec.file_type
            original_filename = import_rec.original_filename
            fallback_base64 = getattr(import_rec, "original_file_data", None)

    if not storage_path and not fallback_base64:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original master resume document file is not available or not found."
        )

    # Verify supported format (PDF or DOCX)
    ext = None
    if file_type == "docx" or (original_filename and original_filename.lower().endswith(".docx")):
        ext = "docx"
    elif file_type == "pdf" or (original_filename and original_filename.lower().endswith(".pdf")):
        ext = "pdf"

    if not ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported master resume format. Only PDF and DOCX files are supported."
        )

    try:
        content = retrieve_master_resume_file(
            storage_path or f"db://{clean_id}",
            expected_sha256=expected_sha256,
            fallback_base64=fallback_base64,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original master resume document file is not available or not found."
        )
    except MasterResumeTamperError as mte:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Master resume integrity check failed: {str(mte)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read master resume file: {str(e)}"
        )

    media_type = "application/pdf" if ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    filename = original_filename or f"master_resume_{clean_id}.{ext}"
    disposition_type = "inline" if inline else "attachment"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition_type}; filename="{filename}"',
            "Content-Length": str(len(content)),
            "X-Resume-Id": clean_id,
            "X-Resume-SHA256": expected_sha256 or "",
            "X-File-Type": ext,
            "Access-Control-Expose-Headers": "Content-Disposition, X-Resume-SHA256, X-File-Type",
            "X-Is-Master-Resume": "true",
        },
    )


@router.put("/{resume_id}")
async def update_resume_by_id(
    resume_id: str,
    payload: UpdateResumeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically update a resume and its child sections.
    Validates ownership, date logic, and URL structures.
    """
    user_id = current_user["id"]

    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    # 1. Update Top-Level Properties
    if payload.name is not None:
        resume.name = payload.name.strip()
    if payload.status is not None:
        resume.status = payload.status
    if payload.file_sha256 is not None:
        resume.file_sha256 = payload.file_sha256
    if payload.original_filename is not None:
        resume.original_filename = payload.original_filename
    if payload.original_file_path is not None:
        resume.original_file_path = payload.original_file_path
    if payload.file_type is not None:
        resume.file_type = payload.file_type
    if payload.file_size is not None:
        resume.file_size = payload.file_size
    if payload.is_default is True and not resume.is_default:
        await db.execute(
            update(Resume)
            .where(Resume.user_id == user_id)
            .values(is_default=False)
        )
        resume.is_default = True
    elif payload.is_default is False and resume.is_default:
        resume.is_default = False
    if payload.template_id is not None:
        if payload.template_id not in ALLOWED_TEMPLATES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid template ID '{payload.template_id}'. Allowed templates: {sorted(list(ALLOWED_TEMPLATES))}"
            )
        resume.template_id = payload.template_id
    if payload.template_version is not None:
        resume.template_version = payload.template_version

    resume.updated_at = datetime.now(timezone.utc)

    # 2. Update Personal Info
    if payload.personal_info is not None:
        p_info = payload.personal_info
        validate_url(p_info.website, "website")
        validate_url(p_info.linkedin_url, "LinkedIn URL")
        validate_url(p_info.github_url, "GitHub URL")
        validate_url(p_info.portfolio_url, "Portfolio URL")

        if resume.personal_info:
            resume.personal_info.full_name = p_info.full_name
            resume.personal_info.headline = p_info.headline
            resume.personal_info.email = p_info.email
            resume.personal_info.phone = p_info.phone
            resume.personal_info.location = p_info.location
            resume.personal_info.website = p_info.website
            resume.personal_info.linkedin_url = p_info.linkedin_url
            resume.personal_info.github_url = p_info.github_url
            resume.personal_info.portfolio_url = p_info.portfolio_url
            resume.personal_info.updated_at = datetime.now(timezone.utc)
        else:
            new_p_info = ResumePersonalInfo(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                full_name=p_info.full_name,
                headline=p_info.headline,
                email=p_info.email,
                phone=p_info.phone,
                location=p_info.location,
                website=p_info.website,
                linkedin_url=p_info.linkedin_url,
                github_url=p_info.github_url,
                portfolio_url=p_info.portfolio_url,
            )
            db.add(new_p_info)

    # 3. Update Summary
    if payload.summary is not None:
        if resume.summary:
            resume.summary.summary = payload.summary.summary
            resume.summary.updated_at = datetime.now(timezone.utc)
        else:
            new_sum = ResumeSummary(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                summary=payload.summary.summary,
            )
            db.add(new_sum)

    # 4. Update Experiences (and sub-bullets)
    if payload.experiences is not None:
        # Clear existing experiences (bullets will cascade delete)
        await db.execute(
            delete(ResumeExperience).where(ResumeExperience.resume_id == resume.id)
        )
        for exp_idx, exp_data in enumerate(payload.experiences):
            # Validate dates: if is_current is True, end_date must be cleared
            end_date = None if exp_data.is_current else exp_data.end_date

            exp = ResumeExperience(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                company=exp_data.company.strip(),
                job_title=exp_data.job_title.strip(),
                location=exp_data.location,
                employment_type=exp_data.employment_type,
                start_date=exp_data.start_date,
                end_date=end_date,
                is_current=exp_data.is_current,
                description=exp_data.description,
                display_order=exp_data.display_order if exp_data.display_order is not None else exp_idx,
            )
            db.add(exp)
            await db.flush()

            for b_idx, bullet in enumerate(exp_data.bullets):
                b = ResumeExperienceBullet(
                    id=str(uuid.uuid4()),
                    experience_id=exp.id,
                    content=bullet.content.strip(),
                    display_order=bullet.display_order if bullet.display_order is not None else b_idx,
                )
                db.add(b)

    # 5. Update Educations
    if payload.educations is not None:
        await db.execute(
            delete(ResumeEducation).where(ResumeEducation.resume_id == resume.id)
        )
        for edu_idx, edu_data in enumerate(payload.educations):
            edu = ResumeEducation(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                institution=edu_data.institution.strip(),
                degree=edu_data.degree,
                field_of_study=edu_data.field_of_study,
                location=edu_data.location,
                start_date=edu_data.start_date,
                end_date=edu_data.end_date,
                description=edu_data.description,
                display_order=edu_data.display_order if edu_data.display_order is not None else edu_idx,
            )
            db.add(edu)

    # 6. Update Skills
    if payload.skills is not None:
        await db.execute(
            delete(ResumeSkill).where(ResumeSkill.resume_id == resume.id)
        )
        for skill_idx, skill_data in enumerate(payload.skills):
            skill = ResumeSkill(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                skill_name=skill_data.skill_name.strip(),
                category=skill_data.category.strip() if skill_data.category else None,
                display_order=skill_data.display_order if skill_data.display_order is not None else skill_idx,
            )
            db.add(skill)

    # 7. Update Projects (and sub-bullets)
    if payload.projects is not None:
        await db.execute(
            delete(ResumeProject).where(ResumeProject.resume_id == resume.id)
        )
        for proj_idx, proj_data in enumerate(payload.projects):
            validate_url(proj_data.url, f"Project '{proj_data.name}' URL")
            proj = ResumeProject(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                name=proj_data.name.strip(),
                description=proj_data.description,
                url=proj_data.url,
                technologies=proj_data.technologies,
                display_order=proj_data.display_order if proj_data.display_order is not None else proj_idx,
            )
            db.add(proj)
            await db.flush()

            for b_idx, bullet in enumerate(proj_data.bullets):
                b = ResumeProjectBullet(
                    id=str(uuid.uuid4()),
                    project_id=proj.id,
                    content=bullet.content.strip(),
                    display_order=bullet.display_order if bullet.display_order is not None else b_idx,
                )
                db.add(b)

    # 8. Update Certifications
    if payload.certifications is not None:
        await db.execute(
            delete(ResumeCertification).where(ResumeCertification.resume_id == resume.id)
        )
        for cert_idx, cert_data in enumerate(payload.certifications):
            validate_url(cert_data.credential_url, f"Certification '{cert_data.name}' URL")
            cert = ResumeCertification(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                name=cert_data.name.strip(),
                issuer=cert_data.issuer,
                issue_date=cert_data.issue_date,
                expiration_date=cert_data.expiration_date,
                credential_id=cert_data.credential_id,
                credential_url=cert_data.credential_url,
                display_order=cert_data.display_order if cert_data.display_order is not None else cert_idx,
            )
            db.add(cert)

    # 9. Update Links
    if payload.links is not None:
        await db.execute(
            delete(ResumeLink).where(ResumeLink.resume_id == resume.id)
        )
        for link_idx, link_data in enumerate(payload.links):
            validate_url(link_data.url, f"Link '{link_data.label}' URL")
            lnk = ResumeLink(
                id=str(uuid.uuid4()),
                resume_id=resume.id,
                label=link_data.label.strip(),
                url=link_data.url.strip(),
                display_order=link_data.display_order if link_data.display_order is not None else link_idx,
            )
            db.add(lnk)

    await db.commit()
    db.expire_all()
    # Re-fetch cleanly to populate all relationships
    reloaded_result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    updated_resume = reloaded_result.scalar_one()
    return updated_resume.to_full_dict()


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a resume and cascade-delete all child records.
    If the deleted resume was default, promotes another existing resume to default if available.
    """
    user_id = current_user["id"]

    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    was_default = resume.is_default

    # 1. If deleting a tailored resume, remove its record in tailored_resumes
    await db.execute(
        delete(TailoredResume).where(TailoredResume.tailored_resume_id == resume_id)
    )

    # 2. If deleting a master resume, preserve historical tailored resumes by nullifying source_resume_id
    await db.execute(
        update(TailoredResume)
        .where(TailoredResume.source_resume_id == resume_id)
        .values(source_resume_id=None)
    )
    await db.execute(
        update(Resume)
        .where(Resume.source_resume_id == resume_id)
        .values(source_resume_id=None)
    )

    # 3. Clean up associated JobMatch records
    await db.execute(
        delete(JobMatch).where(JobMatch.resume_id == resume_id)
    )

    await db.delete(resume)
    await db.flush()

    # If deleted resume was default, find another one and promote it
    if was_default:
        other_result = await db.execute(
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(Resume.updated_at.desc())
            .limit(1)
        )
        next_default = other_result.scalar_one_or_none()
        if next_default:
            next_default.is_default = True

    await db.commit()
    return {"deleted": True, "id": resume_id}


@router.post("/{resume_id}/default")
async def set_resume_as_default(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a resume as the user's default/master resume.
    Ensures all other resumes for this user are unmarked (is_default = False).
    """
    user_id = current_user["id"]

    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    # Set all other user resumes to is_default = False
    await db.execute(
        update(Resume)
        .where(Resume.user_id == user_id)
        .values(is_default=False)
    )

    resume.is_default = True
    resume.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(resume)

    return resume.to_summary_dict()


@router.post("/{resume_id}/duplicate")
async def duplicate_resume(
    resume_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a deep clone of a resume with completely distinct child records (new UUIDs).
    Guarantees no shared mutable references.
    """
    user_id = current_user["id"]

    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    source_resume = result.scalar_one_or_none()

    if not source_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    # 1. New Parent Resume (never default by duplicate action)
    new_id = str(uuid.uuid4())
    new_resume = Resume(
        id=new_id,
        user_id=user_id,
        name=f"{source_resume.name} (Copy)",
        is_default=False,
        status="draft",
        template_id=source_resume.template_id or "ats-classic",
        template_version=source_resume.template_version or "v1.0.0",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_resume)
    await db.flush()

    # 2. Clone Personal Info
    if source_resume.personal_info:
        src_p = source_resume.personal_info
        new_p = ResumePersonalInfo(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            full_name=src_p.full_name,
            headline=src_p.headline,
            email=src_p.email,
            phone=src_p.phone,
            location=src_p.location,
            website=src_p.website,
            linkedin_url=src_p.linkedin_url,
            github_url=src_p.github_url,
            portfolio_url=src_p.portfolio_url,
        )
        db.add(new_p)

    # 3. Clone Summary
    if source_resume.summary:
        new_s = ResumeSummary(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            summary=source_resume.summary.summary,
        )
        db.add(new_s)

    # 4. Clone Experiences & Bullets
    for src_exp in source_resume.experiences:
        new_exp = ResumeExperience(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            company=src_exp.company,
            job_title=src_exp.job_title,
            location=src_exp.location,
            employment_type=src_exp.employment_type,
            start_date=src_exp.start_date,
            end_date=src_exp.end_date,
            is_current=src_exp.is_current,
            description=src_exp.description,
            display_order=src_exp.display_order,
        )
        db.add(new_exp)
        await db.flush()

        for src_bullet in src_exp.bullets:
            new_bullet = ResumeExperienceBullet(
                id=str(uuid.uuid4()),
                experience_id=new_exp.id,
                content=src_bullet.content,
                display_order=src_bullet.display_order,
            )
            db.add(new_bullet)

    # 5. Clone Educations
    for src_edu in source_resume.educations:
        new_edu = ResumeEducation(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            institution=src_edu.institution,
            degree=src_edu.degree,
            field_of_study=src_edu.field_of_study,
            location=src_edu.location,
            start_date=src_edu.start_date,
            end_date=src_edu.end_date,
            description=src_edu.description,
            display_order=src_edu.display_order,
        )
        db.add(new_edu)

    # 6. Clone Skills
    for src_skill in source_resume.skills:
        new_skill = ResumeSkill(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            skill_name=src_skill.skill_name,
            category=src_skill.category,
            display_order=src_skill.display_order,
        )
        db.add(new_skill)

    # 7. Clone Projects & Bullets
    for src_proj in source_resume.projects:
        new_proj = ResumeProject(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            name=src_proj.name,
            description=src_proj.description,
            url=src_proj.url,
            technologies=src_proj.technologies,
            display_order=src_proj.display_order,
        )
        db.add(new_proj)
        await db.flush()

        for src_proj_bullet in src_proj.bullets:
            new_proj_bullet = ResumeProjectBullet(
                id=str(uuid.uuid4()),
                project_id=new_proj.id,
                content=src_proj_bullet.content,
                display_order=src_proj_bullet.display_order,
            )
            db.add(new_proj_bullet)

    # 8. Clone Certifications
    for src_cert in source_resume.certifications:
        new_cert = ResumeCertification(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            name=src_cert.name,
            issuer=src_cert.issuer,
            issue_date=src_cert.issue_date,
            expiration_date=src_cert.expiration_date,
            credential_id=src_cert.credential_id,
            credential_url=src_cert.credential_url,
            display_order=src_cert.display_order,
        )
        db.add(new_cert)

    # 9. Clone Links
    for src_link in source_resume.links:
        new_link = ResumeLink(
            id=str(uuid.uuid4()),
            resume_id=new_id,
            label=src_link.label,
            url=src_link.url,
            display_order=src_link.display_order,
        )
        db.add(new_link)

    await db.commit()
    db.expire_all()

    # Re-fetch cloned resume
    reloaded_result = await db.execute(
        select(Resume).where(Resume.id == new_id, Resume.user_id == user_id)
    )
    cloned_resume = reloaded_result.scalar_one()
    return cloned_resume.to_full_dict()


@router.put("/{resume_id}/template")
async def update_resume_template(
    resume_id: str,
    payload: TemplateUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the template presentation settings for a resume.
    Ensures ownership and validates template ID against allowed templates.
    Does NOT modify structured resume content.
    """
    user_id = current_user["id"]
    if payload.template_id not in ALLOWED_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid template ID '{payload.template_id}'. Allowed templates: {sorted(list(ALLOWED_TEMPLATES))}"
        )

    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found or access denied."
        )

    resume.template_id = payload.template_id
    if payload.template_version:
        resume.template_version = payload.template_version
    resume.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(resume)
    return {
        "id": resume.id,
        "template_id": resume.template_id,
        "template_version": resume.template_version,
        "updated_at": resume.updated_at.isoformat() if resume.updated_at else None,
    }

