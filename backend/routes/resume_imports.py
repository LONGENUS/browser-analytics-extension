"""
TailorResume — AI Resume Tailoring Assistant — Resume Import & Upload API (Module 3)
Handles secure PDF/DOCX file uploads, size/MIME validation, deterministic parsing,
immediate database persistence, and import session tracking with strict user isolation.

Guarantees:
- Every route strictly derives identity from Supabase Auth (auth.uid()).
- Client-supplied user IDs are never trusted.
- Enforces 10MB maximum file size limit.
- Validates file extensions and MIME types.
- Zero AI / LLM dependencies in parser.
- Zero OCR dependency; rejects image-only PDFs cleanly.
- Persists master resume record and extracted sections into database immediately.
- Preserves original uploaded file byte-for-byte in immutable storage with verified SHA-256.
- Reloads persisted records from backend before responding.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy import select
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
)
from services.auth import get_current_user
from services.resume_parser import parse_resume_document
from services.rate_limiter import upload_rate_limiter
from services.storage import store_master_resume_file

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',  # Browsers sometimes use this for docx or pdf
}


@router.post("", status_code=status.HTTP_200_OK)
@router.post("/", status_code=status.HTTP_200_OK)
async def upload_and_parse_resume(
    request: Request,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Securely uploads, validates, deterministically parses, and persists a resume file (PDF or DOCX).
    Stores the exact original file byte-for-byte in immutable storage with cryptographic SHA-256.
    Persists the master resume record and all parsed sections to the database immediately.
    Reloads and returns the confirmed database record.
    """
    user_id = current_user["id"]
    upload_rate_limiter.check(request, user_id=user_id)
    filename = file.filename or "uploaded_resume.pdf"
    filename_lower = filename.lower()

    # 1. Validate File Extension
    has_valid_ext = any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)
    if not has_valid_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This file type isn't supported. Please upload a PDF or DOCX resume."
        )

    # 2. Validate MIME Type if present
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a genuine PDF or DOCX document."
        )

    # 3. Read Content & Enforce Max File Size
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty. Please select a valid resume document."
        )

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Your resume is too large. Please upload a file smaller than 10 MB."
        )

    file_type = "docx" if filename_lower.endswith(".docx") else "pdf"
    import_id = str(uuid.uuid4())
    import base64
    content_b64 = base64.b64encode(content).decode("utf-8")

    # 4. Store Original Master Resume File (Byte-for-Byte Unchanged)
    storage_path, file_sha256, stored_size = store_master_resume_file(
        user_id=user_id,
        record_id=import_id,
        filename=filename,
        content=content,
    )

    # 5. Extract Text & Parse Structured Resume (Derived Representation)
    parsed_resume = None
    try:
        parsed_resume = parse_resume_document(content, filename)
    except ValueError as val_err:
        # If parsing fails, preserve original file intact and record failed import session
        fail_record = ResumeImport(
            id=import_id,
            user_id=user_id,
            original_filename=filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            original_file_data=content_b64,
            file_sha256=file_sha256,
            status="failed",
            error_message=str(val_err),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(fail_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        fail_record = ResumeImport(
            id=import_id,
            user_id=user_id,
            original_filename=filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            original_file_data=content_b64,
            file_sha256=file_sha256,
            status="failed",
            error_message=f"Document read failure: {str(e)}",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(fail_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="We couldn't read this document. Please verify the file is not corrupted or password-protected."
        )

    # Attach immutable source file metadata to parsed resume structure
    parsed_resume["file_sha256"] = file_sha256
    parsed_resume["original_filename"] = filename
    parsed_resume["original_file_path"] = storage_path
    parsed_resume["file_type"] = file_type
    parsed_resume["file_size"] = file_size

    # 6. Check existing user resumes to determine default status
    existing_res_result = await db.execute(
        select(Resume).where(Resume.user_id == user_id)
    )
    existing_resumes = existing_res_result.scalars().all()
    is_first_resume = len(existing_resumes) == 0

    # 7. Create Canonical Master Resume Record
    canonical_resume_id = str(uuid.uuid4())
    p_info = parsed_resume.get("personal_info") or {}
    full_name = p_info.get("full_name") or ""
    clean_base_name = filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip().title()

    if full_name and len(full_name) > 1:
        resume_name = f"{full_name} Resume"
    else:
        resume_name = f"{clean_base_name} Resume" if clean_base_name else "Master Resume"

    now_utc = datetime.now(timezone.utc)
    new_resume = Resume(
        id=canonical_resume_id,
        user_id=user_id,
        name=resume_name[:250],
        is_default=is_first_resume,
        status="ready",
        template_id="ats-classic",
        template_version="v1.0.0",
        file_sha256=file_sha256,
        original_filename=filename,
        original_file_path=storage_path,
        original_file_data=content_b64,
        file_type=file_type,
        file_size=file_size,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(new_resume)

    # 8. Persist Personal Info
    personal_info = ResumePersonalInfo(
        id=str(uuid.uuid4()),
        resume_id=canonical_resume_id,
        full_name=p_info.get("full_name"),
        headline=p_info.get("headline"),
        email=p_info.get("email") or current_user.get("email"),
        phone=p_info.get("phone"),
        location=p_info.get("location"),
        website=p_info.get("website"),
        linkedin_url=p_info.get("linkedin_url"),
        github_url=p_info.get("github_url"),
        portfolio_url=p_info.get("portfolio_url"),
    )
    db.add(personal_info)

    # Summary
    sum_data = parsed_resume.get("summary") or {}
    sum_text = sum_data.get("summary") if isinstance(sum_data, dict) else str(sum_data) if sum_data else ""
    summary_obj = ResumeSummary(
        id=str(uuid.uuid4()),
        resume_id=canonical_resume_id,
        summary=sum_text or "",
    )
    db.add(summary_obj)

    # Experiences & Bullets
    for exp_order, exp in enumerate(parsed_resume.get("experiences") or []):
        exp_id = str(uuid.uuid4())
        db_exp = ResumeExperience(
            id=exp_id,
            resume_id=canonical_resume_id,
            company=exp.get("company") or "Company",
            job_title=exp.get("job_title") or "Role",
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

    # Educations
    for edu_order, edu in enumerate(parsed_resume.get("educations") or []):
        db_edu = ResumeEducation(
            id=str(uuid.uuid4()),
            resume_id=canonical_resume_id,
            institution=edu.get("institution") or "Institution",
            degree=edu.get("degree"),
            field_of_study=edu.get("field_of_study"),
            location=edu.get("location"),
            start_date=edu.get("start_date"),
            end_date=edu.get("end_date"),
            description=edu.get("description"),
            display_order=edu_order,
        )
        db.add(db_edu)

    # Skills
    for s_order, sk in enumerate(parsed_resume.get("skills") or []):
        s_name = sk.get("skill_name") if isinstance(sk, dict) else str(sk)
        s_cat = sk.get("category", "Technical") if isinstance(sk, dict) else "Technical"
        if s_name and s_name.strip():
            db_skill = ResumeSkill(
                id=str(uuid.uuid4()),
                resume_id=canonical_resume_id,
                skill_name=s_name.strip(),
                category=s_cat,
                display_order=s_order,
            )
            db.add(db_skill)

    # Projects & Bullets
    for p_order, proj in enumerate(parsed_resume.get("projects") or []):
        proj_id = str(uuid.uuid4())
        tech_val = proj.get("technologies") or ""
        db_proj = ResumeProject(
            id=proj_id,
            resume_id=canonical_resume_id,
            name=proj.get("name") or "Project",
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

    # Certifications
    for cert_order, cert in enumerate(parsed_resume.get("certifications") or []):
        c_name = cert.get("name") if isinstance(cert, dict) else str(cert)
        if c_name:
            db_cert = ResumeCertification(
                id=str(uuid.uuid4()),
                resume_id=canonical_resume_id,
                name=c_name,
                issuer=cert.get("issuer") if isinstance(cert, dict) else None,
                issue_date=cert.get("issue_date") if isinstance(cert, dict) else None,
                expiration_date=cert.get("expiration_date") if isinstance(cert, dict) else None,
                credential_id=cert.get("credential_id") if isinstance(cert, dict) else None,
                credential_url=cert.get("credential_url") if isinstance(cert, dict) else None,
                display_order=cert_order,
            )
            db.add(db_cert)

    # Links
    for link_order, link in enumerate(parsed_resume.get("links") or []):
        db_link = ResumeLink(
            id=str(uuid.uuid4()),
            resume_id=canonical_resume_id,
            label=link.get("label", "Link") if isinstance(link, dict) else "Link",
            url=link.get("url", "") if isinstance(link, dict) else str(link),
            display_order=link_order,
        )
        db.add(db_link)

    # 9. Record Import Session Tracking (Audit Log)
    import_record = ResumeImport(
        id=import_id,
        user_id=user_id,
        original_filename=filename,
        file_type=file_type,
        file_size=file_size,
        storage_path=storage_path,
        original_file_data=content_b64,
        file_sha256=file_sha256,
        status="review_required",
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(import_record)
    await db.commit()

    # 10. Reload Canonical Persisted Resume from Database
    loaded_stmt = select(Resume).where(Resume.id == canonical_resume_id)
    loaded_resume = (await db.execute(loaded_stmt)).scalars().first()
    persisted_resume_dict = loaded_resume.to_full_dict() if loaded_resume else parsed_resume
    if "unsupported_sections" in parsed_resume:
        persisted_resume_dict["unsupported_sections"] = parsed_resume["unsupported_sections"]

    return {
        "import_id": import_id,
        "resume_id": canonical_resume_id,
        "filename": filename,
        "file_size": file_size,
        "file_type": file_type,
        "file_sha256": file_sha256,
        "storage_path": storage_path,
        "status": "review_required",
        "parsed_resume": persisted_resume_dict,
    }


@router.get("/history")
@router.get("/history/")
async def get_import_history(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the user's past resume import sessions.
    Strictly isolated: queries only where user_id == current_user['id'].
    """
    user_id = current_user["id"]
    result = await db.execute(
        select(ResumeImport)
        .where(ResumeImport.user_id == user_id)
        .order_by(ResumeImport.created_at.desc())
        .limit(20)
    )
    records = result.scalars().all()
    return [r.to_dict() for r in records]
