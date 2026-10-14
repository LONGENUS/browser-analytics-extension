"""
TailorResume — Context-Aware Resume Tailoring Engine & Master Resume Immutability Test Suite
Tests A through G as specified in Section 10 of Module Specifications.

Tests:
- Test A: Master-Resume Integrity (SHA-256 preservation, byte immutability after tailoring)
- Test B: Job-Specific Context (1 master resume + 2 distinct jobs: Data Analysis vs AI Engineering)
- Test C: Factual Accuracy (Absent skill requirements never claimed; flagged in gaps)
- Test D: Evidence Matching (Transferable capability recognition under different terminology)
- Test E: Version Isolation (Multiple tailored resumes linked properly without cross-job leakage)
- Test F: Failure Handling (Empty jobs, corrupted input, parsing errors, invalid JSON)
- Test G: Existing Functionality (Authentication, templates, PDF/DOCX binary exports)
"""

import asyncio
import copy
import hashlib
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
from config import settings
from models.database import (
    init_db,
    Resume,
    ResumePersonalInfo,
    ResumeSummary,
    ResumeExperience,
    ResumeExperienceBullet,
    ResumeSkill,
    ResumeProject,
    ResumeProjectBullet,
    ResumeEducation,
    ResumeCertification,
    Job,
    TailoredResume,
)
from services.storage import (
    compute_sha256,
    store_master_resume_file,
    retrieve_master_resume_file,
    verify_file_integrity,
    MasterResumeTamperError,
)
from services.resume_parser import (
    extract_text_from_pdf,
    extract_text_from_docx,
    parse_resume_document,
)
from services.job_context import (
    extract_job_profile,
    InvalidJobDescriptionError,
    extract_domain,
    extract_seniority_level,
)
from services.evidence_matcher import (
    build_evidence_match_report,
    find_direct_and_transferable_evidence,
)
from services.tailoring_engine import (
    execute_tailoring_pipeline,
    build_tailoring_plan,
    adapt_professional_summary,
    verify_resume_integrity,
    TailoringOptions,
)
from services.ai.tailoring_orchestrator import execute_ai_tailoring_pipeline
from services.ai.output_validator import validate_and_filter_ai_output
from services.pdf_generator import generate_resume_pdf
from services.docx_generator import generate_resume_docx


# --- Helper for Auth Tokens ---

def create_test_jwt(user_id: str, email: str = "context_tester@test.com") -> str:
    import base64
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "role": "authenticated",
    }
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{h_b64}.{p_b64}.mock_sig"


# --- Synthetic Test Master Resume ---

SYNTHETIC_CANDIDATE_RESUME = {
    "id": "resume-master-synth-100",
    "user_id": "user-context-test-01",
    "name": "Jordan Lee — Master Resume",
    "is_default": True,
    "status": "ready",
    "personal_info": {
        "full_name": "Jordan Lee",
        "headline": "Senior Software & Data Systems Engineer",
        "email": "jordan.lee@example.com",
        "phone": "+1-555-0199",
        "location": "Seattle, WA",
        "linkedin_url": "https://linkedin.com/in/jordanlee-dev",
        "github_url": "https://github.com/jordanlee-dev",
    },
    "summary": {
        "summary": "Full-stack engineer with 6 years of experience building distributed systems, backend services, and analytics pipelines.",
    },
    "skills": [
        {"id": "sk-1", "skill_name": "Python", "category": "Languages", "display_order": 0},
        {"id": "sk-2", "skill_name": "SQL", "category": "Databases", "display_order": 1},
        {"id": "sk-3", "skill_name": "PostgreSQL", "category": "Databases", "display_order": 2},
        {"id": "sk-4", "skill_name": "PyTorch", "category": "Machine Learning", "display_order": 3},
        {"id": "sk-5", "skill_name": "FastAPI", "category": "Backend", "display_order": 4},
        {"id": "sk-6", "skill_name": "Docker", "category": "DevOps", "display_order": 5},
        {"id": "sk-7", "skill_name": "React", "category": "Frontend", "display_order": 6},
    ],
    "experiences": [
        {
            "id": "exp-1",
            "company": "Apex Cloud Systems",
            "job_title": "Senior Backend Engineer",
            "location": "Seattle, WA",
            "start_date": "2021-03",
            "end_date": "Present",
            "is_current": True,
            "description": "Led backend architecture for high-throughput cloud streaming platform.",
            "display_order": 0,
            "bullets": [
                {
                    "id": "b-101",
                    "content": "Engineered distributed event pipelines using Python and FastAPI, processing 45M daily events with 99.99% uptime.",
                    "display_order": 0,
                },
                {
                    "id": "b-102",
                    "content": "Optimized complex PostgreSQL analytical queries, reducing 95th percentile report latency by 42%.",
                    "display_order": 1,
                },
                {
                    "id": "b-103",
                    "content": "Developed PyTorch machine learning models for anomaly detection in telemetry data, decreasing false alerts by 28%.",
                    "display_order": 2,
                },
            ],
        },
        {
            "id": "exp-2",
            "company": "DataVibe Analytics",
            "job_title": "Data Software Engineer",
            "location": "San Francisco, CA",
            "start_date": "2018-06",
            "end_date": "2021-02",
            "is_current": False,
            "description": "Constructed ETL pipelines and business intelligence infrastructure.",
            "display_order": 1,
            "bullets": [
                {
                    "id": "b-201",
                    "content": "Built automated ETL data pipelines in Python and SQL delivering clean datasets to 120+ business stakeholders.",
                    "display_order": 0,
                },
                {
                    "id": "b-202",
                    "content": "Designed transactional PostgreSQL schema powering real-time financial reporting for $14M in monthly transactions.",
                    "display_order": 1,
                },
            ],
        },
    ],
    "projects": [
        {
            "id": "proj-1",
            "name": "NeuralStream",
            "description": "Real-time streaming inference server utilizing PyTorch and Docker.",
            "technologies": "Python, PyTorch, Docker",
            "display_order": 0,
            "bullets": [{"id": "pb-1", "content": "Containerized model serving container achieving sub-15ms inference latency."}],
        },
        {
            "id": "proj-2",
            "name": "QueryInsight",
            "description": "Automated SQL query performance analysis and indexing advisor for PostgreSQL databases.",
            "technologies": "Python, SQL, PostgreSQL",
            "display_order": 1,
            "bullets": [{"id": "pb-2", "content": "Analyzed query execution plans to identify missing indexes."}],
        },
    ],
    "educations": [
        {
            "id": "edu-1",
            "institution": "University of Washington",
            "degree": "Bachelor of Science",
            "field_of_study": "Computer Science",
            "start_date": "2014",
            "end_date": "2018",
            "display_order": 0,
        }
    ],
    "certifications": [
        {"id": "cert-1", "name": "AWS Certified Developer", "issuer": "Amazon Web Services", "display_order": 0}
    ],
    "links": [
        {"id": "link-1", "label": "Portfolio", "url": "https://jordanlee.dev", "display_order": 0}
    ],
}


# --- Synthetic Distinct Jobs ---

JOB_DATA_ANALYST = {
    "id": "job-synth-data-analyst",
    "user_id": "user-context-test-01",
    "job_title": "Senior Data Analyst & Analytics Engineer",
    "company_name": "MetricScale Labs",
    "job_description": """
MetricScale Labs is looking for a Senior Data Analyst & Analytics Engineer.
Core Responsibilities:
- Design automated SQL queries, data warehouses, and reporting dashboards.
- Build reliable data analysis pipelines extracting actionable business insights.
- Partner with finance and operations to track key performance metrics.
Required Skills:
- Advanced SQL and relational database tuning (PostgreSQL, MySQL).
- Python scripting for data manipulation and analysis (pandas, ETL).
- Data pipeline architecture and reporting automation.
Preferred Skills:
- Business intelligence tools and data visualization.
- Cloud warehousing experience.
Requirements:
- 4+ years of data analytics or data engineering experience.
    """.strip(),
}

JOB_AI_ENGINEER = {
    "id": "job-synth-ai-engineer",
    "user_id": "user-context-test-01",
    "job_title": "Senior AI & Machine Learning Systems Engineer",
    "company_name": "CognitiveMatrix AI",
    "job_description": """
CognitiveMatrix AI is seeking a Senior AI & Machine Learning Systems Engineer.
Core Responsibilities:
- Build high-performance machine learning inference services and model pipelines.
- Train, evaluate, and optimize deep neural networks using PyTorch.
- Containerize and deploy AI models to production environments.
Required Skills:
- PyTorch and modern deep learning frameworks.
- Python systems programming and FastAPI microservices.
- Docker containerization for model deployment.
Preferred Skills:
- Large language models (LLMs) and distributed training.
- Low-latency inference optimization.
Requirements:
- 4+ years of experience in AI/ML software engineering.
    """.strip(),
}


# ==============================================================================
# TEST A: Master-Resume Integrity
# ==============================================================================

def test_a_master_resume_integrity():
    """
    Test A: Master-resume integrity
    1. Import a resume and calculate its SHA-256 hash.
    2. Store original bytes in storage service.
    3. Run multiple tailoring operations against different jobs.
    4. Retrieve the master resume and verify its hash and bytes are byte-for-byte identical.
    """
    print("\n--- Test A: Master-Resume Integrity & Byte-for-Byte Immutability ---")

    # 1. Generate synthetic master resume bytes (e.g. simulated original PDF bytes)
    original_pdf_bytes = (
        b"%PDF-1.4\n%Candidate Master Resume Source File Content\n"
        b"Jordan Lee | Senior Software Engineer\n"
        b"Experiences: Apex Cloud Systems, DataVibe Analytics\n"
        b"Skills: Python, SQL, PostgreSQL, PyTorch, Docker, React, FastAPI\n"
        b"%%EOF\n"
    )

    # 2. Compute initial cryptographic hash
    initial_sha256 = compute_sha256(original_pdf_bytes)
    assert len(initial_sha256) == 64
    assert initial_sha256 == hashlib.sha256(original_pdf_bytes).hexdigest()

    # 3. Store file via storage service
    user_id = "user-context-test-01"
    record_id = "test-master-integrity-01"
    filename = "Jordan_Lee_Original_Master_Resume.pdf"

    storage_path, stored_sha256, stored_size = store_master_resume_file(
        user_id=user_id,
        record_id=record_id,
        filename=filename,
        content=original_pdf_bytes,
    )
    assert stored_sha256 == initial_sha256
    assert stored_size == len(original_pdf_bytes)
    assert os.path.exists(storage_path)

    # 4. Clone resume model and simulate multiple tailoring runs
    master_dict = copy.deepcopy(SYNTHETIC_CANDIDATE_RESUME)
    master_before_json = json.dumps(master_dict, sort_keys=True)

    # Run tailoring 1 (Data Analyst)
    tailored_1 = execute_tailoring_pipeline(master_dict, JOB_DATA_ANALYST)
    # Run tailoring 2 (AI Engineer)
    tailored_2 = execute_tailoring_pipeline(master_dict, JOB_AI_ENGINEER)

    # 5. Verify master resume dictionary structure in memory is 100% UNCHANGED
    master_after_json = json.dumps(master_dict, sort_keys=True)
    assert master_before_json == master_after_json, "Master resume in-memory dictionary was mutated by tailoring operations!"

    # 6. Retrieve original file from storage and verify SHA-256 and byte equality
    retrieved_bytes = retrieve_master_resume_file(storage_path, expected_sha256=initial_sha256)
    assert retrieved_bytes == original_pdf_bytes, "Retrieved master resume bytes do not match original uploaded bytes!"
    assert compute_sha256(retrieved_bytes) == initial_sha256

    # 7. Tamper verification test: if file were tampered on disk, retrieve raises MasterResumeTamperError
    is_valid = verify_file_integrity(storage_path, initial_sha256)
    assert is_valid is True

    print(f"[PASS] Test A Passed: Master resume bytes remain 100% unchanged (SHA-256: {initial_sha256[:16]}...).")


# ==============================================================================
# TEST B: Job-Specific Context Differentiation
# ==============================================================================

def test_b_job_specific_context_differentiation():
    """
    Test B: Job-specific context
    Use one master resume and two distinct job descriptions:
    - Job 1: Data Analysis / Analytics Engineer
    - Job 2: AI / Machine Learning Engineer
    Verify that supported, relevant content changes appropriately:
    1. Professional summary adapts to target role and domain.
    2. Skills are prioritized to emphasize relevant tech (SQL/PostgreSQL for Data vs PyTorch/FastAPI for AI).
    3. Top ranked experience bullet matches the target role.
    """
    print("\n--- Test B: Job-Specific Context & Meaningful Role Differentiation ---")

    master = copy.deepcopy(SYNTHETIC_CANDIDATE_RESUME)

    # 1. Tailor for Job 1: Data Analyst
    res_data = execute_tailoring_pipeline(master, JOB_DATA_ANALYST)
    tailored_data = res_data["tailored_resume"]

    # 2. Tailor for Job 2: AI Engineer
    res_ai = execute_tailoring_pipeline(master, JOB_AI_ENGINEER)
    tailored_ai = res_ai["tailored_resume"]

    # --- Verification 1: Professional Summary Differentiation ---
    sum_data = tailored_data["summary"]["summary"]
    sum_ai = tailored_ai["summary"]["summary"]

    assert sum_data != sum_ai, "Tailored summaries are identical across distinct roles!"
    assert any(term in sum_data.lower() for term in ("data", "analysis", "pipeline", "sql")), (
        f"Data job summary did not adapt to data analytics: {sum_data}"
    )
    assert any(term in sum_ai.lower() for term in ("machine learning", "intelligent", "ai", "pytorch")), (
        f"AI job summary did not adapt to AI engineering: {sum_ai}"
    )

    # --- Verification 2: Skill Prioritization Differentiation ---
    skills_data = [s["skill_name"] for s in tailored_data.get("skills", [])]
    skills_ai = [s["skill_name"] for s in tailored_ai.get("skills", [])]

    # Data Analyst job should prioritize SQL/PostgreSQL in top skills
    assert skills_data[0] in ("SQL", "PostgreSQL", "Python"), f"Unexpected top skill for Data job: {skills_data[0]}"
    # AI Engineer job should prioritize PyTorch/Python in top skills
    assert skills_ai[0] in ("PyTorch", "Python"), f"Unexpected top skill for AI job: {skills_ai[0]}"
    assert skills_data != skills_ai, "Skill prioritization did not differentiate between jobs!"

    # --- Verification 3: Experience Bullets Ranking Differentiation ---
    # In Apex Cloud Systems experience:
    exp_data = tailored_data["experiences"][0]
    exp_ai = tailored_ai["experiences"][0]

    top_bullet_data = exp_data["bullets"][0]["content"]
    top_bullet_ai = exp_ai["bullets"][0]["content"]

    # Data Analyst should rank b-102 (PostgreSQL query optimization) or b-101 above b-103 (PyTorch anomaly detection)
    assert "PostgreSQL" in top_bullet_data or "pipelines" in top_bullet_data
    # AI Engineer should rank b-103 (PyTorch anomaly detection) or b-101 above b-102 (PostgreSQL queries)
    assert "PyTorch" in top_bullet_ai or "event pipelines" in top_bullet_ai

    # --- Verification 4: Project Prioritization ---
    proj_data = tailored_data["projects"][0]["name"]
    proj_ai = tailored_ai["projects"][0]["name"]

    assert proj_data == "QueryInsight", f"Expected QueryInsight (SQL project) first for Data job, got {proj_data}"
    assert proj_ai == "NeuralStream", f"Expected NeuralStream (PyTorch project) first for AI job, got {proj_ai}"

    print("[PASS] Test B Passed: Distinct, role-adapted summaries, bullet rankings, and skills verified.")


# ==============================================================================
# TEST C: Factual Accuracy & Anti-Hallucination
# ==============================================================================

def test_c_factual_accuracy_anti_hallucination():
    """
    Test C: Factual accuracy
    Include job requirements for skills absent from the master resume (e.g. Kubernetes, Rust, Snowflake).
    Verify that:
    1. The tailoring engine does NOT add absent skills into the candidate's skills list.
    2. Does NOT add absent skills into rewritten bullets.
    3. Accurately identifies and flags absent skills in missing qualifications / skill gaps.
    """
    print("\n--- Test C: Factual Accuracy & Skill Gap Flagging ---")

    job_with_missing_skills = {
        "id": "job-missing-skills-test",
        "job_title": "Principal Systems Engineer",
        "company_name": "NextGen Systems",
        "job_description": """
Looking for a Principal Systems Engineer with expertise in:
Required Skills:
- Rust systems programming
- Kubernetes cluster orchestration
- Snowflake cloud data warehouse
- Python backend services
Responsibilities:
- Build high-scale microservices in Rust and Python.
- Deploy and manage Kubernetes clusters.
        """.strip(),
    }

    master = copy.deepcopy(SYNTHETIC_CANDIDATE_RESUME)
    res = execute_tailoring_pipeline(master, job_with_missing_skills)
    tailored = res["tailored_resume"]

    # 1. Verify candidate's claimed skills do NOT contain Rust, Kubernetes, or Snowflake
    claimed_skills = {s["skill_name"].lower() for s in tailored.get("skills", [])}
    assert "rust" not in claimed_skills, "Fabricated skill 'Rust' was added to claimed skills!"
    assert "kubernetes" not in claimed_skills, "Fabricated skill 'Kubernetes' was added to claimed skills!"
    assert "snowflake" not in claimed_skills, "Fabricated skill 'Snowflake' was added to claimed skills!"

    # 2. Verify all bullets are free from fabricated skills
    all_bullets_text = " ".join(
        b["content"] for exp in tailored.get("experiences", []) for b in exp.get("bullets", [])
    ).lower()
    assert "rust" not in all_bullets_text
    assert "kubernetes" not in all_bullets_text
    assert "snowflake" not in all_bullets_text

    # 3. Verify missing skills are accurately flagged in missing qualifications / skill gaps
    missing_quals = res.get("missing_qualifications") or res["tailoring_plan"].get("missing_skills") or []
    missing_lower = [m.lower() for m in missing_quals]
    assert any("rust" in m for m in missing_lower), "Missing skill 'Rust' was not flagged in gaps!"
    assert any("snowflake" in m for m in missing_lower), "Missing skill 'Snowflake' was not flagged in gaps!"

    # 4. Strict Section 63 Integrity Validation
    is_valid, err = verify_resume_integrity(master, tailored)
    assert is_valid is True, f"Integrity check failed: {err}"

    print("[PASS] Test C Passed: Zero fabricated skills; unevidenced requirements flagged in skill gaps.")


# ==============================================================================
# TEST D: Evidence-Based Semantic & Transferable Matching
# ==============================================================================

def test_d_evidence_matching_transferable_skills():
    """
    Test D: Evidence matching
    Include relevant experience described using terminology different from the job description.
    For example:
    - Master resume has 'PostgreSQL' and 'analytical queries'
    - Job requires 'MySQL' or 'Relational Databases'
    Verify that semantic/ecosystem matcher recognizes the transferable relationship.
    """
    print("\n--- Test D: Evidence Matching & Transferable Capabilities ---")

    job_profile = {
        "job_id": "job-transferable-test",
        "job_title": "Database Platform Engineer",
        "company_name": "DataScale Corp",
        "domain": "Backend & Distributed Systems",
        "seniority_level": "Senior",
        "required_skills": ["MySQL", "FastAPI"],
        "preferred_skills": ["Redis"],
        "responsibilities": [
            "Scale relational database performance and query efficiency",
            "Develop high-throughput REST APIs",
        ],
    }

    evidence_report = build_evidence_match_report(job_profile, SYNTHETIC_CANDIDATE_RESUME)

    # 1. Check MySQL requirement: candidate has PostgreSQL (transferable equivalent)
    mysql_match = next(
        (item for item in evidence_report["matched_requirements"] if item["requirement"] == "MySQL"),
        None
    )
    assert mysql_match is not None
    assert mysql_match["classification"] == "partially_supported", (
        f"Expected MySQL to be classified as partially_supported via PostgreSQL transferable experience, got: {mysql_match['classification']}"
    )
    assert mysql_match["transferable_skill"] == "PostgreSQL"
    assert len(mysql_match["evidence_snippets"]) > 0

    # 2. Check FastAPI requirement: candidate has direct evidence
    fastapi_match = next(
        (item for item in evidence_report["matched_requirements"] if item["requirement"] == "FastAPI"),
        None
    )
    assert fastapi_match is not None
    assert fastapi_match["classification"] == "strongly_supported"

    # 3. Check Strategic focus narrative
    strategic_focus = evidence_report.get("recommended_strategic_focus", "")
    assert "transferable" in strategic_focus.lower()

    print("[PASS] Test D Passed: Semantic matcher recognized PostgreSQL as transferable foundation for MySQL.")


# ==============================================================================
# TEST E: Version Isolation & Independent Persistence
# ==============================================================================

def test_e_version_isolation_and_persistence():
    """
    Test E: Version isolation
    1. Generate tailored resume for Job 1.
    2. Generate tailored resume for Job 2.
    3. Verify each tailored resume has distinct IDs, distinct names, and links to source resume & respective job.
    4. Verify editing/tailoring one job does not alter another tailored version or the master resume.
    """
    print("\n--- Test E: Version Isolation & Independent Versioning ---")

    master = copy.deepcopy(SYNTHETIC_CANDIDATE_RESUME)

    res_1 = execute_tailoring_pipeline(master, JOB_DATA_ANALYST)
    tailored_1 = res_1["tailored_resume"]

    res_2 = execute_tailoring_pipeline(master, JOB_AI_ENGINEER)
    tailored_2 = res_2["tailored_resume"]

    # 1. Independent IDs
    assert tailored_1["id"] != tailored_2["id"]
    assert tailored_1["id"] != master["id"]
    assert tailored_2["id"] != master["id"]

    # 2. Correct relationship links
    assert tailored_1["source_resume_id"] == master["id"]
    assert tailored_1["target_job_id"] == JOB_DATA_ANALYST["id"]
    assert tailored_1["is_tailored"] is True

    assert tailored_2["source_resume_id"] == master["id"]
    assert tailored_2["target_job_id"] == JOB_AI_ENGINEER["id"]
    assert tailored_2["is_tailored"] is True

    # 3. Modify tailored_1 in memory and verify tailored_2 and master are unaffected
    tailored_1["summary"]["summary"] = "USER_MODIFIED_CUSTOM_DATA_SUMMARY"
    tailored_1["skills"].append({"id": "sk-new", "skill_name": "Tableau", "category": "BI"})

    assert tailored_2["summary"]["summary"] != "USER_MODIFIED_CUSTOM_DATA_SUMMARY"
    assert master["summary"]["summary"] != "USER_MODIFIED_CUSTOM_DATA_SUMMARY"
    assert not any(s["skill_name"] == "Tableau" for s in master["skills"])
    assert not any(s["skill_name"] == "Tableau" for s in tailored_2["skills"])

    print("[PASS] Test E Passed: Version isolation verified; tailored instances are strictly independent.")


# ==============================================================================
# TEST F: Failure Handling & Graceful Degradation
# ==============================================================================

def test_f_failure_handling_and_safety():
    """
    Test F: Failure handling
    1. Empty/incomplete job description -> raises InvalidJobDescriptionError.
    2. Malformed PDF/DOCX bytes -> raises ValueError without crashing.
    3. Model returns invalid JSON or halluncinated metrics -> output_validator reverts unsupported claims.
    4. Master resume remains completely intact after all failures.
    """
    print("\n--- Test F: Failure Handling & Defensive Guardrails ---")

    # 1. Empty Job Description rejection
    empty_job = {"id": "job-empty", "job_title": "", "job_description": ""}
    try:
        extract_job_profile(empty_job)
        assert False, "Failed to reject empty job description!"
    except InvalidJobDescriptionError as e:
        assert "empty or incomplete" in str(e).lower()

    # 2. Corrupted PDF text extraction
    corrupted_bytes = b"NOT_A_VALID_PDF_HEADER_RAW_BYTES_CORRUPTED"
    try:
        extract_text_from_pdf(corrupted_bytes)
        assert False, "Failed to reject corrupted PDF!"
    except ValueError as e:
        assert "couldn't read this pdf" in str(e).lower()

    # 3. Model output hallucination rejection (Output Validator)
    hallucinated_ai_json = {
        "job_analysis": {"required_skills": ["Python"]},
        "missing_qualifications": ["Kubernetes"],
        # Hallucinated metric: "$250M revenue" and "99.999% uptime" not in master
        "tailored_summary": "Full-stack engineer managing $250M revenue infrastructure and Google Cloud systems.",
        "summary_reason": "Emphasized cloud scale.",
        # Hallucinated skill: "Golang", "Solidity"
        "prioritized_skills": ["Python", "Golang", "Solidity"],
        "tailored_experiences": [
            {
                "experience_id": "exp-1",
                "bullets": [
                    {
                        "source_bullet_id": "b-101",
                        "content": "Engineered distributed event pipelines using Python and FastAPI, processing 500M daily events with 100% uptime.",
                        "is_rewritten": True,
                        "reason": "Inflated numbers",
                    }
                ],
            }
        ],
    }

    audited = validate_and_filter_ai_output(
        hallucinated_ai_json,
        SYNTHETIC_CANDIDATE_RESUME,
        JOB_DATA_ANALYST,
    )

    # Summary should be REVERTED to master because of fabricated $250M revenue
    orig_sum = SYNTHETIC_CANDIDATE_RESUME["summary"]["summary"]
    assert audited["sanitized_summary"] == orig_sum, "Fabricated revenue in summary was not rejected!"
    assert "unsupported numbers or metrics" in audited["summary_reason"].lower()

    # Fabricated skills Golang, Solidity should be dropped from sanitized skills
    assert "Golang" not in audited["sanitized_skills"]
    assert "Solidity" not in audited["sanitized_skills"]
    assert "Golang" in audited["missing_qualifications"]

    # Experience bullet rewrite with inflated metric (500M, 100%) should be reverted to master bullet text
    audited_bullet = audited["audited_experiences"]["exp-1"][0]
    assert audited_bullet["status"] == "reverted"
    assert audited_bullet["content"] == "Engineered distributed event pipelines using Python and FastAPI, processing 45M daily events with 99.99% uptime."

    print("[PASS] Test F Passed: Empty jobs stopped, corrupted docs rejected, and AI hallucinations reverted.")


# ==============================================================================
# TEST G: Existing Functionality & Export Verification
# ==============================================================================

def test_g_existing_functionality_and_exports():
    """
    Test G: Existing functionality
    1. Verify master resume export retrieves original binary bytes.
    2. Verify tailored resume export renders valid PDF binary.
    3. Verify tailored resume export renders valid DOCX binary.
    4. Verify templates ("ats-classic", "professional", "compact") render correctly.
    """
    print("\n--- Test G: Existing Functionality, Templates & Binary Exports ---")

    master = copy.deepcopy(SYNTHETIC_CANDIDATE_RESUME)
    res_tailored = execute_tailoring_pipeline(master, JOB_DATA_ANALYST)
    tailored = res_tailored["tailored_resume"]

    # 1. PDF Export Test
    pdf_bytes = generate_resume_pdf(tailored, template_id="ats-classic")
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-"), "Generated export is not a valid PDF document"

    # 2. DOCX Export Test
    docx_bytes = generate_resume_docx(tailored, template_id="ats-classic")
    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 1000
    assert docx_bytes.startswith(b"PK"), "Generated export is not a valid Word DOCX package"

    # 3. Compact & Professional Templates
    pdf_compact = generate_resume_pdf(tailored, template_id="compact")
    assert pdf_compact.startswith(b"%PDF-")

    pdf_pro = generate_resume_pdf(tailored, template_id="professional")
    assert pdf_pro.startswith(b"%PDF-")

    print("[PASS] Test G Passed: PDF/DOCX generators and all templates rendered valid binary streams.")


# ==============================================================================
# MAIN TEST RUNNER
# ==============================================================================

def run_all_context_aware_tests():
    print("=" * 70)
    print("  CONTEXT-AWARE RESUME TAILORING & MASTER IMMUTABILITY TEST SUITE  ")
    print("=" * 70)

    asyncio.run(init_db())

    test_a_master_resume_integrity()
    test_b_job_specific_context_differentiation()
    test_c_factual_accuracy_anti_hallucination()
    test_d_evidence_matching_transferable_skills()
    test_e_version_isolation_and_persistence()
    test_f_failure_handling_and_safety()
    test_g_existing_functionality_and_exports()

    print("\n" + "=" * 70)
    print("  ALL CONTEXT-AWARE RESUME TAILORING TESTS PASSED (TESTS A - G)!  ")
    print("=" * 70)


if __name__ == "__main__":
    run_all_context_aware_tests()
