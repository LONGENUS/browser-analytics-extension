import base64
import json
import time
import uuid
import io
import httpx
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def make_jwt(user_id: str, email: str) -> str:
    header = {"alg": "none", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 86400,
        "iat": int(time.time()),
    }
    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f"{b64(header)}.{b64(payload)}.sig"

def make_sample_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 750, "Jane Doe, Senior Software Engineer")
    c.drawString(100, 735, "Email: jane.doe@example.com | Phone: 555-0192 | San Francisco, CA")
    c.drawString(100, 710, "Summary")
    c.drawString(100, 695, "Experienced full stack software engineer specializing in scalable cloud applications.")
    c.drawString(100, 670, "Experience")
    c.drawString(100, 655, "Staff Engineer at TechCorp Inc (2020 - Present)")
    c.drawString(120, 640, "- Built microservices handling millions of active requests per minute.")
    c.drawString(120, 625, "- Improved database query throughput by 50% using distributed caching.")
    c.drawString(100, 600, "Education")
    c.drawString(100, 585, "B.S. Computer Science, University of California, Berkeley (2016 - 2020)")
    c.drawString(100, 560, "Skills")
    c.drawString(100, 545, "Python, TypeScript, PostgreSQL, React, Docker, Kubernetes, AWS")
    c.save()
    return buf.getvalue()

def make_sample_docx() -> bytes:
    doc = Document()
    doc.add_heading("Taylor Morgan, M.S.", level=0)
    doc.add_paragraph("Seattle, WA | tmorgan@example.com | (555) 234-5678 | linkedin.com/in/tmorgan")
    doc.add_heading("Executive Summary", level=1)
    doc.add_paragraph("Staff Software Engineer with 8+ years architecting fault-tolerant distributed systems.")
    doc.add_heading("Technical Skills", level=1)
    table = doc.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Languages"
    table.rows[0].cells[1].text = "Python, TypeScript, Go, SQL"
    table.rows[1].cells[0].text = "Databases"
    table.rows[1].cells[1].text = "PostgreSQL, Redis"
    doc.add_heading("Professional Experience", level=1)
    doc.add_paragraph("Principal Systems Engineer | CloudScale Networks (2021 – Present)")
    doc.add_paragraph("Architected multi-region event streaming ingestion pipeline.", style='List Bullet')
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def run_diagnostics():
    base_url = "https://browser-analytics-extension-longenus05-3620s-projects.vercel.app"
    user_a_id = str(uuid.uuid4())
    user_a_token = make_jwt(user_a_id, "user_a@example.com")
    headers_a = {"Authorization": f"Bearer {user_a_token}"}

    user_b_id = str(uuid.uuid4())
    user_b_token = make_jwt(user_b_id, "user_b@example.com")
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    pdf_bytes = make_sample_pdf()
    docx_bytes = make_sample_docx()

    print("=" * 60)
    print("PHASE 1 DIAGNOSTIC TEST: LIVE VERCEL BACKEND UPLOAD TRACE")
    print(f"Base URL: {base_url}")
    print(f"User A ID: {user_a_id}")
    print("=" * 60)

    with httpx.Client(timeout=25.0) as client:
        # Step 1: Upload PDF
        print("\n--- STEP 1: Uploading Real PDF Resume ---")
        files_pdf = {"file": ("jane_doe_resume.pdf", pdf_bytes, "application/pdf")}
        r_pdf = client.post(f"{base_url}/api/resumes/import", headers=headers_a, files=files_pdf)
        print(f"Status Code: {r_pdf.status_code}")
        print(f"Response: {r_pdf.text[:400]}")

        pdf_resume_id = None
        if r_pdf.status_code == 200:
            pdf_data = r_pdf.json()
            pdf_resume_id = pdf_data.get("resume_id")
            print(f"Stored storage_path in response: {pdf_data.get('storage_path')}")
            print(f"Stored file_sha256 in response: {pdf_data.get('file_sha256')}")

        # Step 2: Upload DOCX
        print("\n--- STEP 2: Uploading Real DOCX Resume ---")
        files_docx = {"file": ("taylor_morgan_resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        r_docx = client.post(f"{base_url}/api/resumes/import", headers=headers_a, files=files_docx)
        print(f"Status Code: {r_docx.status_code}")
        print(f"Response: {r_docx.text[:400]}")

        docx_resume_id = None
        if r_docx.status_code == 200:
            docx_data = r_docx.json()
            docx_resume_id = docx_data.get("resume_id")
            print(f"Stored storage_path in response: {docx_data.get('storage_path')}")
            print(f"Stored file_sha256 in response: {docx_data.get('file_sha256')}")

        # Step 3: Retrieve PDF Original File Preview
        if pdf_resume_id:
            print(f"\n--- STEP 3: Retrieving Original Master PDF Preview (GET /api/resumes/{pdf_resume_id}/original?inline=true) ---")
            r_get_pdf = client.get(f"{base_url}/api/resumes/{pdf_resume_id}/original?inline=true", headers=headers_a)
            print(f"Status Code: {r_get_pdf.status_code}")
            if r_get_pdf.status_code == 200:
                print(f"Headers: Content-Type={r_get_pdf.headers.get('content-type')}, Content-Length={len(r_get_pdf.content)}")
                print(f"SHA-256 matches original: {r_get_pdf.content == pdf_bytes}")
            else:
                print(f"FAILURE BODY: {r_get_pdf.text}")

        # Step 4: Retrieve DOCX Original File Preview
        if docx_resume_id:
            print(f"\n--- STEP 4: Retrieving Original Master DOCX Preview (GET /api/resumes/{docx_resume_id}/original?inline=true) ---")
            r_get_docx = client.get(f"{base_url}/api/resumes/{docx_resume_id}/original?inline=true", headers=headers_a)
            print(f"Status Code: {r_get_docx.status_code}")
            if r_get_docx.status_code == 200:
                print(f"Headers: Content-Type={r_get_docx.headers.get('content-type')}, Content-Length={len(r_get_docx.content)}")
                print(f"SHA-256 matches original: {r_get_docx.content == docx_bytes}")
            else:
                print(f"FAILURE BODY: {r_get_docx.text}")

        # Step 5: Test Retrieval of Database Records (Simulating Page Refresh)
        print(f"\n--- STEP 5: Listing Resumes (Page Refresh: GET /api/resumes) ---")
        r_list = client.get(f"{base_url}/api/resumes", headers=headers_a)
        print(f"Status Code: {r_list.status_code}")
        print(f"Resumes Found: {len(r_list.json()) if r_list.status_code == 200 else r_list.text}")
        if r_list.status_code == 200:
            for item in r_list.json():
                print(f"  - Resume ID: {item.get('id')}, Name: {item.get('name')}, File: {item.get('original_filename')}, Storage: {item.get('original_file_path')}")

        # Step 6: Test Security Isolation (User B cannot access User A's resume)
        if pdf_resume_id:
            print(f"\n--- STEP 6: Multi-Tenant Security Check (User B attempts to get User A's file) ---")
            r_sec = client.get(f"{base_url}/api/resumes/{pdf_resume_id}/original?inline=true", headers=headers_b)
            print(f"Status Code for User B: {r_sec.status_code}")
            print(f"Response: {r_sec.text}")

if __name__ == "__main__":
    run_diagnostics()
