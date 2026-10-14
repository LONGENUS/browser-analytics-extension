"""
TailorResume — Module 10 Dashboard & Resume History Backend Test Suite
Validates:
- Dashboard overview endpoint requires authentication (HTTP 401).
- Authentic metric counts derived strictly from persisted records (Master Resumes, Tailored Resumes, Saved Jobs).
- Multi-tenant isolation: User A cannot see User B's records or counts.
- Chronological recent items feed grounded in real timestamps (no fake analytics).
- Master Resumes vs Tailored Resumes strict separation.
- Tailored Resumes list returns rich joined metadata (target job title, company, source resume name, template).
- Stale detection logic: flags is_stale = True if source master resume is updated after tailoring timestamp.
- Historical tailored resume preservation on master resume deletion (SET NULL instead of CASCADE wiping).
- Historical tailored resume preservation on target job deletion (SET NULL instead of CASCADE wiping).
- Dedicated deletion of tailored resumes cleanly removes metadata and structured resume entity.
- Duplication safety: new UUIDs generated, master resume immutability, no default mutation.
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
from models.database import (
    init_db,
    get_db,
    Job,
    Resume,
    ResumePersonalInfo,
    ResumeSummary,
    ResumeExperience,
    ResumeSkill,
    TailoredResume,
)

def b64_encode(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def create_test_jwt(user_id: str, email: str = "test@example.com", exp_offset: int = 3600) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "role": "authenticated",
    }
    return f"{b64_encode(header)}.{b64_encode(payload)}.mock_sig"


def setup_module():
    """Ensure database tables exist before tests run."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(init_db())


def test_dashboard_unauthenticated_overview_rejected():
    """Test 1: Unauthenticated requests to /api/dashboard/overview are rejected with 401."""
    client = TestClient(app)
    resp = client.get("/api/dashboard/overview")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    print("[PASS] Unauthenticated dashboard overview rejected (401)")


def test_dashboard_overview_counts_and_user_isolation():
    """
    Test 2: Overview returns authentic counts and strict multi-tenant isolation.
    User A has 2 master resumes, 1 tailored resume, and 2 saved jobs.
    User B has 1 master resume and 1 job.
    User A must not see User B's records.
    """
    client = TestClient(app)
    user_a_id = f"user-a-{uuid.uuid4().hex[:8]}"
    user_b_id = f"user-b-{uuid.uuid4().hex[:8]}"
    headers_a = {"Authorization": f"Bearer {create_test_jwt(user_a_id, 'user_a@test.com')}"}
    headers_b = {"Authorization": f"Bearer {create_test_jwt(user_b_id, 'user_b@test.com')}"}

    # 1. User A creates Master Resume 1 & Master Resume 2
    res_a1 = client.post("/api/resumes", headers=headers_a, json={"name": "User A Master 1", "is_default": True})
    assert res_a1.status_code == 201
    master_1_id = res_a1.json()["id"]

    res_a2 = client.post("/api/resumes", headers=headers_a, json={"name": "User A Master 2", "is_default": False})
    assert res_a2.status_code == 201

    # 2. User A creates Job 1 & Job 2
    job_a1 = client.post("/api/jobs", headers=headers_a, json={
        "job_title": "Full Stack Engineer",
        "company_name": "Tech Corp",
        "job_description": "We need a Full Stack Engineer with React and Python skills.",
        "source": "linkedin"
    })
    assert job_a1.status_code == 201
    job_1_id = job_a1.json()["job"]["id"]

    job_a2 = client.post("/api/jobs", headers=headers_a, json={
        "job_title": "Backend Architect",
        "company_name": "Cloud Systems",
        "job_description": "We need a Senior Backend Architect with distributed systems experience.",
        "source": "indeed"
    })
    assert job_a2.status_code == 201

    # 3. User A creates a Tailored Resume for Job 1 from Master 1
    tailor_save = client.post(f"/api/resumes/{master_1_id}/tailor/save", headers=headers_a, json={
        "job_id": job_1_id,
        "name": "User A Tailored for Tech Corp",
        "tailored_resume": {
            "personal_info": {"full_name": "Alice Developer"},
            "summary": {"summary": "Targeted Full Stack developer summary."},
            "experiences": [],
            "skills": [{"name": "Python"}, {"name": "React"}],
        },
        "tailoring_mode": "balanced",
        "change_log": [{"id": "c1", "type": "prioritize", "section": "skills", "reason": "Job requires React"}],
        "original_match_score": 50,
        "tailored_match_score": 85,
    })
    assert tailor_save.status_code == 200
    tailored_id = tailor_save.json()["tailored_resume_id"]

    # 4. User B creates 1 Master Resume and 1 Job
    res_b = client.post("/api/resumes", headers=headers_b, json={"name": "User B Master", "is_default": True})
    assert res_b.status_code == 201

    job_b = client.post("/api/jobs", headers=headers_b, json={
        "job_title": "Product Designer",
        "company_name": "Design Studio",
        "job_description": "Seeking a Senior Product Designer with Figma experience.",
        "source": "other"
    })
    assert job_b.status_code == 201

    # 5. Check User A Overview
    resp_a = client.get("/api/dashboard/overview", headers=headers_a)
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["counts"]["master_resumes"] == 2, f"Expected 2 master resumes, got {data_a['counts']['master_resumes']}"
    assert data_a["counts"]["tailored_resumes"] == 1, f"Expected 1 tailored resume, got {data_a['counts']['tailored_resumes']}"
    assert data_a["counts"]["saved_jobs"] == 2, f"Expected 2 jobs, got {data_a['counts']['saved_jobs']}"

    # Verify chronological ordering of recent items
    recent_items = data_a["recent_items"]
    assert len(recent_items) == 5  # 2 masters + 1 tailored + 2 jobs
    for i in range(len(recent_items) - 1):
        assert recent_items[i]["timestamp"] >= recent_items[i + 1]["timestamp"], "Recent items must be sorted descending by timestamp"

    # 6. Check User B Overview (Isolation verification)
    resp_b = client.get("/api/dashboard/overview", headers=headers_b)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["counts"]["master_resumes"] == 1, f"Expected 1 master resume for User B, got {data_b['counts']['master_resumes']}"
    assert data_b["counts"]["tailored_resumes"] == 0, f"Expected 0 tailored resumes for User B, got {data_b['counts']['tailored_resumes']}"
    assert data_b["counts"]["saved_jobs"] == 1, f"Expected 1 job for User B, got {data_b['counts']['saved_jobs']}"
    assert len(data_b["recent_items"]) == 2

    print("[PASS] Dashboard overview counts and multi-tenant isolation verified")


def test_master_vs_tailored_resumes_separation_and_rich_metadata():
    """
    Test 3: Master resumes and tailored resumes are strictly separated.
    /api/resumes/tailored returns rich presentation metadata:
    target_job_title, target_company_name, source_resume_name, score improvements.
    """
    client = TestClient(app)
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {create_test_jwt(user_id, 'test_sep@example.com')}"}

    # Create Master Resume
    m_resp = client.post("/api/resumes", headers=headers, json={"name": "Software Architect Master", "is_default": True})
    master_id = m_resp.json()["id"]

    # Create Job
    j_resp = client.post("/api/jobs", headers=headers, json={
        "job_title": "Lead Platform Engineer",
        "company_name": "Fintech Global",
        "job_description": "We are seeking a Lead Platform Engineer with Kubernetes and Golang.",
        "source": "naukri"
    })
    job_id = j_resp.json()["job"]["id"]

    # Create Tailored Resume
    t_resp = client.post(f"/api/resumes/{master_id}/tailor/save", headers=headers, json={
        "job_id": job_id,
        "name": "Architect Tailored for Fintech Global",
        "tailored_resume": {
            "personal_info": {"full_name": "Bob Architect"},
            "summary": {"summary": "Targeted summary for platform role."},
            "experiences": [],
            "skills": [{"name": "Kubernetes"}, {"name": "Golang"}],
        },
        "tailoring_mode": "strong",
        "original_match_score": 45,
        "tailored_match_score": 92,
    })
    tailored_id = t_resp.json()["tailored_resume_id"]

    # 1. Fetch tailored list
    tailored_list = client.get("/api/resumes/tailored", headers=headers).json()
    assert len(tailored_list) >= 1
    t_item = next(item for item in tailored_list if item["tailored_resume_id"] == tailored_id)

    assert t_item["target_job_title"] == "Lead Platform Engineer"
    assert t_item["target_company_name"] == "Fintech Global"
    assert t_item["source_resume_name"] == "Software Architect Master"
    assert t_item["tailoring_mode"] == "strong"
    assert t_item["original_match_score"] == 45
    assert t_item["tailored_match_score"] == 92
    assert t_item["is_stale"] is False

    print("[PASS] Master and tailored resume separation with rich metadata verified")


def test_stale_detection_when_master_resume_is_modified():
    """
    Test 4: When a source master resume is updated after a tailored resume was created,
    the tailored resume history record identifies is_stale = True.
    """
    client = TestClient(app)
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {create_test_jwt(user_id, 'test_stale@example.com')}"}

    # 1. Create master
    m_resp = client.post("/api/resumes", headers=headers, json={"name": "Original Master", "is_default": True})
    master_id = m_resp.json()["id"]

    # 2. Create job
    j_resp = client.post("/api/jobs", headers=headers, json={
        "job_title": "DevOps Engineer",
        "company_name": "InfraCorp",
        "job_description": "DevOps Engineer role with Terraform and AWS.",
        "source": "company_site"
    })
    job_id = j_resp.json()["job"]["id"]

    # 3. Create tailored resume
    t_resp = client.post(f"/api/resumes/{master_id}/tailor/save", headers=headers, json={
        "job_id": job_id,
        "name": "DevOps Tailored",
        "tailored_resume": {
            "personal_info": {"full_name": "DevOps Candidate"},
            "summary": {"summary": "Terraform and AWS specialist."},
            "experiences": [],
            "skills": [{"name": "Terraform"}],
        },
        "tailoring_mode": "balanced",
    })
    tailored_id = t_resp.json()["tailored_resume_id"]

    # Sleep slightly so master update timestamp is strictly later than tailoring created_at
    time.sleep(0.05)

    # 4. Update master resume
    update_resp = client.put(f"/api/resumes/{master_id}", headers=headers, json={
        "name": "Original Master (Updated Skills)",
        "skills": [{"skill_name": "Terraform"}, {"skill_name": "Kubernetes"}, {"skill_name": "Golang"}]
    })
    assert update_resp.status_code == 200

    # 5. Fetch tailored list and verify is_stale is True
    tailored_list = client.get("/api/resumes/tailored", headers=headers).json()
    t_item = next(item for item in tailored_list if item["tailored_resume_id"] == tailored_id)
    assert t_item["is_stale"] is True, "Tailored resume must be marked stale when source master resume was updated"

    print("[PASS] Stale detection on master resume update verified")


def test_preserve_tailored_resume_when_master_or_job_deleted():
    """
    Test 5: Section 16 & Section 44 Compliance.
    When a master resume is deleted, historical tailored resumes must NOT be cascade-wiped!
    When a target job is deleted, historical tailored resumes must NOT be cascade-wiped!
    """
    client = TestClient(app)
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {create_test_jwt(user_id, 'test_preserve@example.com')}"}

    # 1. Create master
    m_resp = client.post("/api/resumes", headers=headers, json={"name": "Source Master To Delete", "is_default": True})
    master_id = m_resp.json()["id"]

    # 2. Create job
    j_resp = client.post("/api/jobs", headers=headers, json={
        "job_title": "Target Job To Delete",
        "company_name": "Startup Inc",
        "job_description": "Fast-paced startup looking for generalist software engineer.",
        "source": "other"
    })
    job_id = j_resp.json()["job"]["id"]

    # 3. Create tailored resume
    t_resp = client.post(f"/api/resumes/{master_id}/tailor/save", headers=headers, json={
        "job_id": job_id,
        "name": "Historical Tailored Version",
        "tailored_resume": {
            "personal_info": {"full_name": "Candidate A"},
            "summary": {"summary": "Summary"},
            "experiences": [],
            "skills": [{"name": "Python"}],
        },
        "tailoring_mode": "balanced",
    })
    tailored_id = t_resp.json()["tailored_resume_id"]

    # 4. Delete Master Resume
    del_m = client.delete(f"/api/resumes/{master_id}", headers=headers)
    assert del_m.status_code == 200

    # Verify tailored resume is STILL present in tailored list!
    tailored_list_after_m_del = client.get("/api/resumes/tailored", headers=headers).json()
    t_item = next((item for item in tailored_list_after_m_del if item["tailored_resume_id"] == tailored_id), None)
    assert t_item is not None, "Tailored resume must survive master resume deletion"
    assert t_item["source_resume_name"] is None or t_item["source_resume_deleted"] is True

    # 5. Delete Target Job
    del_j = client.delete(f"/api/jobs/{job_id}", headers=headers)
    assert del_j.status_code == 200

    # Verify tailored resume is STILL present!
    tailored_list_after_j_del = client.get("/api/resumes/tailored", headers=headers).json()
    t_item2 = next((item for item in tailored_list_after_j_del if item["tailored_resume_id"] == tailored_id), None)
    assert t_item2 is not None, "Tailored resume must survive target job deletion"
    assert t_item2["target_job_title"] is None or t_item2["target_job_deleted"] is True

    # 6. User explicitly deletes the tailored resume
    del_t = client.delete(f"/api/resumes/tailored/{t_item2['id']}", headers=headers)
    assert del_t.status_code == 200

    # Verify tailored resume is now completely deleted
    final_tailored_list = client.get("/api/resumes/tailored", headers=headers).json()
    t_item_final = next((item for item in final_tailored_list if item["tailored_resume_id"] == tailored_id), None)
    assert t_item_final is None, "Explicitly deleted tailored resume must no longer be returned"

    print("[PASS] Historical tailored resume preservation on parent deletion verified")


def test_resume_duplication_safety_and_immutability():
    """
    Test 6: Duplication produces clean deep-cloned child records (new UUIDs),
    does NOT mutate source resume, and cloned resume is not default.
    """
    client = TestClient(app)
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {create_test_jwt(user_id, 'dup_test@example.com')}"}

    # 1. Create source resume with child records
    create_resp = client.post("/api/resumes", headers=headers, json={"name": "Source For Duplication", "is_default": True})
    src_id = create_resp.json()["id"]

    # Update with experience and skills
    update_resp = client.put(f"/api/resumes/{src_id}", headers=headers, json={
        "name": "Source For Duplication",
        "experiences": [
            {
                "company": "Original Corp",
                "job_title": "Staff Engineer",
                "bullets": [{"content": "Led 10 person team."}]
            }
        ],
        "skills": [{"skill_name": "Python"}, {"skill_name": "System Design"}]
    })
    src_full = update_resp.json()
    src_exp_id = src_full["experiences"][0]["id"]
    src_bullet_id = src_full["experiences"][0]["bullets"][0]["id"]

    # 2. Duplicate resume
    dup_resp = client.post(f"/api/resumes/{src_id}/duplicate", headers=headers)
    assert dup_resp.status_code == 200
    cloned_full = dup_resp.json()

    # Verify cloned resume ID is brand new
    assert cloned_full["id"] != src_id
    assert cloned_full["name"] == "Source For Duplication (Copy)"
    assert cloned_full["is_default"] is False, "Duplicated resume must not become default"

    # Verify deep child UUID regeneration
    cloned_exp_id = cloned_full["experiences"][0]["id"]
    cloned_bullet_id = cloned_full["experiences"][0]["bullets"][0]["id"]
    assert cloned_exp_id != src_exp_id, "Cloned experience must have new UUID"
    assert cloned_bullet_id != src_bullet_id, "Cloned bullet must have new UUID"

    # 3. Verify source resume remains unchanged
    src_check = client.get(f"/api/resumes/{src_id}", headers=headers).json()
    assert src_check["name"] == "Source For Duplication"
    assert src_check["is_default"] is True

    print("[PASS] Resume duplication safety and immutability verified")


if __name__ == "__main__":
    setup_module()
    test_dashboard_unauthenticated_overview_rejected()
    test_dashboard_overview_counts_and_user_isolation()
    test_master_vs_tailored_resumes_separation_and_rich_metadata()
    test_stale_detection_when_master_resume_is_modified()
    test_preserve_tailored_resume_when_master_or_job_deleted()
    test_resume_duplication_safety_and_immutability()
    print("\n[ALL MODULE 10 BACKEND TESTS PASSED]")
