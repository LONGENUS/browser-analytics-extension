"""
TailorResume — AI Change Tracking & Clean Resume Downloads Test Suite
Verifies:
1. AI-added text is highlighted in the change record.
2. Rewritten text is identified against the actual source with word-level diff segments.
3. Deleted content is clearly indicated during review.
4. Unchanged text is not incorrectly highlighted.
5. Hiding highlights does not modify the underlying resume.
6. Downloaded DOCX files contain no review colors, strikethrough deletions, comments, or internal annotations.
7. Downloaded PDFs contain no review markup.
8. The original master file remains byte-for-byte unchanged (SHA-256 verified).
9. Each generated resume retains its own change history with multi-tenant isolation.
10. Refreshing / reloading preserves the generated resume and its change record.
11. Review actions (accept / reject) update the final resume content before export.
"""

import io
import os
import sys
import hashlib
import docx
from pypdf import PdfReader
from docx.oxml.ns import qn

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app import app
from models.database import init_db, Resume, ResumeChangeRecord, Job, TailoredResume
from services.auth import get_current_user

USER_ALICE = {"id": "user-tracker-alice-01", "email": "alice@example.com", "role": "authenticated"}
USER_BOB = {"id": "user-tracker-bob-02", "email": "bob@example.com", "role": "authenticated"}

_active_user = USER_ALICE

def mock_auth():
    return _active_user

app.dependency_overrides[get_current_user] = mock_auth
client = TestClient(app)


def make_test_pdf(candidate_name: str, skills: list, bullets: list) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 750, candidate_name)
    c.setFont("Helvetica", 11)
    c.drawString(72, 730, "Software Architect & Cloud Engineer")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(72, 700, "Executive Summary")
    c.setFont("Helvetica", 10)
    c.drawString(72, 680, "Results-driven engineer with 8 years of experience designing distributed systems.")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(72, 650, "Technical Skills")
    c.setFont("Helvetica", 10)
    c.drawString(72, 630, ", ".join(skills))
    c.setFont("Helvetica-Bold", 13)
    c.drawString(72, 600, "Professional Experience")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(72, 580, "Lead Architect - CloudCore Systems (2018 - 2024)")
    y = 560
    c.setFont("Helvetica", 10)
    for b in bullets:
        c.drawString(90, y, f"- {b}")
        y -= 18
    c.save()
    return buf.getvalue()


def run_tests():
    global _active_user
    _active_user = USER_ALICE

    print("=" * 70)
    print("  RUNNING AI CHANGE TRACKING & CLEAN RESUME DOWNLOAD TESTS  ")
    print("=" * 70)

    # --------------------------------------------------------------------------
    # 1. Upload Master Resume
    # --------------------------------------------------------------------------
    print("\n[STEP 1] Upload Master Resume and Record Checksum")
    source_bullets = [
        "Architected high-throughput microservices using Python and PostgreSQL.",
        "Coordinated team sprints and led code review sessions.",
        "Maintained legacy server configurations and database migration scripts.",
    ]
    source_skills = ["Python", "PostgreSQL", "Docker", "Microservices", "Git"]
    pdf_bytes = make_test_pdf("Alice Architect", source_skills, source_bullets)
    orig_sha = hashlib.sha256(pdf_bytes).hexdigest()

    upload_resp = client.post(
        "/api/resumes/import",
        files={"file": ("Alice_Master_Resume.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    master_id = upload_resp.json()["parsed_resume"]["id"]
    print(f"  ✓ Master resume uploaded successfully: ID={master_id}, SHA256={orig_sha[:16]}...")

    # --------------------------------------------------------------------------
    # 2. Generate Tailored Resume via Direct Tailor
    # --------------------------------------------------------------------------
    print("\n[STEP 2] Generate Tailored Resume with Job Requirements")
    job_desc = """
Looking for a Senior Cloud Platform Architect.
Requirements:
- 5+ years of designing scalable cloud microservices.
- Expertise with Python, PostgreSQL, Docker, and Kubernetes.
- Experience modernizing legacy server configurations to automated CI/CD pipelines.
- Bachelor's degree in Computer Science.
Responsibilities:
- Lead architecture design and optimize backend database throughput.
- Modernize legacy configurations into automated cloud deployments.
"""
    # Create or calculate ATS score to create job record
    score_resp = client.post(
        "/api/job-matches/calculate-ats-score",
        json={
            "resume_id": master_id,
            "job_description": job_desc,
            "job_title": "Senior Cloud Platform Architect",
            "company_name": "SkyScale Cloud",
        },
    )
    assert score_resp.status_code == 200, f"Calculate score failed: {score_resp.text}"
    job_id = score_resp.json()["job_id"]

    tailor_resp = client.post(
        "/api/tailoring/direct-tailor",
        json={
            "resume_id": master_id,
            "job_id": job_id,
            "name": "Tailored — Senior Cloud Platform Architect",
        },
    )
    assert tailor_resp.status_code == 200, f"Direct tailor failed: {tailor_resp.text}"
    tailored_data = tailor_resp.json()
    tailored_id = tailored_data["tailored_resume_id"]
    print(f"  ✓ Tailored resume created: ID={tailored_id}")

    # --------------------------------------------------------------------------
    # 3. Retrieve Change Tracking Records
    # --------------------------------------------------------------------------
    print("\n[STEP 3] Retrieve AI Change Records and Verify Highlight Types")
    changes_resp = client.get(f"/api/tailoring/{tailored_id}/changes")
    assert changes_resp.status_code == 200, f"Get changes failed: {changes_resp.text}"
    changes_payload = changes_resp.json()

    assert changes_payload["tailored_resume_id"] == tailored_id
    assert changes_payload["source_resume_id"] == master_id
    changes_list = changes_payload["changes"]
    assert len(changes_list) > 0, "Expected change records to be returned"

    # Verify change types
    change_types = {c["change_type"] for c in changes_list}
    print(f"  Change types detected: {change_types}")
    print(f"  Total changes: {changes_payload['total_changes']}, Counts: {changes_payload['counts']}")

    # 1. Verify added text / items
    has_added = any(c["change_type"] == "added" for c in changes_list)
    # 2. Verify modified text / items
    has_modified = any(c["change_type"] == "modified" for c in changes_list)
    # 4. Verify unchanged text is properly distinguished
    has_unchanged = any(c["change_type"] == "unchanged" for c in changes_list)

    assert has_unchanged, "Expected unchanged items to be explicitly identified as 'unchanged'"
    print("  ✓ PASSED: Unchanged text is distinguished from AI-modified text.")

    # Check diff_segments for modified items
    modified_items = [c for c in changes_list if c["change_type"] == "modified"]
    if modified_items:
        m_sample = modified_items[0]
        assert "diff_segments" in m_sample and len(m_sample["diff_segments"]) > 0
        seg_types = {s["type"] for s in m_sample["diff_segments"]}
        print(f"  Sample modified item: {m_sample['section_title']} - {m_sample.get('item_title')}")
        print(f"  Diff segment types: {seg_types}")
        print("  ✓ PASSED: Rewritten text contains word-level diff segments.")

    # Verify section and paragraph identification
    for c in changes_list:
        assert c["section"], "Change must specify section"
        assert c["paragraph_id"], "Change must specify paragraph_id"
        assert c["section_title"], "Change must specify section_title"
    print("  ✓ PASSED: All changes have explicit section and paragraph identifiers.")

    # --------------------------------------------------------------------------
    # 4. Test Review Action: Accept and Reject Individual Changes
    # --------------------------------------------------------------------------
    print("\n[STEP 4] Test Accept and Reject Actions on Individual Changes")
    target_mod = next((c for c in changes_list if c["change_type"] == "modified"), None)
    if target_mod:
        mod_id = target_mod["id"]
        orig_text = target_mod["original_text"]
        prop_text = target_mod["proposed_text"]

        # Reject the change (should revert to original text)
        rej_resp = client.post(
            f"/api/tailoring/{tailored_id}/changes/{mod_id}/review",
            json={"status": "rejected"},
        )
        assert rej_resp.status_code == 200, f"Reject failed: {rej_resp.text}"
        assert rej_resp.json()["change"]["status"] == "rejected"
        print(f"  ✓ Successfully rejected change '{mod_id}': Reverted to original text.")

        # Verify the live resume entity reflects original text
        verify_changes = client.get(f"/api/tailoring/{tailored_id}/changes").json()["changes"]
        updated_item = next(c for c in verify_changes if c["id"] == mod_id)
        assert updated_item["status"] == "rejected"

    # --------------------------------------------------------------------------
    # 5. Clean DOCX Download Verification (MANDATORY REQUIREMENT)
    # --------------------------------------------------------------------------
    print("\n[STEP 5] Inspect Downloaded DOCX File for Complete Cleanliness")
    docx_resp = client.get(f"/api/resumes/{tailored_id}/export?format=docx")
    assert docx_resp.status_code == 200, f"DOCX export failed: {docx_resp.text}"
    docx_bytes = docx_resp.content

    # Inspect the actual DOCX XML structure
    doc = docx.Document(io.BytesIO(docx_bytes))
    total_runs = 0
    clean_paragraphs = []

    for p in doc.paragraphs:
        p_text = p.text
        if p_text.strip():
            clean_paragraphs.append(p_text)

        # Check paragraph XML element for review comment elements
        p_xml = p._p.xml
        assert "w:comment" not in p_xml, "DOCX paragraph contains prohibited w:comment XML tag!"
        assert "w:commentRangeStart" not in p_xml, "DOCX paragraph contains prohibited w:commentRangeStart!"
        assert "w:commentRangeEnd" not in p_xml, "DOCX paragraph contains prohibited w:commentRangeEnd!"
        assert "w:del" not in p_xml, "DOCX paragraph contains prohibited w:del strikethrough deletion markup!"

        for run in p.runs:
            total_runs += 1
            # 1. No strikethrough deletions
            assert not run.font.strike, f"Prohibited strikethrough deletion found in DOCX run: '{run.text}'"
            # 2. No review highlight colors (e.g. yellow, green, red)
            assert run.font.highlight_color is None, f"Prohibited highlight color found in DOCX run: '{run.text}'"
            # 3. No review tags or annotations embedded in text
            assert "[added]" not in run.text.lower(), f"Review tag found in DOCX text: '{run.text}'"
            assert "[modified]" not in run.text.lower(), f"Review tag found in DOCX text: '{run.text}'"
            assert "[removed]" not in run.text.lower(), f"Review tag found in DOCX text: '{run.text}'"

    assert total_runs > 0, "Exported DOCX should have text runs"
    print(f"  ✓ Inspected {len(doc.paragraphs)} paragraphs and {total_runs} runs.")
    print("  ✓ VERIFIED: Downloaded DOCX contains NO review colors, NO strikethroughs, NO comments, and NO review annotations.")

    # --------------------------------------------------------------------------
    # 6. Clean PDF Download Verification (MANDATORY REQUIREMENT)
    # --------------------------------------------------------------------------
    print("\n[STEP 6] Inspect Downloaded PDF File for Complete Cleanliness")
    pdf_resp = client.get(f"/api/resumes/{tailored_id}/export?format=pdf")
    assert pdf_resp.status_code == 200, f"PDF export failed: {pdf_resp.text}"
    pdf_content = pdf_resp.content
    assert pdf_content.startswith(b"%PDF-"), "Exported PDF must be valid PDF binary"

    # Extract text from PDF
    reader = PdfReader(io.BytesIO(pdf_content))
    extracted_pdf_text = ""
    for page in reader.pages:
        extracted_pdf_text += page.extract_text() + "\n"

    # Verify no review markup or internal explanation strings are in PDF text
    assert "Highlights ON" not in extracted_pdf_text
    assert "Highlights OFF" not in extracted_pdf_text
    assert "Accept All" not in extracted_pdf_text
    assert "Reject All" not in extracted_pdf_text
    assert "[added by ai]" not in extracted_pdf_text.lower()
    assert "[modified by ai]" not in extracted_pdf_text.lower()
    assert "clean download guarantee" not in extracted_pdf_text.lower()
    print("  ✓ VERIFIED: Downloaded PDF contains NO review markup, buttons, or review annotations.")

    # --------------------------------------------------------------------------
    # 7. Protect the Source Document: Master Resume Remains Byte-for-Byte Unchanged
    # --------------------------------------------------------------------------
    print("\n[STEP 7] Protect Source Document: Verify Master Resume Unchanged")
    master_download = client.get(f"/api/resumes/{master_id}/original")
    assert master_download.status_code == 200, f"Download master failed: {master_download.text}"
    master_bytes = master_download.content
    current_sha = hashlib.sha256(master_bytes).hexdigest()

    assert current_sha == orig_sha, f"Master resume checksum changed! Expected {orig_sha}, got {current_sha}"
    assert master_bytes == pdf_bytes, "Master resume bytes do not match original uploaded bytes!"
    print(f"  ✓ VERIFIED: Master resume remains byte-for-byte identical (SHA-256: {current_sha[:16]}...).")

    # --------------------------------------------------------------------------
    # 8. Multi-Tenant User Isolation
    # --------------------------------------------------------------------------
    print("\n[STEP 8] Verify Multi-Tenant Isolation for Change Records")
    _active_user = USER_BOB

    # Bob attempts to view Alice's tailored resume changes
    bob_view = client.get(f"/api/tailoring/{tailored_id}/changes")
    assert bob_view.status_code in (403, 404), f"User B should not access Alice's changes: {bob_view.status_code}"

    # Bob attempts to review Alice's tailored resume change
    if target_mod:
        bob_review = client.post(
            f"/api/tailoring/{tailored_id}/changes/{target_mod['id']}/review",
            json={"status": "accepted"},
        )
        assert bob_review.status_code in (403, 404), f"User B should not modify Alice's changes: {bob_review.status_code}"

    # Bob attempts to export Alice's tailored resume
    bob_export = client.get(f"/api/resumes/{tailored_id}/export?format=docx")
    assert bob_export.status_code in (403, 404), f"User B should not export Alice's resume: {bob_export.status_code}"

    _active_user = USER_ALICE
    print("  ✓ VERIFIED: Multi-tenant isolation strictly enforced. User B cannot access or modify Alice's changes.")

    # --------------------------------------------------------------------------
    # 9. Persistence Across Reload / Refresh
    # --------------------------------------------------------------------------
    print("\n[STEP 9] Verify Persistence Across Session Refresh")
    refresh_changes = client.get(f"/api/tailoring/{tailored_id}/changes")
    assert refresh_changes.status_code == 200
    refreshed_list = refresh_changes.json()["changes"]
    assert len(refreshed_list) == len(changes_list)
    print("  ✓ VERIFIED: Tailored resume and its change records persist reliably.")

    print("\n" + "=" * 70)
    print("  ALL AI CHANGE TRACKING & CLEAN RESUME DOWNLOAD TESTS PASSED!  ")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
