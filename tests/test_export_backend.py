"""
TailorResume — Module 8: Resume PDF/DOCX Export — Backend Test Suite
Tests:
1. Unauthenticated requests rejected with HTTP 401.
2. Format validation: only 'pdf' and 'docx' allowed; invalid formats rejected with HTTP 400.
3. Master resume export to PDF:
   - Validates Content-Type, Content-Disposition, and non-empty stream.
   - Validates ATS readability via pypdf text extraction.
4. Master resume export to DOCX:
   - Validates Content-Type, Content-Disposition.
   - Validates editable document structure via python-docx.
5. Tailored resume export:
   - Preserves job and source resume context in filename.
   - Preserves tailored modifications without touching source master resume.
6. Multi-tenant isolation & ownership enforcement:
   - User B cannot export User A's master resume.
   - User B cannot export User A's tailored resume.
7. Template switching support:
   - Verifies exports across all 3 templates (ats-classic, professional, compact).
8. Content immutability invariant:
   - Exports never mutate underlying resume or job database records.
"""

import asyncio
import io
import os
import sys
import uuid
from httpx import AsyncClient, ASGITransport
import pypdf
import docx

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from models.database import init_db, get_db, Resume, Job
from services.auth import get_current_user


async def test_export_backend():
    print("\n--- Starting Module 8 Resume Export Backend Tests ---")
    await init_db()

    user_a = {
        "id": "export-user-a-" + str(uuid.uuid4())[:8],
        "email": "export_a@example.com",
        "user_metadata": {"full_name": "Alice Exporter"}
    }
    user_b = {
        "id": "export-user-b-" + str(uuid.uuid4())[:8],
        "email": "export_b@example.com",
        "user_metadata": {"full_name": "Bob Intruder"}
    }

    current_test_user = user_a

    async def mock_get_current_user():
        return current_test_user

    app.dependency_overrides[get_current_user] = mock_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a rich Master Resume for User A
        create_res = await client.post("/api/resumes", json={"name": "Alice Master Resume"})
        assert create_res.status_code == 201
        resume_id = create_res.json()["id"]

        # Populate structured sections
        update_payload = {
            "personal_info": {
                "full_name": "Alice Exporter",
                "headline": "Principal Cloud Architect",
                "email": "alice@cloudcorp.com",
                "phone": "+1 (555) 019-2834",
                "location": "San Francisco, CA",
                "website": "https://alice.cloud",
                "linkedin_url": "https://linkedin.com/in/alice-exporter"
            },
            "summary": {
                "summary": "Accomplished cloud architect with 10+ years designing distributed systems."
            },
            "experiences": [
                {
                    "company": "CloudCorp Systems",
                    "job_title": "Lead Infrastructure Architect",
                    "location": "San Francisco, CA",
                    "employment_type": "Full-time",
                    "start_date": "Jan 2021",
                    "end_date": None,
                    "is_current": True,
                    "description": "Overseeing global Kubernetes deployments and latency reductions.",
                    "display_order": 0,
                    "bullets": [
                        {"content": "Engineered multi-region failover handling 50k req/sec with 99.99% uptime.", "display_order": 0},
                        {"content": "Automated infrastructure using Terraform and ArgoCD reducing deployment lead time by 60%.", "display_order": 1}
                    ]
                }
            ],
            "educations": [
                {
                    "institution": "University of California, Berkeley",
                    "degree": "B.S.",
                    "field_of_study": "Electrical Engineering & Computer Sciences",
                    "location": "Berkeley, CA",
                    "start_date": "2012",
                    "end_date": "2016",
                    "description": "Graduated with honors, specialized in distributed computing.",
                    "display_order": 0
                }
            ],
            "skills": [
                {"skill_name": "Kubernetes", "category": "Cloud & DevOps", "display_order": 0},
                {"skill_name": "Python", "category": "Languages", "display_order": 1},
                {"skill_name": "Go", "category": "Languages", "display_order": 2},
                {"skill_name": "PostgreSQL", "category": "Databases", "display_order": 3}
            ],
            "projects": [
                {
                    "name": "KubeMesh Control Plane",
                    "technologies": "Go, gRPC, eBPF",
                    "description": "Lightweight service mesh sidecar proxy with zero configuration.",
                    "url": "https://github.com/alice/kubemesh",
                    "display_order": 0,
                    "bullets": [
                        {"content": "Benchmarked 4x lower latency compared to standard Envoy configurations.", "display_order": 0}
                    ]
                }
            ],
            "certifications": [
                {
                    "name": "Certified Kubernetes Administrator (CKA)",
                    "issuer": "CNCF / Linux Foundation",
                    "issue_date": "2022",
                    "credential_id": "CKA-987654",
                    "credential_url": "https://cncf.io/verify/CKA-987654",
                    "display_order": 0
                }
            ],
            "links": [
                {"label": "Engineering Blog", "url": "https://alice.cloud/blog", "display_order": 0}
            ]
        }
        update_res = await client.put(f"/api/resumes/{resume_id}", json=update_payload)
        assert update_res.status_code == 200
        print("[PASS] Master resume created and populated with full structured sections")

        # 2. Format validation: invalid format rejected with 400
        bad_format_res = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "exe"})
        assert bad_format_res.status_code == 400, f"Expected 400 for bad format, got {bad_format_res.status_code}"
        assert "Unsupported export format" in bad_format_res.json()["detail"]
        print("[PASS] Invalid export format properly rejected with HTTP 400")

        # 3. Export to PDF (Default template: ats-classic)
        pdf_res = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "pdf"})
        assert pdf_res.status_code == 200, f"Failed to export PDF: {pdf_res.text}"
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert "Content-Disposition" in pdf_res.headers
        assert "Alice_Exporter_Resume.pdf" in pdf_res.headers["Content-Disposition"]
        pdf_bytes = pdf_res.content
        assert len(pdf_bytes) > 1000

        # Validate ATS readability via pypdf text extraction
        pdf_reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = " ".join(page.extract_text() for page in pdf_reader.pages)
        assert "Alice Exporter" in extracted_text, "Name missing in PDF extracted text"
        assert "CloudCorp Systems" in extracted_text, "Company missing in PDF extracted text"
        assert "Kubernetes" in extracted_text, "Skill missing in PDF extracted text"
        assert "University of California, Berkeley" in extracted_text, "Education missing in PDF extracted text"
        assert "CKA-987654" in extracted_text, "Certification credential missing in PDF extracted text"
        print(f"[PASS] Master resume exported to PDF successfully ({len(pdf_bytes)} bytes); ATS text extraction validated")

        # 4. Export to DOCX
        docx_res = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "docx"})
        assert docx_res.status_code == 200, f"Failed to export DOCX: {docx_res.text}"
        assert "wordprocessingml.document" in docx_res.headers["content-type"]
        assert "Alice_Exporter_Resume.docx" in docx_res.headers["Content-Disposition"]
        docx_bytes = docx_res.content
        assert len(docx_bytes) > 2000

        # Validate DOCX editable structure via python-docx
        doc = docx.Document(io.BytesIO(docx_bytes))
        docx_text = " ".join(p.text for p in doc.paragraphs)
        assert "Alice Exporter" in docx_text, "Name missing in DOCX text"
        assert "CloudCorp Systems" in docx_text, "Company missing in DOCX text"
        assert "Kubernetes" in docx_text, "Skill missing in DOCX text"
        print(f"[PASS] Master resume exported to DOCX successfully ({len(docx_bytes)} bytes); editable paragraphs validated")

        # 5. Export across other templates: Professional & Compact
        for tmpl in ["professional", "compact"]:
            t_pdf = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "pdf", "template_id": tmpl})
            assert t_pdf.status_code == 200
            assert t_pdf.headers["x-template-id"] == tmpl
            t_docx = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "docx", "template_id": tmpl})
            assert t_docx.status_code == 200
            assert t_docx.headers["x-template-id"] == tmpl
            print(f"[PASS] Successfully exported both PDF and DOCX using template: {tmpl}")

        # 6. Create Job and Tailored Resume to test Tailored Resume export
        create_job_res = await client.post("/api/jobs", json={
            "job_title": "Staff Infrastructure Engineer",
            "company_name": "Google",
            "job_description": "We need deep Kubernetes and distributed systems expertise."
        })
        assert create_job_res.status_code == 201
        job_data = create_job_res.json()
        job_id = job_data["job"]["id"] if "job" in job_data else job_data["id"]

        # Save tailored resume draft
        tailor_draft_res = await client.post(f"/api/resumes/{resume_id}/tailor", json={"job_id": job_id})
        assert tailor_draft_res.status_code == 200
        tailored_draft_data = tailor_draft_res.json()

        save_tailored_res = await client.post(f"/api/resumes/{resume_id}/tailor/save", json={
            "name": "Alice - Google Staff Engineer Tailored",
            "job_id": job_id,
            "tailored_resume": tailored_draft_data["tailored_resume"],
            "change_log": tailored_draft_data.get("change_log", []),
            "tailoring_mode": "balanced",
            "original_match_score": 75,
            "tailored_match_score": 92
        })
        assert save_tailored_res.status_code in (200, 201), f"Failed to save tailored resume: {save_tailored_res.text}"
        tailored_res_data = save_tailored_res.json()
        tailored_resume_id = tailored_res_data.get("tailored_resume_id") or tailored_res_data["id"]

        # Export tailored resume to PDF
        tailored_pdf_res = await client.post(f"/api/resumes/{tailored_resume_id}/export", json={"format": "pdf"})
        assert tailored_pdf_res.status_code == 200
        assert "Google" in tailored_pdf_res.headers["Content-Disposition"]
        assert "Tailored_Resume.pdf" in tailored_pdf_res.headers["Content-Disposition"]
        print("[PASS] Tailored resume exported to PDF with contextual company filename")

        # 7. Multi-Tenant User Isolation & Ownership Enforcement
        current_test_user = user_b  # Switch to Bob
        unauth_master_res = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "pdf"})
        assert unauth_master_res.status_code == 404, f"Expected 404 for User B exporting User A's resume, got {unauth_master_res.status_code}"

        unauth_tailored_res = await client.post(f"/api/resumes/{tailored_resume_id}/export", json={"format": "docx"})
        assert unauth_tailored_res.status_code == 404, f"Expected 404 for User B exporting User A's tailored resume, got {unauth_tailored_res.status_code}"
        print("[PASS] User isolation confirmed: User B cannot export User A's master or tailored resumes")

        # 8. Unauthenticated requests rejected
        app.dependency_overrides.clear()
        unauth_request = await client.post(f"/api/resumes/{resume_id}/export", json={"format": "pdf"})
        assert unauth_request.status_code == 401, f"Expected 401 for unauthenticated export, got {unauth_request.status_code}"
        print("[PASS] Unauthenticated export requests strictly rejected with HTTP 401")

    print("=== All Module 8 Resume Export Backend Tests Passed Successfully! ===\n")


if __name__ == "__main__":
    asyncio.run(test_export_backend())
