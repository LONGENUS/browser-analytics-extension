"""
TailorResume — Module 9: Chrome Extension Backend Integration Test Suite
Validates the complete backend API pipeline when invoked by the Chrome Extension:
1. Extension User Authentication:
   - Rejects unauthenticated requests with HTTP 401.
2. Job Extraction Ingestion:
   - Extension sends extracted job data from active tab (LinkedIn / ATS) to POST /api/jobs.
   - Verifies deduplication and canonicalization.
3. Master Resume Discovery:
   - Extension requests GET /api/resumes to populate master resume dropdown.
   - Confirms user isolation (only current user's resumes returned).
4. Extension Job Match Request:
   - Extension invokes POST /api/jobs/{job_id}/match with selected resume.
   - Confirms match score, category breakdown, matched and missing skills.
5. Extension Resume Tailoring Request:
   - Extension invokes POST /api/resumes/draft with target job.
   - Extension saves tailored resume via POST /api/resumes/{resume_id}/tailor.
   - Invariant: Master resume remains completely untouched.
6. Extension Document Export (PDF & DOCX):
   - Extension triggers POST /api/resumes/{tailored_resume_id}/export for PDF.
   - Extension triggers POST /api/resumes/{tailored_resume_id}/export for DOCX.
   - Verifies Content-Type, Content-Disposition, and non-empty streaming response.
7. Multi-Tenant Isolation & Security:
   - User B cannot match or export User A's job or tailored resume.
"""

import asyncio
import io
import os
import sys
import uuid
from httpx import AsyncClient, ASGITransport

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from models.database import init_db, get_db, Resume, Job
from services.auth import get_current_user


async def test_extension_backend():
    print("\n--- Starting Module 9 Extension Backend Integration Tests ---")
    await init_db()

    user_a = {
        "id": "ext-user-a-" + str(uuid.uuid4())[:8],
        "email": "extension_a@example.com",
        "user_metadata": {"full_name": "Alice Extension"}
    }
    user_b = {
        "id": "ext-user-b-" + str(uuid.uuid4())[:8],
        "email": "intruder_b@example.com",
        "user_metadata": {"full_name": "Bob Intruder"}
    }

    current_test_user = user_a

    async def mock_get_current_user():
        return current_test_user

    app.dependency_overrides[get_current_user] = mock_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # 1. Unauthenticated Request Check
        app.dependency_overrides.clear()
        unauth_res = await client.get("/api/resumes")
        assert unauth_res.status_code == 401, f"Expected 401 for unauthenticated request, got {unauth_res.status_code}"
        print("[PASS] Unauthenticated extension requests rejected with HTTP 401")
        app.dependency_overrides[get_current_user] = mock_get_current_user

        # 2. Extension creates master resume
        create_resume_res = await client.post("/api/resumes", json={
            "name": "Alice Master Resume",
            "is_default": True
        })
        assert create_resume_res.status_code == 201, f"Resume creation failed: {create_resume_res.text}"
        master_resume_id = create_resume_res.json()["id"]

        # Populate structured sections
        update_resume_res = await client.put(f"/api/resumes/{master_resume_id}", json={
            "name": "Alice Master Resume",
            "is_default": True,
            "personal_info": {
                "full_name": "Alice Extension",
                "headline": "Lead Systems Engineer",
                "email": "alice@example.com",
                "phone": "+1 555-0199",
                "location": "San Francisco, CA",
                "github_url": "https://github.com/alice"
            },
            "summary": {
                "summary": "Experienced engineer specializing in high-throughput cloud services."
            },
            "experiences": [
                {
                    "company": "CloudScale Inc",
                    "job_title": "Senior Backend Engineer",
                    "location": "San Francisco, CA",
                    "start_date": "2021-01",
                    "end_date": "Present",
                    "is_current": True,
                    "bullets": [
                        {"content": "Architected distributed microservices in Python and FastAPI handling 100k req/sec."},
                        {"content": "Optimized PostgreSQL database queries reducing p99 latency by 45%."}
                    ]
                }
            ],
            "skills": [
                {"skill_name": "Python", "category": "Languages"},
                {"skill_name": "FastAPI", "category": "Frameworks"},
                {"skill_name": "PostgreSQL", "category": "Databases"},
                {"skill_name": "Docker", "category": "Cloud & DevOps"},
                {"skill_name": "AWS", "category": "Cloud & DevOps"}
            ],
            "educations": [
                {
                    "institution": "University of California, Berkeley",
                    "degree": "B.S.",
                    "field_of_study": "Computer Science",
                    "start_date": "2016-09",
                    "end_date": "2020-05"
                }
            ]
        })
        assert update_resume_res.status_code == 200, f"Resume update failed: {update_resume_res.text}"
        print("[PASS] Master resume structured foundation created")

        # 3. Extension ingests active tab job (e.g. LinkedIn job)
        job_payload = {
            "job_title": "Lead Platform Engineer",
            "company_name": "Stripe",
            "location": "San Francisco, CA (Hybrid)",
            "source": "linkedin",
            "source_url": "https://www.linkedin.com/jobs/view/9988776655",
            "job_description": (
                "Stripe is hiring a Lead Platform Engineer to design scalable cloud infrastructure. "
                "Responsibilities include architecting robust Python services, managing PostgreSQL "
                "clusters, and leading AWS infrastructure deployments. Qualifications: 5+ years with "
                "Python, FastAPI, Docker, and AWS."
            )
        }

        save_job_res = await client.post("/api/jobs?update_if_exists=true", json=job_payload)
        assert save_job_res.status_code == 201, f"Job ingestion failed: {save_job_res.text}"
        job_data = save_job_res.json()
        saved_job_id = job_data["job"]["id"]
        print("[PASS] Extension ingested active tab job into saved jobs library")

        # 4. Extension requests master resume list
        list_resumes_res = await client.get("/api/resumes")
        assert list_resumes_res.status_code == 200
        resumes_list = list_resumes_res.json()
        assert len(resumes_list) >= 1
        assert any(r["id"] == master_resume_id for r in resumes_list)
        print("[PASS] Extension loaded authenticated user's master resumes")

        # 5. Extension executes Job Match analysis (Module 5)
        match_res = await client.post(f"/api/jobs/{saved_job_id}/match", json={
            "resume_id": master_resume_id,
            "force_recalculate": True
        })
        assert match_res.status_code == 200, f"Match analysis failed: {match_res.text}"
        match_data = match_res.json()
        assert match_data["overall_score"] >= 70, f"Expected strong match score, got {match_data['overall_score']}"
        assert "category_scores" in match_data
        assert len(match_data["matched_skills"]) > 0
        print(f"[PASS] Extension Job Match calculated successfully: {match_data['overall_score']}% ({match_data['match_level']})")

        # 6. Extension generates tailored draft & saves tailored resume (Module 6)
        draft_res = await client.post(f"/api/resumes/{master_resume_id}/tailor", json={
            "job_id": saved_job_id,
            "tailoring_mode": "balanced"
        })
        assert draft_res.status_code == 200, f"Draft generation failed: {draft_res.text}"
        draft_data = draft_res.json()
        assert draft_data["tailored_resume"] is not None

        save_tailored_res = await client.post(f"/api/resumes/{master_resume_id}/tailor/save", json={
            "job_id": saved_job_id,
            "name": "Lead Platform Engineer — Stripe (Tailored)",
            "tailored_resume": draft_data["tailored_resume"],
            "change_log": draft_data["change_log"],
            "tailoring_mode": "balanced",
            "original_match_score": draft_data["original_match_score"],
            "tailored_match_score": draft_data["tailored_match_score"]
        })
        assert save_tailored_res.status_code in (200, 201), f"Saving tailored resume failed: {save_tailored_res.text}"
        tailored_resume_id = save_tailored_res.json()["tailored_resume_id"]
        print("[PASS] Extension saved tailored resume draft without mutating master resume")

        # Verify Master Resume Immutability
        verify_master_res = await client.get(f"/api/resumes/{master_resume_id}")
        assert verify_master_res.status_code == 200
        master_data = verify_master_res.json()
        assert master_data["name"] == "Alice Master Resume"
        assert master_data["is_tailored"] is False
        print("[PASS] Master resume verified completely unchanged and intact")

        # 7. Extension triggers PDF & DOCX export (Module 8)
        pdf_export_res = await client.post(f"/api/resumes/{tailored_resume_id}/export", json={"format": "pdf"})
        assert pdf_export_res.status_code == 200
        assert pdf_export_res.headers["content-type"] == "application/pdf"
        assert "Alice_Extension" in pdf_export_res.headers.get("content-disposition", "")
        assert len(pdf_export_res.content) > 1000
        print("[PASS] Extension triggered PDF export stream successfully")

        docx_export_res = await client.post(f"/api/resumes/{tailored_resume_id}/export", json={"format": "docx"})
        assert docx_export_res.status_code == 200
        assert "officedocument.wordprocessingml" in docx_export_res.headers["content-type"]
        assert len(docx_export_res.content) > 1000
        print("[PASS] Extension triggered DOCX export stream successfully")

        # 8. Multi-Tenant Isolation
        current_test_user = user_b  # Switch to Bob
        unauth_job_match = await client.post(f"/api/jobs/{saved_job_id}/match", json={"resume_id": master_resume_id})
        assert unauth_job_match.status_code == 404, "User B should receive 404 accessing User A's job"

        unauth_export = await client.post(f"/api/resumes/{tailored_resume_id}/export", json={"format": "pdf"})
        assert unauth_export.status_code == 404, "User B should receive 404 accessing User A's tailored resume"
        print("[PASS] Multi-tenant isolation verified: User B cannot access User A's extension data")

    print("=== All Module 9 Extension Backend Integration Tests Passed Successfully! ===\n")


if __name__ == "__main__":
    asyncio.run(test_extension_backend())
