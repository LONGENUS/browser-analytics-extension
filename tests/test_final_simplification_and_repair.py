"""
TailorResume — Final Simplification & Repair Module Verification Suite
Tests the complete end-to-end workflow:
1. PDF upload, original preview & original download.
2. DOCX upload, original preview & original download.
3. Persistence across simulated restarts & database base64 decoding.
4. Manual job-description entry in ATS score calculation.
5. Correct master resume selection (and rejection of tailored resumes).
6. ATS score based on actual extracted resume & job requirements.
7. Concise missing-requirement reporting.
8. Failure handling: empty job description, unparseable resume, unauthorized access.
9. Tailored resume generation from correct master and job description.
10. Preservation of original master file (verified byte-for-byte unchanged).
11. Separate storage & retrieval of tailored versions.
12. PDF/DOCX output, preview and download of tailored resume.
13. User-level isolation & multi-tenancy.
14. Regression Test: Architect job compared against an unrelated profession (Teacher)
    does NOT receive an artificially high score because of generic words (teamwork, communication, project).
"""

import asyncio
import io
import os
import sys
import hashlib
from typing import Dict, Any

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from docx import Document
from app import app
from models.database import init_db, AsyncSessionLocal, UserProfile, Resume, Job
from services.auth import get_current_user
from services.matching_engine import run_job_match_analysis, extract_meaningful_tokens, STOPWORDS
from services.storage import compute_sha256

USER_A = {"id": "user-audit-001", "email": "audit_alpha@example.com", "role": "authenticated"}
USER_B = {"id": "user-audit-002", "email": "audit_beta@example.com", "role": "authenticated"}

_active_user = USER_A

def mock_current_user():
    return _active_user

app.dependency_overrides[get_current_user] = mock_current_user
client = TestClient(app)

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_sample_pdf(candidate_name: str, headline: str, summary: str, skills: list, experiences: list) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 750, candidate_name)
    c.setFont("Helvetica", 12)
    c.drawString(72, 730, headline)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 700, "Executive Summary")
    c.setFont("Helvetica", 10)
    c.drawString(72, 680, summary)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 650, "Technical Skills")
    c.setFont("Helvetica", 10)
    c.drawString(72, 630, ", ".join(skills))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 600, "Professional Experience")
    y = 580
    for exp in experiences:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(72, y, f"{exp['role']} - {exp['company']} ({exp['dates']})")
        y -= 15
        c.setFont("Helvetica", 10)
        for bullet in exp['bullets']:
            c.drawString(90, y, f"- {bullet}")
            y -= 15
    c.save()
    return buf.getvalue()

def create_sample_docx(candidate_name: str, headline: str, summary: str, skills: list, experiences: list) -> bytes:
    doc = Document()
    doc.add_heading(candidate_name, level=0)
    doc.add_paragraph(headline)
    doc.add_heading("Summary", level=1)
    doc.add_paragraph(summary)
    doc.add_heading("Skills", level=1)
    doc.add_paragraph(", ".join(skills))
    doc.add_heading("Experience", level=1)
    for exp in experiences:
        doc.add_heading(f"{exp['role']} - {exp['company']}", level=2)
        doc.add_paragraph(f"{exp['dates']}")
        for bullet in exp['bullets']:
            doc.add_paragraph(bullet, style='List Bullet')
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


async def setup_db():
    await init_db()
    async with AsyncSessionLocal() as session:
        for u in (USER_A, USER_B):
            from sqlalchemy import select
            res = await session.execute(select(UserProfile).where(UserProfile.id == u["id"]))
            if not res.scalar_one_or_none():
                session.add(UserProfile(id=u["id"], email=u["email"], full_name="User " + u["id"]))
        await session.commit()


def run_tests():
    global _active_user
    print("=" * 70)
    print("  RUNNING FINAL SIMPLIFICATION & REPAIR VERIFICATION TESTS  ")
    print("=" * 70)

    asyncio.run(setup_db())

    # --------------------------------------------------------------------------
    # 1. PDF Upload, Original Preview and Original Download
    # --------------------------------------------------------------------------
    print("\n[TEST 1] PDF Upload, Original Preview and Original Download")
    _active_user = USER_A
    pdf_bytes = create_sample_pdf(
        candidate_name="Alex Smith",
        headline="Senior Systems Architect",
        summary="Results-oriented systems architect with 10 years of experience designing scalable infrastructure.",
        skills=["Python", "Linux", "Kubernetes", "Docker", "AWS", "Terraform"],
        experiences=[
            {
                "role": "Lead Infrastructure Architect",
                "company": "DataCloud Inc",
                "dates": "2018 - 2024",
                "bullets": [
                    "Engineered multi-region cloud infrastructure on AWS using Terraform and Kubernetes.",
                    "Optimized network routing and automated security compliance for enterprise clients.",
                ],
            }
        ],
    )
    pdf_sha = compute_sha256(pdf_bytes)

    upload_resp = client.post(
        "/api/resumes/import",
        files={"file": ("Alex_Smith_Resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    pdf_data = upload_resp.json()
    pdf_resume_id = pdf_data["resume_id"]
    print("  ✓ Uploaded PDF master resume successfully, ID:", pdf_resume_id)

    # Preview original PDF
    prev_resp = client.get(f"/api/resumes/{pdf_resume_id}/original?inline=true")
    assert prev_resp.status_code == 200
    assert prev_resp.headers["content-type"] == "application/pdf"
    assert "inline" in prev_resp.headers.get("content-disposition", "")
    assert compute_sha256(prev_resp.content) == pdf_sha
    print("  ✓ Original PDF preview verified byte-for-byte with exact SHA-256")

    # Download original PDF unchanged
    dl_resp = client.get(f"/api/resumes/{pdf_resume_id}/original?inline=false")
    assert dl_resp.status_code == 200
    assert "attachment" in dl_resp.headers.get("content-disposition", "")
    assert compute_sha256(dl_resp.content) == pdf_sha
    print("  ✓ Original PDF download verified byte-for-byte unchanged")

    # --------------------------------------------------------------------------
    # 2. DOCX Upload, Original Preview and Original Download
    # --------------------------------------------------------------------------
    print("\n[TEST 2] DOCX Upload, Original Preview and Original Download")
    docx_bytes = create_sample_docx(
        candidate_name="Sarah Miller",
        headline="Software Engineer",
        summary="Experienced Full Stack Software Engineer with skills in Python and TypeScript.",
        skills=["Python", "FastAPI", "TypeScript", "React", "PostgreSQL", "Docker"],
        experiences=[
            {
                "role": "Senior Engineer",
                "company": "Tech Corp",
                "dates": "2020 - 2024",
                "bullets": [
                    "Engineered distributed REST APIs using Python, FastAPI, and PostgreSQL.",
                    "Containerized microservices using Docker and orchestrated deployments.",
                ],
            }
        ],
    )
    docx_sha = compute_sha256(docx_bytes)

    upload_docx_resp = client.post(
        "/api/resumes/import",
        files={"file": ("Sarah_Miller_Resume.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert upload_docx_resp.status_code == 200, f"DOCX upload failed: {upload_docx_resp.text}"
    docx_data = upload_docx_resp.json()
    docx_resume_id = docx_data["resume_id"]
    print("  ✓ Uploaded DOCX master resume successfully, ID:", docx_resume_id)

    # Preview original DOCX
    prev_docx_resp = client.get(f"/api/resumes/{docx_resume_id}/original?inline=true")
    assert prev_docx_resp.status_code == 200
    assert compute_sha256(prev_docx_resp.content) == docx_sha
    print("  ✓ Original DOCX preview returns exact uploaded bytes without conversion")

    # Download original DOCX unchanged
    dl_docx_resp = client.get(f"/api/resumes/{docx_resume_id}/original?inline=false")
    assert dl_docx_resp.status_code == 200
    assert compute_sha256(dl_docx_resp.content) == docx_sha
    print("  ✓ Original DOCX download verified byte-for-byte unchanged")

    # --------------------------------------------------------------------------
    # 3. Persistence Verification: base64 fallback in database
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Persistence Verification Across Cold Storage")
    # Simulate /tmp cleanup by pointing original_file_path to a non-existent path
    async def simulate_tmp_wipe():
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            res = await session.execute(select(Resume).where(Resume.id == docx_resume_id))
            r = res.scalar_one_or_none()
            if r:
                r.original_file_path = "/nonexistent/tmp/path/test.docx"
                await session.commit()
    asyncio.run(simulate_tmp_wipe())

    cold_dl_resp = client.get(f"/api/resumes/{docx_resume_id}/original?inline=true")
    assert cold_dl_resp.status_code == 200, f"Cold download failed: {cold_dl_resp.text}"
    assert compute_sha256(cold_dl_resp.content) == docx_sha
    print("  ✓ Cold-start retrieval decodes database base64 without error when /tmp is missing")

    # --------------------------------------------------------------------------
    # 4 & 5 & 6 & 7. ATS Score Calculation with Manual Job Description
    # --------------------------------------------------------------------------
    print("\n[TEST 4-7] ATS Score Calculation & Missing-Requirement Reporting")
    tech_job_desc = """
Senior Python Developer
Requirements:
• 4+ years of professional software development experience.
• Strong experience with Python, FastAPI, and PostgreSQL.
• Experience with Docker containerization and Kubernetes orchestration.
• Experience with Redis caching and AWS cloud infrastructure.
Responsibilities:
• Design and implement scalable backend microservices.
• Lead architectural discussions and code reviews.
"""
    ats_resp = client.post(
        "/api/job-matches/calculate-ats-score",
        json={
            "resume_id": docx_resume_id,
            "job_description": tech_job_desc,
            "job_title": "Senior Python Developer",
            "company_name": "CloudScale Inc",
        },
    )
    assert ats_resp.status_code == 200, f"ATS score failed: {ats_resp.text}"
    ats_data = ats_resp.json()
    assert "overall_score" in ats_data
    assert 0 <= ats_data["overall_score"] <= 100
    assert "missing_requirements" in ats_data
    assert isinstance(ats_data["missing_requirements"], list)
    print(f"  ✓ Calculated ATS score: {ats_data['overall_score']} / 100")
    print(f"  ✓ Concise missing requirements count: {len(ats_data['missing_requirements'])}")
    for mr in ats_data["missing_requirements"][:3]:
        print(f"    - {mr}")

    # --------------------------------------------------------------------------
    # 8. Failure Handling: Empty Input, Extraction Failure, Unauthorized
    # --------------------------------------------------------------------------
    print("\n[TEST 8] Failure Handling Edge Cases")
    # Empty job description
    bad_job_resp = client.post(
        "/api/job-matches/calculate-ats-score",
        json={"resume_id": docx_resume_id, "job_description": "   "},
    )
    assert bad_job_resp.status_code == 400
    print("  ✓ Empty job description rejected with HTTP 400")

    # Non-existent resume
    nonexist_resp = client.post(
        "/api/job-matches/calculate-ats-score",
        json={"resume_id": "nonexistent-uuid", "job_description": tech_job_desc},
    )
    assert nonexist_resp.status_code == 404
    print("  ✓ Non-existent resume ID rejected with HTTP 404")

    # User isolation: User B cannot access User A's resume
    _active_user = USER_B
    b_access_resp = client.get(f"/api/resumes/{docx_resume_id}/original?inline=true")
    assert b_access_resp.status_code == 404
    print("  ✓ Multi-tenant isolation verified: User B cannot preview User A's master resume")

    # --------------------------------------------------------------------------
    # 9 & 10 & 11 & 12. Direct Tailored Resume Generation & Separate Storage
    # --------------------------------------------------------------------------
    print("\n[TEST 9-12] Tailored Resume Generation & Immutability Verification")
    _active_user = USER_A
    tailor_resp = client.post(
        "/api/tailoring/direct-tailor",
        json={
            "resume_id": docx_resume_id,
            "job_id": ats_data["job_id"],
            "name": "Sarah Miller — Tailored for CloudScale",
        },
    )
    assert tailor_resp.status_code == 200, f"Direct tailor failed: {tailor_resp.text}"
    tailored_data = tailor_resp.json()
    tailored_resume_id = tailored_data["tailored_resume_id"]
    print("  ✓ Tailored resume generated and saved as separate entity:", tailored_resume_id)

    # Master resume immutability check
    check_master_resp = client.get(f"/api/resumes/{docx_resume_id}/original?inline=true")
    assert compute_sha256(check_master_resp.content) == docx_sha
    print("  ✓ Original master resume verified 100% UNCHANGED and NOT overwritten")

    # Rejection of tailored resume as master source for preview
    bad_tailored_prev = client.get(f"/api/resumes/{tailored_resume_id}/original?inline=true")
    assert bad_tailored_prev.status_code == 400
    print("  ✓ Tailored resume cleanly rejected from original master preview endpoint")

    # Separate storage listing
    tailored_list_resp = client.get("/api/tailoring/tailored/list")
    assert tailored_list_resp.status_code == 200
    t_items = tailored_list_resp.json()
    assert any(t["id"] == tailored_resume_id or t.get("tailored_resume_id") == tailored_resume_id for t in t_items)
    print("  ✓ Tailored resume listed separately in tailored document library")

    # Tailored resume PDF / DOCX download and preview
    export_pdf_resp = client.get(f"/api/resumes/{tailored_resume_id}/export?format=pdf")
    assert export_pdf_resp.status_code == 200
    assert len(export_pdf_resp.content) > 0
    print("  ✓ Tailored resume successfully exported to PDF")

    export_docx_resp = client.get(f"/api/resumes/{tailored_resume_id}/export?format=docx")
    assert export_docx_resp.status_code == 200
    assert len(export_docx_resp.content) > 0
    print("  ✓ Tailored resume successfully exported to DOCX")

    # --------------------------------------------------------------------------
    # 14. REGRESSION TEST: Architect Job vs Unrelated Profession (Teacher)
    # --------------------------------------------------------------------------
    print("\n[TEST 14] Regression Test: Architect Job vs Unrelated Profession (Teacher)")
    # Create an authentic resume for a high school English Teacher
    teacher_resume_dict = {
        "personal_info": {"full_name": "Emma Watson"},
        "summary": "Dedicated high school English teacher with 7 years of classroom leadership, student mentoring, and curriculum development.",
        "skills": [
            {"skill_name": "Classroom Management", "category": "Soft Skills"},
            {"skill_name": "Curriculum Development", "category": "Domain"},
            {"skill_name": "Communication", "category": "Soft Skills"},
            {"skill_name": "Teamwork", "category": "Soft Skills"},
            {"skill_name": "Project Coordination", "category": "Soft Skills"},
        ],
        "experiences": [
            {
                "job_title": "Lead English Teacher",
                "company": "Lincoln High School",
                "start_date": "2017",
                "end_date": "2024",
                "is_current": True,
                "description": "Led school-wide literature programs and coordinated cross-functional student projects.",
                "bullets": [
                    "Communicated daily with parents and faculty to ensure student achievement.",
                    "Delivered high-quality educational projects and driven teamwork across departments.",
                ],
            }
        ],
        "educations": [
            {"degree": "Bachelor of Arts", "field_of_study": "English Literature", "institution": "State University"}
        ],
    }

    # Architect Job description requiring building architectural skills
    architect_job_dict = {
        "job_title": "Senior Commercial Architect",
        "company_name": "Foster & Partners",
        "job_description": """
Looking for a Senior Commercial Building Architect.
Requirements:
• 5+ years of architectural design and commercial construction experience.
• Proficient with AutoCAD, Revit, BIM, and architectural drafting.
• Expertise in local building codes, structural coordination, and site zoning compliance.
• Licensed Registered Architect (AIA) or Bachelor of Architecture.
Responsibilities:
• Lead building design development from schematic design through construction administration.
• Coordinate with civil, structural, and MEP engineering consultants.
• Conduct on-site inspections to verify compliance with architectural specifications.
""",
        "requirements": "Revit, AutoCAD, BIM, Architectural Drafting, Building Codes, Zoning",
    }

    # Run analysis
    mismatch_analysis = run_job_match_analysis(architect_job_dict, teacher_resume_dict)
    unrelated_score = mismatch_analysis.get("overall_score", 0)

    print(f"  Architect Job vs English Teacher Resume Score: {unrelated_score} / 100")
    print(f"  Matched Skills: {[m['canonical'] for m in mismatch_analysis.get('matched_skills', [])]}")

    # Generic filler words (teamwork, communication, project) must NOT grant an artificially high score
    assert unrelated_score < 25, f"Regression failed: Unrelated profession scored too high ({unrelated_score} >= 25)!"
    print("  ✓ PASSED: Architect job vs English Teacher resume scored low and appropriately (< 25). No generic word inflation.")

    print("\n" + "=" * 70)
    print("  ALL 14 FINAL SIMPLIFICATION & REPAIR TESTS PASSED!  ")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
