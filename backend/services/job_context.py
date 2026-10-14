"""
TailorResume — Job-Specific Context Engine (Module 4 Extension)
Parses a saved job description into a deep, structured job context profile:
- Job title, employer, domain, seniority level
- Required vs preferred technical skills
- Core responsibilities & key actions
- Experience requirements (years, specific scopes)
- Qualifications & certifications
- Explicit constraints (remote, clearance, location)
- Domain keywords and weights
"""

import re
from typing import Dict, Any, List, Optional, Set, Tuple

from services.matching_engine import (
    COMPILED_TAXONOMY,
    STOPWORDS,
    extract_meaningful_tokens,
    split_job_sections,
)


class InvalidJobDescriptionError(ValueError):
    """Raised when job description is empty, incomplete, or unavailable."""
    pass


SENIORITY_KEYWORDS = {
    "Principal": ["principal", "distinguished", "fellow"],
    "Staff": ["staff", "architect"],
    "Lead": ["lead", "tech lead", "team lead", "head of"],
    "Senior": ["senior", "sr.", "sr ", "experienced"],
    "Manager": ["engineering manager", "manager", "director", "vp"],
    "Mid-Level": ["intermediate", "mid-level", "mid level"],
    "Junior": ["junior", "jr.", "jr ", "entry-level", "entry level", "associate"],
    "Intern": ["intern", "internship", "co-op"],
}

DOMAIN_PATTERNS = {
    "AI & Machine Learning": [
        "machine learning", "deep learning", "nlp", "llm", "large language model",
        "computer vision", "generative ai", "ai engineer", "data science", "pytorch", "tensorflow"
    ],
    "Data Engineering & Analytics": [
        "data engineer", "data pipeline", "etl", "data warehouse", "snowflake", "bigquery",
        "spark", "hadoop", "bi", "data analyst", "business intelligence", "sql"
    ],
    "Backend & Distributed Systems": [
        "backend", "microservices", "distributed systems", "rest api", "graphql",
        "high-throughput", "scalability", "concurrency", "low latency"
    ],
    "Frontend & UI Engineering": [
        "frontend", "front-end", "ui", "ux", "react", "vue", "angular", "css", "html",
        "design system", "accessibility", "client-side", "web performance"
    ],
    "Cloud & DevOps/SRE": [
        "devops", "sre", "reliability engineer", "kubernetes", "docker", "ci/cd",
        "terraform", "aws", "gcp", "azure", "infrastructure as code"
    ],
    "Security & Compliance": [
        "cybersecurity", "infosec", "soc2", "hipaa", "penetration testing",
        "vulnerability", "encryption", "auth", "oauth"
    ],
    "Full-Stack Engineering": [
        "full stack", "full-stack", "end-to-end", "client and server"
    ],
}


def extract_seniority_level(title: str, text: str) -> str:
    """Detects role seniority from title and description text."""
    combined = f"{title} {text}".lower()
    for level, keywords in SENIORITY_KEYWORDS.items():
        if any(kw in title.lower() for kw in keywords):
            return level
    for level, keywords in SENIORITY_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(kw)}\b", combined) for kw in keywords):
            return level
    return "Mid-Senior"


def extract_domain(title: str, text: str) -> str:
    """Detects technical domain specialization."""
    combined = f"{title}\n{text}".lower()
    domain_scores: Dict[str, int] = {}
    for domain, terms in DOMAIN_PATTERNS.items():
        count = sum(1 for term in terms if term in combined)
        if count > 0:
            domain_scores[domain] = count

    if not domain_scores:
        return "Software Engineering"

    # Return top scoring domain
    return max(domain_scores.items(), key=lambda x: x[1])[0]


def extract_years_of_experience(text: str) -> Optional[int]:
    """Finds required years of experience (e.g. '5+ years', '3-5 years')."""
    matches = re.findall(r'(\d+)\+?\s*(?:to|-)\s*(\d+)?\s*years?', text, re.IGNORECASE)
    if matches:
        first = matches[0]
        try:
            return int(first[0])
        except Exception:
            pass
    single_matches = re.findall(r'(\d+)\+?\s*years?', text, re.IGNORECASE)
    if single_matches:
        try:
            return int(single_matches[0])
        except Exception:
            pass
    return None


def extract_job_profile(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes and validates the selected job description.
    Returns a comprehensive structured JobProfile.
    """
    job_id = job.get("id")
    job_title = (job.get("job_title") or "").strip()
    company_name = (job.get("company_name") or "").strip()
    job_desc = (job.get("job_description") or "").strip()
    requirements_text = (job.get("requirements") or "").strip()
    qualifications_text = (job.get("qualifications") or "").strip()
    responsibilities_text = (job.get("responsibilities") or "").strip()

    full_job_text = f"{job_title}\n{job_desc}\n{requirements_text}\n{qualifications_text}\n{responsibilities_text}".strip()

    # Minimum data validation
    if len(full_job_text) < 30 or not job_title:
        raise InvalidJobDescriptionError(
            "The selected job description is empty or incomplete. "
            "Please ensure the job title and description text are provided."
        )

    # 1. Detect Seniority and Domain
    seniority = extract_seniority_level(job_title, full_job_text)
    domain = extract_domain(job_title, full_job_text)
    years_exp = extract_years_of_experience(full_job_text)

    # 2. Split sections
    sections = split_job_sections(full_job_text)

    # 3. Categorize Required vs Preferred Skills using taxonomy
    req_section_text = sections.get("requirements", "") + "\n" + requirements_text
    pref_section_text = sections.get("preferred", "")
    all_text_lower = full_job_text.lower()

    required_skills: List[str] = []
    preferred_skills: List[str] = []
    seen_skills = set()

    for entry in COMPILED_TAXONOMY:
        canonical = entry["canonical"]
        is_matched = False
        in_pref = False

        for term, pattern in entry["matchers"]:
            if pref_section_text and pattern.search(pref_section_text):
                is_matched = True
                in_pref = True
                break
            elif pattern.search(full_job_text):
                is_matched = True
                if "preferred" in full_job_text[max(0, pattern.search(full_job_text).start() - 60):pattern.search(full_job_text).start()].lower():
                    in_pref = True
                break

        if is_matched and canonical.lower() not in seen_skills:
            seen_skills.add(canonical.lower())
            if in_pref:
                preferred_skills.append(canonical)
            else:
                required_skills.append(canonical)

    # 4. Extract Key Responsibilities
    responsibilities: List[str] = []
    resp_source = responsibilities_text or sections.get("responsibilities", "")
    if resp_source:
        for line in resp_source.splitlines():
            line = line.strip(" -*•\t")
            if len(line) >= 20 and not line.endswith(":"):
                responsibilities.append(line)
    if not responsibilities and job_desc:
        # Fallback: extract bulleted lines from description
        for line in job_desc.splitlines():
            clean = line.strip(" -*•\t")
            if len(clean) >= 25 and any(clean.lower().startswith(v) for v in ("build", "design", "develop", "lead", "manage", "architect", "scale", "engineer", "collaborate", "implement", "drive", "create")):
                responsibilities.append(clean)

    # 5. Extract Constraints
    constraints: List[str] = []
    if "remote" in full_job_text.lower():
        constraints.append("Remote role")
    if "clearance" in full_job_text.lower():
        constraints.append("Security clearance required")
    if job.get("location"):
        constraints.append(f"Location: {job.get('location')}")

    # 6. Extract Important Domain Keywords
    meaningful_tokens = extract_meaningful_tokens(full_job_text)
    freq: Dict[str, int] = {}
    for tok in meaningful_tokens:
        if len(tok) >= 3 and tok.lower() not in STOPWORDS:
            freq[tok.lower()] = freq.get(tok.lower(), 0) + 1

    important_keywords = [
        word for word, count in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:15]
    ]

    return {
        "job_id": job_id,
        "job_title": job_title,
        "company_name": company_name or "Target Company",
        "seniority_level": seniority,
        "domain": domain,
        "required_experience_years": years_exp,
        "required_skills": required_skills[:12],
        "preferred_skills": preferred_skills[:8],
        "responsibilities": responsibilities[:8],
        "qualifications": [q.strip(" -*•") for q in qualifications_text.splitlines() if len(q.strip()) > 10][:5],
        "constraints": constraints,
        "important_keywords": important_keywords,
    }
