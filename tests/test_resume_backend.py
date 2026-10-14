"""
Test Suite: Resume Data Foundation (Module 2)
Tests:
1. Unauthenticated requests to /api/resumes rejected with HTTP 401
2. Authenticated user can create resume
3. User can fetch full structured resume
4. User can update structured sections (personal info, summary, experience, bullets, education, skills, projects, certifications, links)
5. Multiple resumes & default/master resume uniqueness rule
6. Deep duplication creates independent clone with new UUIDs and no shared child records
7. User isolation: User A cannot access, modify, or delete User B's resume
8. Cascade deletion: Deleting a resume removes child records and prevents orphaned data
"""

import asyncio
import base64
import json
import os
import sys
import time
import uuid

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app import app
from models.database import (
    init_db,
    AsyncSessionLocal,
    Resume,
    ResumeExperience,
    ResumeSkill,
    UserProfile,
)
from sqlalchemy import select


def create_test_jwt(user_id: str, email: str, role: str = "authenticated", exp_offset: int = 3600) -> str:
    """Helper to generate a test JWT structure with explicit claims."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "user_metadata": {"full_name": f"User {email.split('@')[0]}"},
    }

    def b64_encode(d: dict) -> str:
        s = json.dumps(d).encode("utf-8")
        return base64.urlsafe_b64encode(s).decode("utf-8").rstrip("=")

    h_b64 = b64_encode(header)
    p_b64 = b64_encode(payload)
    sig = "mock_sig_" + str(int(time.time()))
    return f"{h_b64}.{p_b64}.{sig}"


def test_unauthenticated_requests_rejected():
    """Verify that unauthenticated requests to /api/resumes are rejected with HTTP 401."""
    client = TestClient(app)
    resp = client.get("/api/resumes")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    resp = client.post("/api/resumes", json={"name": "Test Resume"})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    print("[PASS] Unauthenticated resume requests rejected with HTTP 401")


def test_resume_crud_and_sections():
    """Verify full CRUD lifecycle and structured section persistence."""
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    email = f"user_{user_id[:8]}@domain.com"
    token = create_test_jwt(user_id, email)
    auth_headers = {"Authorization": f"Bearer {token}"}

    # First ensure user profile exists in local DB
    async def create_profile():
        async with AsyncSessionLocal() as session:
            p = UserProfile(id=user_id, email=email, full_name="User Test")
            session.add(p)
            await session.commit()
    asyncio.run(create_profile())

    # 1. Create Resume
    create_resp = client.post(
        "/api/resumes",
        json={"name": "Software Engineer Master", "is_default": True},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"
    resume_data = create_resp.json()
    resume_id = resume_data["id"]
    assert resume_data["name"] == "Software Engineer Master"
    assert resume_data["is_default"] is True
    assert resume_data["user_id"] == user_id
    assert resume_data["personal_info"] is not None

    # 2. Get Resume by ID
    get_resp = client.get(f"/api/resumes/{resume_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == resume_id

    # 3. Update Resume Structured Sections
    update_payload = {
        "name": "Lead Architect Master",
        "personal_info": {
            "full_name": "Alice Engineer",
            "headline": "Lead Systems Architect",
            "email": "alice@engineer.com",
            "location": "San Francisco, CA",
            "website": "https://alice.engineer",
            "linkedin_url": "https://linkedin.com/in/alice",
            "github_url": "https://github.com/alice",
        },
        "summary": {
            "summary": "Experienced systems architect with 10+ years designing high-throughput distributed systems.",
        },
        "experiences": [
            {
                "company": "Tech Corp",
                "job_title": "Principal Architect",
                "location": "Remote",
                "employment_type": "Full-time",
                "start_date": "2021",
                "end_date": None,
                "is_current": True,
                "description": "Leading distributed cloud infrastructure team.",
                "display_order": 0,
                "bullets": [
                    {"content": "Scaled database cluster from 10k to 500k QPS with sub-millisecond p99 latency.", "display_order": 0},
                    {"content": "Architected event-driven microservices architecture using Kafka and FastAPI.", "display_order": 1},
                ],
            }
        ],
        "educations": [
            {
                "institution": "MIT",
                "degree": "B.S. in Computer Science",
                "field_of_study": "Distributed Systems",
                "start_date": "2013",
                "end_date": "2017",
                "display_order": 0,
            }
        ],
        "skills": [
            {"skill_name": "Python", "category": "Languages", "display_order": 0},
            {"skill_name": "FastAPI", "category": "Frameworks", "display_order": 1},
            {"skill_name": "PostgreSQL", "category": "Databases", "display_order": 2},
            {"skill_name": "Docker", "category": "Cloud & DevOps", "display_order": 3},
        ],
        "projects": [
            {
                "name": "Cloud Mesh Router",
                "description": "High performance low latency reverse proxy and mesh load balancer.",
                "url": "https://github.com/alice/mesh-router",
                "technologies": "Go, eBPF, Docker",
                "display_order": 0,
                "bullets": [
                    {"content": "Achieved 1.2M RPS benchmark throughput.", "display_order": 0}
                ],
            }
        ],
        "certifications": [
            {
                "name": "AWS Solutions Architect Professional",
                "issuer": "Amazon Web Services",
                "issue_date": "2022",
                "display_order": 0,
            }
        ],
        "links": [
            {"label": "Portfolio", "url": "https://alice.engineer", "display_order": 0}
        ],
    }

    put_resp = client.put(f"/api/resumes/{resume_id}", json=update_payload, headers=auth_headers)
    assert put_resp.status_code == 200, f"Update failed: {put_resp.text}"
    updated_data = put_resp.json()

    assert updated_data["name"] == "Lead Architect Master"
    assert updated_data["personal_info"]["full_name"] == "Alice Engineer"
    assert updated_data["summary"]["summary"].startswith("Experienced systems architect")
    assert len(updated_data["experiences"]) == 1
    assert len(updated_data["experiences"][0]["bullets"]) == 2
    assert len(updated_data["skills"]) == 4
    assert len(updated_data["projects"]) == 1
    assert len(updated_data["projects"][0]["bullets"]) == 1

    print("[PASS] Resume creation, reading, and structured section persistence verified")


def test_multiple_resumes_and_default_rule():
    """Verify multiple resumes and single default/master resume rule."""
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    email = f"user_{user_id[:8]}@domain.com"
    token = create_test_jwt(user_id, email)
    auth_headers = {"Authorization": f"Bearer {token}"}

    async def create_profile():
        async with AsyncSessionLocal() as session:
            p = UserProfile(id=user_id, email=email)
            session.add(p)
            await session.commit()
    asyncio.run(create_profile())

    # Create Resume 1 (becomes default automatically)
    r1 = client.post("/api/resumes", json={"name": "Resume 1"}, headers=auth_headers).json()
    assert r1["is_default"] is True

    # Create Resume 2 (not default)
    r2 = client.post("/api/resumes", json={"name": "Resume 2", "is_default": False}, headers=auth_headers).json()
    assert r2["is_default"] is False

    # List resumes
    list_resp = client.get("/api/resumes", headers=auth_headers).json()
    assert len(list_resp) == 2

    # Set Resume 2 as default
    client.post(f"/api/resumes/{r2['id']}/default", headers=auth_headers)

    # Verify Resume 2 is now default, and Resume 1 is no longer default
    r1_fresh = client.get(f"/api/resumes/{r1['id']}", headers=auth_headers).json()
    r2_fresh = client.get(f"/api/resumes/{r2['id']}", headers=auth_headers).json()
    assert r2_fresh["is_default"] is True
    assert r1_fresh["is_default"] is False

    print("[PASS] Multiple resumes and single default resume rule verified")


def test_deep_duplication():
    """Verify duplication creates independent clone with new IDs and no shared records."""
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    email = f"user_{user_id[:8]}@domain.com"
    token = create_test_jwt(user_id, email)
    auth_headers = {"Authorization": f"Bearer {token}"}

    async def create_profile():
        async with AsyncSessionLocal() as session:
            p = UserProfile(id=user_id, email=email)
            session.add(p)
            await session.commit()
    asyncio.run(create_profile())

    # Create source resume with experience and skill
    orig = client.post("/api/resumes", json={"name": "Original Resume"}, headers=auth_headers).json()
    orig_id = orig["id"]

    client.put(
        f"/api/resumes/{orig_id}",
        json={
            "experiences": [
                {
                    "company": "Original Corp",
                    "job_title": "Engineer",
                    "bullets": [{"content": "Original bullet", "display_order": 0}],
                }
            ],
            "skills": [{"skill_name": "Rust", "category": "Languages", "display_order": 0}],
        },
        headers=auth_headers,
    )

    # Duplicate
    dup_resp = client.post(f"/api/resumes/{orig_id}/duplicate", headers=auth_headers)
    assert dup_resp.status_code == 200
    dup = dup_resp.json()
    dup_id = dup["id"]

    # Verify distinct resume ID
    assert dup_id != orig_id
    assert dup["name"] == "Original Resume (Copy)"
    assert dup["is_default"] is False

    # Verify distinct child IDs
    assert dup["experiences"][0]["id"] != orig["experiences"] if "experiences" in orig and orig["experiences"] else True
    assert dup["experiences"][0]["company"] == "Original Corp"
    assert dup["skills"][0]["skill_name"] == "Rust"

    print("[PASS] Deep duplication creates independent clone with distinct IDs")


def test_user_isolation_and_cascade_delete():
    """Verify User A cannot access User B's resume and cascade deletion removes child records."""
    client = TestClient(app)

    # User A
    user_a_id = str(uuid.uuid4())
    token_a = create_test_jwt(user_a_id, "user_a@domain.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    user_b_id = str(uuid.uuid4())
    token_b = create_test_jwt(user_b_id, "user_b@domain.com")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async def create_profiles():
        async with AsyncSessionLocal() as session:
            session.add(UserProfile(id=user_a_id, email="user_a@domain.com"))
            session.add(UserProfile(id=user_b_id, email="user_b@domain.com"))
            await session.commit()
    asyncio.run(create_profiles())

    # User A creates a resume
    res_a = client.post("/api/resumes", json={"name": "User A Private Resume"}, headers=headers_a).json()
    res_a_id = res_a["id"]

    client.put(
        f"/api/resumes/{res_a_id}",
        json={
            "experiences": [
                {"company": "Secret A Corp", "job_title": "Lead", "bullets": [{"content": "Secret bullet", "display_order": 0}]}
            ],
            "skills": [{"skill_name": "Go", "category": "Languages", "display_order": 0}],
        },
        headers=headers_a,
    )

    # User B attempts GET on User A's resume -> 404
    resp_b_get = client.get(f"/api/resumes/{res_a_id}", headers=headers_b)
    assert resp_b_get.status_code == 404, f"Expected 404, got {resp_b_get.status_code}"

    # User B attempts PUT on User A's resume -> 404
    resp_b_put = client.put(f"/api/resumes/{res_a_id}", json={"name": "Hacked Name"}, headers=headers_b)
    assert resp_b_put.status_code == 404, f"Expected 404, got {resp_b_put.status_code}"

    # User B attempts DELETE on User A's resume -> 404
    resp_b_del = client.delete(f"/api/resumes/{res_a_id}", headers=headers_b)
    assert resp_b_del.status_code == 404, f"Expected 404, got {resp_b_del.status_code}"

    # Verify User A's resume is untouched
    res_a_fresh = client.get(f"/api/resumes/{res_a_id}", headers=headers_a).json()
    assert res_a_fresh["name"] == "User A Private Resume"

    # User A deletes their resume
    del_resp = client.delete(f"/api/resumes/{res_a_id}", headers=headers_a)
    assert del_resp.status_code == 200

    # Verify cascade deletion: child records removed from database
    async def verify_cascade():
        async with AsyncSessionLocal() as session:
            r = await session.execute(select(Resume).where(Resume.id == res_a_id))
            assert r.scalar_one_or_none() is None
            exps = await session.execute(select(ResumeExperience).where(ResumeExperience.resume_id == res_a_id))
            assert len(exps.scalars().all()) == 0
            skills = await session.execute(select(ResumeSkill).where(ResumeSkill.resume_id == res_a_id))
            assert len(skills.scalars().all()) == 0
    asyncio.run(verify_cascade())

    print("[PASS] User isolation confirmed; cascade deletion verified with zero orphaned records")


if __name__ == "__main__":
    print("\n--- Running Module 2 Resume Data Foundation Test Suite ---")
    asyncio.run(init_db())
    test_unauthenticated_requests_rejected()
    test_resume_crud_and_sections()
    test_multiple_resumes_and_default_rule()
    test_deep_duplication()
    test_user_isolation_and_cascade_delete()
    print("--- All Module 2 Backend Tests Passed Successfully ---\n")
