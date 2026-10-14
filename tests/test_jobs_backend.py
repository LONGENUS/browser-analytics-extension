"""
TailorResume — Module 4 Backend Jobs Test Suite
Validates:
- Protected routes require authenticated Bearer token (HTTP 401).
- Server derives user_id strictly from Supabase Auth identity.
- User isolation: User A cannot read, update, or delete User B's saved jobs.
- Duplicate job detection on canonical source_url per user.
- URL canonicalization strips tracking queries while preserving identifiers.
- Comprehensive CRUD validation (title, description constraints).
"""

import asyncio
import json
import base64
import time
import uuid

import os
import sys

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app import app
from models.database import init_db, get_db, Job
from routes.jobs import canonicalize_job_url


def b64_encode(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def create_test_jwt(user_id: str, email: str = "applicant@test.com", exp_offset: int = 3600) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "role": "authenticated",
    }
    return f"{b64_encode(header)}.{b64_encode(payload)}.mock_sig"


def test_url_canonicalization():
    """Verify conservative URL normalization removes tracking params but keeps job IDs."""
    url1 = "https://www.linkedin.com/jobs/view/123456789/?refId=abcd&trackingId=efgh&utm_source=share"
    canon1 = canonicalize_job_url(url1)
    assert canon1 == "https://www.linkedin.com/jobs/view/123456789", f"Got {canon1}"

    url2 = "https://www.indeed.com/viewjob?jk=abcdef123456&utm_campaign=google_jobs_apply&utm_source=google"
    canon2 = canonicalize_job_url(url2)
    assert "jk=abcdef123456" in canon2, f"Should keep jk query: {canon2}"
    assert "utm_source" not in canon2, f"Should remove utm: {canon2}"

    url3 = "https://boards.greenhouse.io/company/jobs/998877/"
    canon3 = canonicalize_job_url(url3)
    assert canon3 == "https://boards.greenhouse.io/company/jobs/998877"

    print("[PASS] URL canonicalization correctly handles tracking parameters and identifiers")


def test_unauthenticated_requests_rejected():
    """Verify that protected job routes reject unauthenticated calls with 401."""
    client = TestClient(app)

    # List jobs
    resp = client.get("/api/jobs")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # Create job
    resp = client.post("/api/jobs", json={
        "job_title": "Software Engineer",
        "job_description": "We are seeking a senior software engineer to build scalable services."
    })
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # Get job
    fake_id = str(uuid.uuid4())
    resp = client.get(f"/api/jobs/{fake_id}")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # Update job
    resp = client.put(f"/api/jobs/{fake_id}", json={"job_title": "Hacker"})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # Delete job
    resp = client.delete(f"/api/jobs/{fake_id}")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    print("[PASS] Unauthenticated job requests rejected with HTTP 401")


def test_job_crud_and_user_isolation():
    """Verify job creation, listing, updating, deleting, and cross-user isolation."""
    client = TestClient(app)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    token_a = create_test_jwt(user_id=user_a_id, email="usera@company.com")
    token_b = create_test_jwt(user_id=user_b_id, email="userb@company.com")

    # 1. User A creates a job (with attempted malicious client user_id spoofing)
    create_payload = {
        "user_id": user_b_id,  # Spoofed user_id in body
        "job_title": "Senior Backend Engineer",
        "company_name": "Acme Corp",
        "location": "Bengaluru, India",
        "source": "linkedin",
        "source_url": "https://www.linkedin.com/jobs/view/99887766/?utm_source=share",
        "job_description": "Building mission-critical microservices with Python, FastAPI, and PostgreSQL.",
        "employment_type": "Full-time",
        "work_mode": "Hybrid",
        "salary_text": "$120,000 - $150,000",
    }

    resp = client.post(
        "/api/jobs",
        json=create_payload,
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["duplicate"] is False
    job_a = data["job"]
    job_a_id = job_a["id"]

    # Server MUST bind job to User A, not spoofed User B!
    assert job_a["user_id"] == user_a_id, f"Expected {user_a_id}, got {job_a['user_id']}"
    assert job_a["job_title"] == "Senior Backend Engineer"
    assert job_a["company_name"] == "Acme Corp"
    # Canonical URL must have utm_source removed
    assert job_a["source_url"] == "https://www.linkedin.com/jobs/view/99887766"

    # 2. User A lists jobs -> must see job_a
    resp = client.get("/api/jobs", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    jobs_list_a = resp.json()
    assert len(jobs_list_a) >= 1
    assert any(j["id"] == job_a_id for j in jobs_list_a)

    # 3. User B lists jobs -> must NOT see User A's job!
    resp = client.get("/api/jobs", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 200
    jobs_list_b = resp.json()
    assert not any(j["id"] == job_a_id for j in jobs_list_b), "User B saw User A's job!"

    # 4. User B attempts to access User A's job directly -> HTTP 404
    resp = client.get(f"/api/jobs/{job_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 404, f"Expected 404 for User B, got {resp.status_code}"

    # 5. User B attempts to update User A's job -> HTTP 404
    resp = client.put(
        f"/api/jobs/{job_a_id}",
        json={"job_title": "Defaced Title"},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp.status_code == 404

    # 6. User B attempts to delete User A's job -> HTTP 404
    resp = client.delete(f"/api/jobs/{job_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 404

    # 7. User A updates job details
    update_payload = {
        "job_title": "Lead Backend Engineer",
        "location": "Remote",
        "job_description": "Updated job description with more detailed technical responsibilities."
    }
    resp = client.put(
        f"/api/jobs/{job_a_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 200
    updated_job = resp.json()
    assert updated_job["job_title"] == "Lead Backend Engineer"
    assert updated_job["location"] == "Remote"
    assert updated_job["user_id"] == user_a_id

    # 8. Duplicate job test: User A posts the same canonical URL
    resp_dup = client.post(
        "/api/jobs",
        json={
            "job_title": "Senior Backend Engineer",
            "source_url": "https://www.linkedin.com/jobs/view/99887766/?refId=random_ref",
            "job_description": "Another description for same listing."
        },
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_dup.status_code == 201
    dup_data = resp_dup.json()
    assert dup_data["duplicate"] is True
    assert dup_data["existing_job"]["id"] == job_a_id

    # 9. User A deletes job
    resp_del = client.delete(f"/api/jobs/{job_a_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_del.status_code == 200
    assert resp_del.json()["deleted"] is True

    # 10. Verify job is gone
    resp_get = client.get(f"/api/jobs/{job_a_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_get.status_code == 404

    print("[PASS] Job CRUD, duplicate handling, and multi-tenant user isolation verified")


def test_validation_constraints():
    """Verify input validation rejects invalid job payloads."""
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    token = create_test_jwt(user_id=user_id)

    # 1. Missing job description
    resp = client.post(
        "/api/jobs",
        json={"job_title": "Software Engineer"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"

    # 2. Too short job description (< 10 chars)
    resp = client.post(
        "/api/jobs",
        json={"job_title": "Software Engineer", "job_description": "Short"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 422

    # 3. Empty job title
    resp = client.post(
        "/api/jobs",
        json={"job_title": "   ", "job_description": "Valid detailed job description text."},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 422

    print("[PASS] Job schema validation constraints correctly enforced")


if __name__ == "__main__":
    print("\n--- Running Module 4 Backend Jobs Test Suite ---")
    asyncio.run(init_db())
    test_url_canonicalization()
    test_unauthenticated_requests_rejected()
    test_job_crud_and_user_isolation()
    test_validation_constraints()
    print("--- All Module 4 Backend Tests Passed Successfully ---\n")
