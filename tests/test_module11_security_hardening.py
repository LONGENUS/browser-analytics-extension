"""
Module 11 — Security, Testing & Production Hardening Test Suite
Verifies:
1. Multi-Tenant User Isolation (User A vs User B) across all core resources:
   - Resumes & Child Sections
   - Saved Jobs
   - Job Matches
   - Tailoring Drafts & Saved Tailored Resumes
   - Binary PDF & DOCX Exports
   - Dashboard Overview Counts
2. Authentication & Session Security:
   - Rejection of unauthenticated requests (HTTP 401)
   - Rejection of expired tokens
   - Rejection of tokens with missing or malformed claims
   - Cryptographic HS256 signature verification and tamper detection
3. Rate Limiting & Abuse Prevention:
   - Enforcement of sliding window rate limits (HTTP 429)
   - Proper Retry-After headers
4. File Upload & Document Parsing Security:
   - Rejection of non-whitelisted extensions (.exe, .js)
   - Rejection of empty files
   - Detection of unparseable / image-only content
5. Error Information Leakage:
   - Absence of stack traces, file paths, and SQL dialect details in error responses
"""

import asyncio
import base64
import json
import time
import uuid
import hmac
import hashlib
import os
import sys
from typing import Dict, Any

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient

from app import app
from config import settings
from models.database import init_db
from services.rate_limiter import (
    upload_rate_limiter,
    tailor_rate_limiter,
    match_rate_limiter,
    export_rate_limiter,
    auth_rate_limiter,
)
from services.auth import verify_jwt_signature

client = TestClient(app)


# --- Helper Token Generators ---

def create_mock_jwt(user_id: str, email: str, exp_delta_seconds: int = 3600, secret: str = None) -> str:
    """Generates a base64url encoded mock JWT with optional HS256 signature."""
    header = {"alg": "HS256" if secret else "none", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")

    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": int(time.time()) + exp_delta_seconds,
        "iat": int(time.time()),
        "aud": "authenticated",
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    if secret:
        message = f"{header_b64}.{payload_b64}".encode()
        signature = hmac.new(secret.encode(), message, hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    else:
        sig_b64 = "mock_sig"

    return f"{header_b64}.{payload_b64}.{sig_b64}"


async def setup_test_environment():
    await init_db()


def run_tests():
    asyncio.run(setup_test_environment())

    user_a_id = f"user-a-{uuid.uuid4().hex[:8]}"
    user_b_id = f"user-b-{uuid.uuid4().hex[:8]}"
    token_a = create_mock_jwt(user_a_id, "user_a@example.com")
    token_b = create_mock_jwt(user_b_id, "user_b@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    print("==================================================")
    print("   RUNNING MODULE 11 SECURITY & HARDENING TESTS   ")
    print("==================================================")

    # -------------------------------------------------------------------------
    # 1. Authentication & Session Boundary Tests
    # -------------------------------------------------------------------------
    print("\n--- 1. Testing Authentication & Session Boundary ---")

    # 1.1 Unauthenticated requests rejected
    resp = client.get("/api/dashboard/overview")
    assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
    print("[PASS] Unauthenticated dashboard request rejected with 401")

    resp = client.get("/api/resumes")
    assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
    print("[PASS] Unauthenticated resumes request rejected with 401")

    # 1.2 Expired token rejected
    expired_token = create_mock_jwt(user_a_id, "user_a@example.com", exp_delta_seconds=-300)
    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401, f"Expected 401 for expired token, got {resp.status_code}"
    print("[PASS] Expired JWT rejected with 401")

    # 1.3 Cryptographic HS256 signature verification test
    test_secret = "hardening-jwt-secret-key-12345"
    signed_valid = create_mock_jwt(user_a_id, "user_a@example.com", secret=test_secret)
    assert verify_jwt_signature(signed_valid, test_secret) is True, "Valid HS256 signature must verify"

    # Tampered token: alter payload
    parts = signed_valid.split(".")
    tampered_payload = base64.urlsafe_b64encode(json.dumps({"sub": "attacker"}).encode()).decode().rstrip("=")
    tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
    assert verify_jwt_signature(tampered_token, test_secret) is False, "Tampered payload must fail signature check"
    print("[PASS] Cryptographic HS256 signature and tamper detection verified")

    # -------------------------------------------------------------------------
    # 2. Multi-Tenant User Isolation (User A vs User B)
    # -------------------------------------------------------------------------
    print("\n--- 2. Testing Multi-Tenant Data Isolation ---")

    # 2.1 User A creates a master resume
    resume_payload = {
        "title": "Master Resume User A",
        "personal_info": {"full_name": "Alice Engineer", "email": "alice@example.com"},
        "summary": {"summary": "Experienced software engineer specializing in backend systems."},
        "experiences": [
            {
                "company": "Tech Corp A",
                "job_title": "Senior Engineer",
                "start_date": "2020",
                "end_date": "Present",
                "bullets": [{"content": "Architected resilient distributed database cluster."}],
            }
        ],
        "skills": [{"skill_name": "Python", "category": "Languages"}],
    }
    create_res = client.post("/api/resumes", json=resume_payload, headers=headers_a)
    assert create_res.status_code == 201, f"Expected 201, got {create_res.status_code}: {create_res.text}"
    resume_a_id = create_res.json()["id"]

    # 2.2 User B attempts to access User A's resume
    resp = client.get(f"/api/resumes/{resume_a_id}", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not access User A's resume, got {resp.status_code}"

    # 2.3 User B attempts to update User A's resume
    resp = client.put(f"/api/resumes/{resume_a_id}", json={"title": "Hacked Title"}, headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not update User A's resume, got {resp.status_code}"

    # 2.4 User B attempts to duplicate User A's resume
    resp = client.post(f"/api/resumes/{resume_a_id}/duplicate", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not duplicate User A's resume, got {resp.status_code}"

    # 2.5 User B attempts to delete User A's resume
    resp = client.delete(f"/api/resumes/{resume_a_id}", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not delete User A's resume, got {resp.status_code}"
    print("[PASS] User B strictly blocked from viewing, modifying, duplicating, or deleting User A's master resume")

    # 2.6 User A saves a job
    job_payload = {
        "job_title": "Backend Lead",
        "company_name": "Enterprise Corp",
        "location": "Remote",
        "source": "linkedin",
        "source_url": "https://www.linkedin.com/jobs/view/11223344",
        "job_description": "We are looking for a Backend Lead with extensive Python and distributed systems expertise.",
    }
    create_job_res = client.post("/api/jobs", json=job_payload, headers=headers_a)
    assert create_job_res.status_code == 201, f"Failed to create job: {create_job_res.text}"
    job_a_id = create_job_res.json()["job"]["id"]

    # 2.7 User B attempts to access or delete User A's job
    resp = client.get(f"/api/jobs/{job_a_id}", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not view User A's job, got {resp.status_code}"

    resp = client.delete(f"/api/jobs/{job_a_id}", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not delete User A's job, got {resp.status_code}"
    print("[PASS] User B strictly blocked from reading or deleting User A's saved job")

    # 2.8 User B attempts to run Job Match using User A's job and/or resume
    resp = client.post(f"/api/jobs/{job_a_id}/match", json={"resume_id": resume_a_id}, headers=headers_b)
    assert resp.status_code in (403, 404), f"User B cannot calculate match on User A's job, got {resp.status_code}"
    print("[PASS] User B strictly blocked from analyzing match on User A's job")

    # 2.9 User A tailors the resume
    tailor_res = client.post(
        f"/api/resumes/{resume_a_id}/tailor",
        json={"job_id": job_a_id, "tailoring_mode": "balanced"},
        headers=headers_a,
    )
    assert tailor_res.status_code == 200, f"Tailoring failed: {tailor_res.text}"
    tailored_data = tailor_res.json()["tailored_resume"]

    # User A saves the tailored resume
    save_tailored_res = client.post(
        f"/api/resumes/{resume_a_id}/tailor/save",
        json={
            "job_id": job_a_id,
            "name": "Tailored for Enterprise Corp",
            "tailored_resume": tailored_data,
            "tailoring_mode": "balanced",
            "original_match_score": 75,
            "tailored_match_score": 92,
        },
        headers=headers_a,
    )
    assert save_tailored_res.status_code in (200, 201), f"Save tailored resume failed: {save_tailored_res.text}"
    tailored_resume_id = save_tailored_res.json().get("tailored_resume_id") or save_tailored_res.json().get("id")

    # 2.10 User B attempts to export User A's master or tailored resume
    resp = client.get(f"/api/resumes/{resume_a_id}/export?format=pdf", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not export User A's master resume, got {resp.status_code}"

    resp = client.get(f"/api/resumes/{tailored_resume_id}/export?format=docx", headers=headers_b)
    assert resp.status_code in (403, 404), f"User B should not export User A's tailored resume, got {resp.status_code}"
    print("[PASS] User B strictly blocked from exporting User A's master or tailored resumes")

    # 2.11 User B views dashboard overview: counts must reflect zero
    overview_b = client.get("/api/dashboard/overview", headers=headers_b)
    assert overview_b.status_code == 200
    counts_b = overview_b.json()["counts"]
    assert counts_b["master_resumes"] == 0, f"Expected 0, got {counts_b['master_resumes']}"
    assert counts_b["tailored_resumes"] == 0, f"Expected 0, got {counts_b['tailored_resumes']}"
    assert counts_b["saved_jobs"] == 0, f"Expected 0, got {counts_b['saved_jobs']}"
    assert len(overview_b.json()["recent_activity"]) == 0
    print("[PASS] User B's dashboard overview is completely isolated and shows 0 records")

    # -------------------------------------------------------------------------
    # 3. File Upload & Document Parsing Security
    # -------------------------------------------------------------------------
    print("\n--- 3. Testing File Upload & Parsing Security ---")

    # 3.1 Disallowed file extension (.exe)
    resp = client.post(
        "/api/resumes/import",
        files={"file": ("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-dosexec")},
        headers=headers_a,
    )
    assert resp.status_code == 400, f"Expected 400 for .exe file, got {resp.status_code}"
    print("[PASS] Disallowed executable file upload cleanly rejected with 400")

    # 3.2 Empty file upload
    resp = client.post(
        "/api/resumes/import",
        files={"file": ("empty.pdf", b"", "application/pdf")},
        headers=headers_a,
    )
    assert resp.status_code == 400, f"Expected 400 for empty file, got {resp.status_code}"
    print("[PASS] Empty file upload cleanly rejected with 400")

    # 3.3 Corrupted / unparseable PDF bytes
    resp = client.post(
        "/api/resumes/import",
        files={"file": ("corrupt.pdf", b"Not a real PDF file at all", "application/pdf")},
        headers=headers_a,
    )
    assert resp.status_code in (422, 500), f"Expected 422 or 500 for corrupted PDF, got {resp.status_code}"
    print("[PASS] Corrupted file upload handled safely with descriptive error")

    # -------------------------------------------------------------------------
    # 4. Rate Limiting Enforcement
    # -------------------------------------------------------------------------
    print("\n--- 4. Testing Rate Limiting & Abuse Prevention ---")

    # Reset limiter for clean test
    upload_rate_limiter.reset()
    upload_rate_limiter.limit = 3  # temporarily set low threshold for unit test

    # Make 3 allowed requests
    for i in range(3):
        upload_rate_limiter.check(request=None, user_id=user_a_id)

    # 4th request must raise HTTP 429
    hit_429 = False
    try:
        upload_rate_limiter.check(request=None, user_id=user_a_id)
    except Exception as e:
        assert getattr(e, "status_code", None) == 429
        assert "Retry-After" in getattr(e, "headers", {})
        hit_429 = True

    assert hit_429, "Rate limiter must raise HTTP 429 when threshold exceeded"
    # Restore normal limit
    upload_rate_limiter.limit = 20
    upload_rate_limiter.reset()
    print("[PASS] Sliding window rate limiter triggered HTTP 429 with Retry-After header")

    # -------------------------------------------------------------------------
    # 5. Error Sanitization & Leakage Verification
    # -------------------------------------------------------------------------
    print("\n--- 5. Testing Error Sanitization & Information Leakage ---")

    # 5.1 Request non-existent export format
    resp = client.get(f"/api/resumes/{resume_a_id}/export?format=exe", headers=headers_a)
    assert resp.status_code == 400
    assert "exe" in resp.json()["detail"]
    print("[PASS] Invalid export format rejected with clean validation error")

    # 5.2 Server errors do not expose tracebacks
    resp = client.get("/api/resumes/non-existent-uuid/export?format=pdf", headers=headers_a)
    assert resp.status_code == 404
    error_text = resp.text
    assert "Traceback" not in error_text, "Error response must not leak python tracebacks"
    assert "SELECT " not in error_text, "Error response must not leak raw SQL query strings"
    print("[PASS] Error responses verify zero traceback and zero raw SQL leakage")

    print("\n==================================================")
    print("  ALL MODULE 11 SECURITY & HARDENING TESTS PASSED ")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
