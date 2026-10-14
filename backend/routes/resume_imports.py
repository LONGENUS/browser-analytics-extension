"""
TailorResume — AI Resume Tailoring Assistant — Resume Import & Upload API (Module 3)
Handles secure PDF/DOCX file uploads, size/MIME validation, deterministic parsing,
and import session tracking with strict user isolation.
Guarantees:
- Every route strictly derives identity from Supabase Auth (auth.uid()).
- Client-supplied user IDs are never trusted.
- Enforces 10MB maximum file size limit.
- Validates file extensions and MIME types.
- Zero AI / LLM dependencies.
- Zero OCR dependency; rejects image-only PDFs cleanly.
- Never logs sensitive personal resume content.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, ResumeImport
from services.auth import get_current_user
from services.resume_parser import parse_resume_document
from services.rate_limiter import upload_rate_limiter

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
    Securely uploads, validates, and parses a resume file (PDF or DOCX).
    Extracts structured resume sections into a draft FullStructuredResume object for user review.
    Does NOT save as the final canonical resume until the user reviews and confirms.
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

    # 4. Store Original Master Resume File (Byte-for-Byte Unchanged)
    from services.storage import store_master_resume_file
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
            file_sha256=file_sha256,
            status="failed",
            error_message="Document read failure",
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

    # 6. Record Import Session Tracking (Audit Log)
    import_record = ResumeImport(
        id=import_id,
        user_id=user_id,
        original_filename=filename,
        file_type=file_type,
        file_size=file_size,
        storage_path=storage_path,
        file_sha256=file_sha256,
        status="review_required",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(import_record)
    await db.commit()

    return {
        "import_id": import_id,
        "filename": filename,
        "file_size": file_size,
        "file_type": file_type,
        "file_sha256": file_sha256,
        "storage_path": storage_path,
        "status": "review_required",
        "parsed_resume": parsed_resume,
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
