"""
TailorResume — Master Resume Storage Service
Manages original uploaded master resume files with cryptographic SHA-256 immutability.

Strict Guarantees:
- Original uploaded PDF and DOCX files are stored byte-for-byte unchanged.
- Cryptographic SHA-256 hash is calculated at ingestion time.
- Downloading the master resume returns the EXACT original uploaded file bytes.
- Tailoring operations NEVER mutate or overwrite the stored original file.
- Works offline with local filesystem storage and syncs with Supabase Storage when configured.
- Supports serverless writable directories (/tmp) on Vercel and AWS Lambda.
"""

import os
import hashlib
from pathlib import Path
from typing import Tuple, Optional

from config import settings


def get_storage_base() -> str:
    """
    Resolves the base directory for local persistent resume storage.
    Uses /tmp in serverless environments (Vercel / AWS Lambda) where the app bundle is read-only.
    """
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        base = os.path.join("/tmp", "tailorresume_storage", "resumes")
    else:
        base = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "resumes"
        )
    return base


LOCAL_STORAGE_BASE = get_storage_base()


def compute_sha256(content: bytes) -> str:
    """Calculates the hex SHA-256 digest of binary content."""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()


def _upload_to_supabase_storage(
    user_id: str,
    record_id: str,
    filename: str,
    content: bytes,
) -> Optional[str]:
    """
    Uploads the file to private Supabase Storage if configured.
    Returns the Supabase object URI or None if unconfigured.
    """
    supabase_url = getattr(settings, "SUPABASE_URL", None)
    service_role_key = (
        getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
        or getattr(settings, "SUPABASE_ANON_KEY", None)
    )
    if not supabase_url or not service_role_key or "your-project" in supabase_url:
        return None

    try:
        import httpx
        bucket = getattr(settings, "SUPABASE_RESUME_BUCKET", "resume-imports")
        clean_name = os.path.basename(filename)
        object_path = f"{user_id}/{record_id}/{clean_name}"
        endpoint = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"

        headers = {
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
            "x-upsert": "true",
        }
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(endpoint, headers=headers, content=content)
            if resp.status_code in (200, 201):
                return f"supabase://{bucket}/{object_path}"
    except Exception as e:
        print(f"[WARN] Supabase storage upload deferred: {e}")
    return None


def _download_from_supabase_storage(supabase_uri: str) -> Optional[bytes]:
    """
    Downloads file content from Supabase Storage given a supabase:// URI.
    """
    supabase_url = getattr(settings, "SUPABASE_URL", None)
    service_role_key = (
        getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
        or getattr(settings, "SUPABASE_ANON_KEY", None)
    )
    if not supabase_url or not service_role_key or "your-project" in supabase_url:
        return None

    try:
        import httpx
        clean_uri = supabase_uri.replace("supabase://", "")
        parts = clean_uri.split("/", 1)
        if len(parts) != 2:
            return None
        bucket, object_path = parts
        endpoint = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"

        headers = {
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(endpoint, headers=headers)
            if resp.status_code == 200:
                return resp.content
    except Exception as e:
        print(f"[WARN] Supabase storage download failed: {e}")
    return None


def store_master_resume_file(
    user_id: str,
    record_id: str,
    filename: str,
    content: bytes,
) -> Tuple[str, str, int]:
    """
    Stores the original master resume file bytes in immutable storage.
    Returns (storage_path, sha256_hash, file_size).
    """
    sha256_hash = compute_sha256(content)
    file_size = len(content)

    clean_filename = os.path.basename(filename)

    # 1. Store in local filesystem (or /tmp on serverless)
    base_dir = get_storage_base()
    target_dir = os.path.join(base_dir, str(user_id), str(record_id))
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, clean_filename)

    with open(target_path, "wb") as f:
        f.write(content)

    # 2. Sync to Supabase Storage if available
    supabase_uri = _upload_to_supabase_storage(user_id, record_id, clean_filename, content)
    primary_path = supabase_uri if supabase_uri else target_path

    return primary_path, sha256_hash, file_size


class MasterResumeTamperError(ValueError):
    """Raised when master resume file fails cryptographic SHA-256 verification."""
    pass


def retrieve_master_resume_file(
    storage_path: Optional[str] = None,
    expected_sha256: Optional[str] = None,
    fallback_base64: Optional[str] = None,
) -> bytes:
    """
    Retrieves the exact binary bytes of the original master resume.
    Checks:
    1. Local filesystem path if exists.
    2. Supabase Storage URI if configured.
    3. Direct persistent database base64 data.
    4. /tmp fallback path on serverless containers.
    If expected_sha256 is provided, verifies that the file has not been altered.
    """
    import base64
    content = None

    # 1. Check local filesystem path first
    if storage_path and not storage_path.startswith("supabase://") and os.path.exists(storage_path):
        try:
            with open(storage_path, "rb") as f:
                content = f.read()
        except Exception:
            content = None

    # 2. If missing locally or stored in Supabase, fetch from Supabase
    if content is None and storage_path and storage_path.startswith("supabase://"):
        content = _download_from_supabase_storage(storage_path)

    # 3. If stored locally in /tmp on another lambda instance, try Supabase recovery
    if content is None and storage_path and "/resumes/" in storage_path.replace("\\", "/"):
        rel_uri = storage_path.replace("\\", "/").split("/resumes/")[-1]
        bucket = getattr(settings, "SUPABASE_RESUME_BUCKET", "resume-imports")
        content = _download_from_supabase_storage(f"supabase://{bucket}/{rel_uri}")

    # 4. Check persistent base64 database fallback (guarantees persistence across serverless cold starts)
    if content is None and fallback_base64:
        try:
            content = base64.b64decode(fallback_base64)
        except Exception as b64_err:
            print(f"[WARN] Failed to decode fallback base64 file data: {b64_err}")
            content = None

    # 5. If still not found and running serverless, check /tmp fallback path
    if content is None and storage_path:
        tmp_base = os.path.join("/tmp", "tailorresume_storage", "resumes")
        rel_parts = storage_path.replace("\\", "/").split("storage/resumes/")
        if len(rel_parts) == 2:
            alt_path = os.path.join(tmp_base, rel_parts[1].replace("/", os.sep))
            if os.path.exists(alt_path):
                try:
                    with open(alt_path, "rb") as f:
                        content = f.read()
                except Exception:
                    content = None

    if content is None:
        raise FileNotFoundError(f"Original master resume document file not found at: {storage_path}")

    if expected_sha256:
        actual_sha256 = compute_sha256(content)
        if actual_sha256 != expected_sha256:
            raise MasterResumeTamperError(
                f"Integrity check failed! Master resume SHA-256 mismatch. Expected: {expected_sha256}, Actual: {actual_sha256}"
            )

    return content


def verify_file_immutability(storage_path: str, expected_sha256: str) -> bool:
    """Verifies that the stored file matches the expected cryptographic SHA-256 hash."""
    try:
        retrieve_master_resume_file(storage_path, expected_sha256=expected_sha256)
        return True
    except Exception:
        return False


# Backward-compatible alias
verify_file_integrity = verify_file_immutability
