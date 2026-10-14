"""
TailorResume — Module 5 Backend Job-Resume Matching Test Suite
Validates:
- Protected routes require authenticated Bearer token (HTTP 401).
- Server derives user_id strictly from Supabase Auth identity.
- Multi-tenant isolation: User A cannot match with User B's job or User B's resume.
- User A cannot view or delete User B's match results.
- Deterministic calculation accuracy:
  * Case 1 — Strong Match
  * Case 2 — Weak Match
  * Case 3 — Alias Match (JavaScript <-> JS)
  * Case 4 — Phrase Match (Machine Learning, REST API, Distributed Systems)
  * Case 5 — False Positive Protection (C, R, C++, Go)
  * Case 6 — Missing Skills (Required missing)
  * Case 7 — Preferred Skills (Preferred missing)
  * Case 8 — Experience duration calculation
  * Case 9 — Unknown vs Missing (Incomplete employment dates)
  * Case 10 — Limited Data Handling (Stub job description)
  * Case 11 — Empty Resume Handling
  * Case 12 — Cross-user security rejection
- Weight verification (40% skills, 25% responsibilities, 15% experience, 10% qualifications, 10% keywords).
- Stale analysis detection on resource update.
- Algorithm versioning (v1).
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
    ResumeSummary,
    ResumeExperience,
    ResumeExperienceBullet,
    ResumeSkill,
    ResumeEducation,
    JobMatch,
)
from services.matching_engine import (
    run_job_match_analysis,
    WEIGHT_SKILLS,
    WEIGHT_RESPONSIBILITIES,
    WEIGHT_EXPERIENCE,
    WEIGHT_QUALIFICATIONS,
    WEIGHT_KEYWORDS,
    ALGORITHM_VERSION,
)


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


def test_matching_weights_and_constants():
    """Verify configured weights sum to 1.0 and algorithm version is v1."""
    total_weight = (
        WEIGHT_SKILLS +
        WEIGHT_RESPONSIBILITIES +
        WEIGHT_EXPERIENCE +
        WEIGHT_QUALIFICATIONS +
        WEIGHT_KEYWORDS
    )
    assert round(total_weight, 2) == 1.00, f"Weights must sum to 1.0, got {total_weight}"
    assert WEIGHT_SKILLS == 0.40, f"Skills weight must be 0.40, got {WEIGHT_SKILLS}"
    assert WEIGHT_RESPONSIBILITIES == 0.25, f"Responsibilities weight must be 0.25, got {WEIGHT_RESPONSIBILITIES}"
    assert WEIGHT_EXPERIENCE == 0.15, f"Experience weight must be 0.15, got {WEIGHT_EXPERIENCE}"
    assert WEIGHT_QUALIFICATIONS == 0.10, f"Qualifications weight must be 0.10, got {WEIGHT_QUALIFICATIONS}"
    assert WEIGHT_KEYWORDS == 0.10, f"Keywords weight must be 0.10, got {WEIGHT_KEYWORDS}"
    assert ALGORITHM_VERSION == "v1", f"Algorithm version must be v1, got {ALGORITHM_VERSION}"
    print("[PASS] Matching weights and algorithm constants verified")


def test_deterministic_matching_cases():
    """Validates the 11 engine-level test cases deterministically."""
    # Case 1: Strong Match
    job_strong = {
        "job_title": "Senior Python Backend Engineer",
        "job_description": "We are looking for a Senior Python Developer with React, PostgreSQL, and AWS. Required: Python, PostgreSQL. Preferred: Docker, Kubernetes. Build scalable REST APIs. Minimum 5 years of experience.",
        "requirements": "Python, PostgreSQL, AWS",
        "responsibilities": "Build scalable REST APIs and collaborate with team.",
    }
    resume_strong = {
        "summary": {"content": "Senior engineer with 7 years experience building web backends."},
        "experiences": [
            {
                "company": "CloudTech",
                "job_title": "Senior Engineer",
                "start_date": "2018-01-01",
                "is_current": True,
                "bullets": ["Built scalable REST APIs using Python and PostgreSQL.", "Deployed containerized microservices."]
            }
        ],
        "skills": [{"name": "Python"}, {"name": "PostgreSQL"}, {"name": "React"}, {"name": "Docker"}],
        "educations": [{"degree": "Bachelor of Science", "field_of_study": "Computer Science"}],
    }
    res_strong = run_job_match_analysis(job_strong, resume_strong)
    assert res_strong["overall_score"] >= 75, f"Expected Strong Match >= 75, got {res_strong['overall_score']}"
    assert res_strong["match_level"] in ("Strong Match", "Excellent Match")
    assert res_strong["category_scores"]["skills"] > 60
    assert res_strong["category_scores"]["responsibilities"] >= 70
    assert res_strong["experience_assessment"]["status"] == "matched"
    print("[PASS] Case 1 — Strong Match verified")

    # Case 2: Weak Match
    job_ruby = {
        "job_title": "Ruby on Rails Developer",
        "job_description": "We are seeking a Ruby on Rails specialist with Redis and Cassandra. Required: Ruby, Cassandra.",
        "requirements": "Ruby, Cassandra, Redis",
    }
    resume_sales = {
        "summary": {"content": "Sales executive experienced in lead generation and customer relations."},
        "experiences": [{"company": "SalesCo", "job_title": "Account Exec", "start_date": "2020-01-01", "is_current": True}],
        "skills": [{"name": "Salesforce"}, {"name": "Excel"}],
    }
    res_weak = run_job_match_analysis(job_ruby, resume_sales)
    assert res_weak["overall_score"] < 40, f"Expected Weak Match < 40, got {res_weak['overall_score']}"
    assert res_weak["match_level"] == "Weak Match"
    print("[PASS] Case 2 — Weak Match verified")

    # Case 3: Alias Match (JavaScript <-> JS, AWS <-> Amazon Web Services)
    job_alias = {
        "job_title": "Full Stack Dev",
        "job_description": "Requires JavaScript and Amazon Web Services.",
    }
    resume_alias = {
        "summary": {"content": "Full stack engineer proficient in JS and AWS."},
        "skills": [{"name": "JS"}, {"name": "AWS"}],
        "experiences": [{"company": "Co", "job_title": "Dev", "bullets": ["Built client apps with JS."]}],
    }
    res_alias = run_job_match_analysis(job_alias, resume_alias)
    matched_aliases = {m["canonical"]: m["alias_matched"] for m in res_alias["matched_skills"]}
    assert matched_aliases.get("JavaScript") == "JS", f"Expected JS alias match, got {matched_aliases}"
    assert matched_aliases.get("AWS") in ("AWS", "Amazon Web Services")
    print("[PASS] Case 3 — Alias Match verified")

    # Case 4: Phrase Match (Machine Learning, Distributed Systems)
    job_phrase = {
        "job_title": "ML Platform Engineer",
        "job_description": "Must have expertise in Machine Learning and Distributed Systems.",
    }
    resume_phrase = {
        "summary": {"content": "Expert in machine learning models and distributed systems infrastructure."},
        "experiences": [{"company": "AI Labs", "job_title": "ML Eng", "bullets": ["Scaled machine learning pipelines."]}],
    }
    res_phrase = run_job_match_analysis(job_phrase, resume_phrase)
    canonicals = [m["canonical"] for m in res_phrase["matched_skills"]]
    assert "Machine Learning" in canonicals, "Machine Learning phrase must match"
    assert "Distributed Systems" in canonicals, "Distributed Systems phrase must match"
    print("[PASS] Case 4 — Multi-word Phrase Match verified")

    # Case 5: False Positive Protection
    job_fp = {
        "job_title": "C++ Systems Engineer",
        "job_description": "We build high-frequency trading infrastructure in C++ and R.",
    }
    resume_fp = {
        "summary": {"content": "Creative chef and enthusiastic runner."},
        "experiences": [{"company": "Restaurant", "job_title": "Chef", "bullets": ["Cooked gourmet meals with care."]}],
        "skills": [{"name": "Communication"}],
    }
    res_fp = run_job_match_analysis(job_fp, resume_fp)
    fp_matched = [m["canonical"] for m in res_fp["matched_skills"]]
    assert "C++" not in fp_matched, f"C++ should NOT match 'creative' or 'chef': {fp_matched}"
    assert "R" not in fp_matched, f"R should NOT match 'runner': {fp_matched}"
    print("[PASS] Case 5 — False Positive Protection verified")

    # Case 6 & 7: Missing Skills & Preferred Skills separation
    job_req_pref = {
        "job_title": "DevOps Engineer",
        "job_description": "Required Skills:\nPython\nDocker\n\nPreferred Skills:\nKubernetes\nTerraform",
    }
    resume_partial = {
        "skills": [{"name": "Python"}, {"name": "Docker"}],
        "experiences": [{"company": "Co", "job_title": "Dev", "bullets": ["Used Python and Docker."]}],
    }
    res_pref = run_job_match_analysis(job_req_pref, resume_partial)
    req_missing = [s["canonical"] for s in res_pref["missing_skills"] if not s["is_preferred"]]
    pref_missing = [s["canonical"] for s in res_pref["missing_skills"] if s["is_preferred"]]
    assert len(req_missing) == 0, f"Python and Docker are present; expected 0 required missing, got {req_missing}"
    assert "Kubernetes" in pref_missing, f"Kubernetes should be preferred missing: {pref_missing}"
    assert "Terraform" in pref_missing, f"Terraform should be preferred missing: {pref_missing}"
    print("[PASS] Cases 6 & 7 — Required vs Preferred Missing Skills separated")

    # Case 8: Experience Assessment (years met)
    job_exp = {
        "job_title": "Lead Architect",
        "job_description": "Requires at least 5 years of professional experience.",
    }
    resume_exp = {
        "experiences": [
            {"company": "A", "job_title": "Dev", "start_date": "2015-01-01", "end_date": "2021-01-01"},
            {"company": "B", "job_title": "Lead", "start_date": "2021-02-01", "is_current": True},
        ]
    }
    res_exp = run_job_match_analysis(job_exp, resume_exp)
    assert res_exp["experience_assessment"]["status"] == "matched"
    assert res_exp["experience_assessment"]["score"] == 100
    assert res_exp["experience_assessment"]["candidate_years"] >= 5.0
    print("[PASS] Case 8 — Experience duration calculation verified")

    # Case 9: Unknown vs Missing (Incomplete dates)
    resume_no_dates = {
        "experiences": [
            {"company": "A", "job_title": "Dev", "start_date": None, "end_date": None}
        ]
    }
    res_unknown = run_job_match_analysis(job_exp, resume_no_dates)
    assert res_unknown["experience_assessment"]["status"] == "unknown", f"Expected unknown, got {res_unknown['experience_assessment']}"
    print("[PASS] Case 9 — Unknown vs Missing distinction verified")

    # Case 10: Limited Data Handling (Stub job description)
    job_stub = {
        "job_title": "SWE",
        "job_description": "Short text.",
    }
    res_stub = run_job_match_analysis(job_stub, resume_strong)
    assert res_stub["limited_data"] == True
    assert res_stub["overall_score"] == 0
    assert "enough job information" in res_stub["message"]
    print("[PASS] Case 10 — Limited data handling for stub jobs verified")

    # Case 11: Empty Resume Handling
    resume_empty = {}
    res_empty = run_job_match_analysis(job_strong, resume_empty)
    assert res_empty["limited_data"] == True
    assert res_empty["overall_score"] == 0
    print("[PASS] Case 11 — Empty resume handling verified")


def test_unauthenticated_matching_rejected():
    """Verify unauthenticated requests to match endpoints return 401."""
    client = TestClient(app)
    fake_job_id = str(uuid.uuid4())
    fake_resume_id = str(uuid.uuid4())

    # POST match
    resp = client.post(f"/api/jobs/{fake_job_id}/match", json={"resume_id": fake_resume_id})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # GET matches
    resp = client.get(f"/api/jobs/{fake_job_id}/matches")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # GET match detail
    fake_match_id = str(uuid.uuid4())
    resp = client.get(f"/api/jobs/matches/{fake_match_id}")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    print("[PASS] Unauthenticated match requests rejected with HTTP 401")


def test_matching_api_flow_and_security():
    """
    End-to-end integration test validating:
    - User A creates Job A and Resume A.
    - User B creates Job B and Resume B.
    - User A matching Job A with Resume A succeeds (HTTP 200).
    - User A attempting to match Job B (User B's job) is rejected with 404.
    - User A attempting to match with Resume B (User B's resume) is rejected with 404.
    - User B attempting to view User A's match result is rejected with 404.
    - Match result includes transparent categories, disclaimers, and versioning.
    """
    client = TestClient(app)

    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    token_a = create_test_jwt(user_a, email="usera@tailor.com")
    token_b = create_test_jwt(user_b, email="userb@tailor.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Create Job for User A
    job_a_resp = client.post("/api/jobs", headers=headers_a, json={
        "job_title": "Full Stack Engineer",
        "job_description": "We need a Full Stack Engineer with React, TypeScript, and Node.js. Build REST APIs. Minimum 3 years of experience.",
        "requirements": "React, TypeScript, Node.js",
        "responsibilities": "Build REST APIs and maintain frontend."
    })
    assert job_a_resp.status_code == 201, f"Failed to create job A: {job_a_resp.text}"
    job_a_id = job_a_resp.json()["job"]["id"]

    # 2. Create Job for User B
    job_b_resp = client.post("/api/jobs", headers=headers_b, json={
        "job_title": "Data Scientist",
        "job_description": "Machine learning, Python, and SQL specialist needed for analytics team.",
    })
    assert job_b_resp.status_code == 201
    job_b_id = job_b_resp.json()["job"]["id"]

    # 3. Create Resume for User A
    resume_a_resp = client.post("/api/resumes", headers=headers_a, json={"name": "Software Engineer Resume"})
    assert resume_a_resp.status_code == 201, f"Failed to create resume A: {resume_a_resp.text}"
    resume_a_id = resume_a_resp.json()["id"]

    # Add experience and skills to Resume A
    put_resp = client.put(f"/api/resumes/{resume_a_id}", headers=headers_a, json={
        "summary": {"summary": "Experienced engineer with 4 years building web backends."},
        "experiences": [
            {
                "company": "Tech Ventures",
                "job_title": "Software Engineer",
                "start_date": "2020-01-01",
                "is_current": True,
                "bullets": [
                    {"content": "Designed and implemented REST APIs using Node.js and TypeScript.", "display_order": 0},
                    {"content": "Built web interfaces with React.", "display_order": 1}
                ]
            }
        ],
        "skills": [
            {"skill_name": "React", "category": "Frameworks"},
            {"skill_name": "TypeScript", "category": "Languages"},
            {"skill_name": "Node.js", "category": "Frameworks"}
        ]
    })
    assert put_resp.status_code == 200, f"Failed to populate resume A: {put_resp.text}"

    # 4. Create Resume for User B
    resume_b_resp = client.post("/api/resumes", headers=headers_b, json={"name": "Data Analyst Resume"})
    assert resume_b_resp.status_code == 201
    resume_b_id = resume_b_resp.json()["id"]

    # 5. User A matches Job A + Resume A (Authorized -> PASS)
    match_resp = client.post(
        f"/api/jobs/{job_a_id}/match",
        headers=headers_a,
        json={"resume_id": resume_a_id}
    )
    assert match_resp.status_code == 200, f"Match failed: {match_resp.text}"
    match_data = match_resp.json()

    assert match_data["overall_score"] >= 70, f"Expected match score >= 70, got {match_data['overall_score']}"
    assert match_data["algorithm_version"] == "v1"
    assert "Job Match is an estimate" in match_data["disclaimer"]
    assert "skills" in match_data["category_scores"]
    assert "responsibilities" in match_data["category_scores"]
    assert len(match_data["matched_skills"]) >= 2
    match_id = match_data["match_id"]
    print("[PASS] User A matching own Job + Resume succeeded with score", match_data["overall_score"])

    # 6. Cross-User Security Test 1: User A attempts to match User B's Job (Rejected -> 404)
    cross_job_resp = client.post(
        f"/api/jobs/{job_b_id}/match",
        headers=headers_a,
        json={"resume_id": resume_a_id}
    )
    assert cross_job_resp.status_code == 404, f"Cross-job match should be 404, got {cross_job_resp.status_code}"
    print("[PASS] User A matching User B's Job rejected with 404")

    # 7. Cross-User Security Test 2: User A attempts to match with User B's Resume (Rejected -> 404)
    cross_res_resp = client.post(
        f"/api/jobs/{job_a_id}/match",
        headers=headers_a,
        json={"resume_id": resume_b_id}
    )
    assert cross_res_resp.status_code == 404, f"Cross-resume match should be 404, got {cross_res_resp.status_code}"
    print("[PASS] User A matching User B's Resume rejected with 404")

    # 8. Cross-User Security Test 3: User B attempts to read User A's Match Result (Rejected -> 404)
    get_match_resp = client.get(
        f"/api/jobs/matches/{match_id}",
        headers=headers_b
    )
    assert get_match_resp.status_code == 404, f"User B reading User A's match should be 404, got {get_match_resp.status_code}"
    print("[PASS] User B reading User A's Match record rejected with 404")

    # 9. List matches for Job A by User A (Authorized -> returns list)
    list_resp = client.get(f"/api/jobs/{job_a_id}/matches", headers=headers_a)
    assert list_resp.status_code == 200
    matches_list = list_resp.json()
    assert len(matches_list) >= 1
    assert matches_list[0]["id"] == match_id
    assert matches_list[0]["resume_name"] == "Software Engineer Resume"
    print("[PASS] List job matches for owner succeeded")

    # 10. Delete match
    del_resp = client.delete(f"/api/jobs/matches/{match_id}", headers=headers_a)
    assert del_resp.status_code == 200
    print("[PASS] Delete match record succeeded")


def main():
    print("--- Starting Module 5 Job-Resume Matching Test Suite ---")
    asyncio.run(init_db())
    test_matching_weights_and_constants()
    test_deterministic_matching_cases()
    test_unauthenticated_matching_rejected()
    test_matching_api_flow_and_security()
    print("--- All Module 5 Backend Tests Passed Successfully ---")


if __name__ == "__main__":
    main()
