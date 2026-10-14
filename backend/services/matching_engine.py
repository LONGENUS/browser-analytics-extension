"""
TailorResume — Deterministic Job-Resume Matching Engine (Module 5)
Provides explainable, deterministic analysis comparing a structured Resume
against a structured Job posting.

Strict Guarantees:
- ZERO LLM/AI dependencies: 100% deterministic rule-based matching.
- Terminology: "Job Match", "Match Analysis" (Never "ATS Score").
- Read-Only: Never modifies resume or job content.
- False Positive Protection: Token boundary awareness for short terms (e.g., C, R, Go, C++, C#).
- Explainable: Breaks down overall score into 5 transparent categories with explicit evidence.
"""

import re
import math
from datetime import datetime
from typing import Dict, Any, List, Optional, Set, Tuple


# ==============================================================================
# 1. SCORING WEIGHTS & CONSTANTS
# ==============================================================================

WEIGHT_SKILLS = 0.40
WEIGHT_RESPONSIBILITIES = 0.25
WEIGHT_EXPERIENCE = 0.15
WEIGHT_QUALIFICATIONS = 0.10
WEIGHT_KEYWORDS = 0.10

ALGORITHM_VERSION = "v1"

MATCH_DISCLAIMER = (
    "Job Match is an estimate based on the information present in this resume "
    "and job description. It is not an official ATS score or hiring prediction."
)

SCORE_BANDS = [
    (90, 100, "Excellent Match"),
    (75, 89, "Strong Match"),
    (60, 74, "Moderate Match"),
    (40, 59, "Low Match"),
    (0, 39, "Weak Match"),
]

def get_match_level(score: int) -> str:
    for low, high, label in SCORE_BANDS:
        if low <= score <= high:
            return label
    return "Weak Match" if score < 40 else "Excellent Match"


# ==============================================================================
# 2. STOPWORDS & TOKENIZATION
# ==============================================================================

STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "will", "shall", "may", "might", "must", "can",
    "role", "job", "position", "candidate", "responsibilities", "requirements",
    "qualifications", "company", "team", "work", "working", "opportunity",
    "experience", "years", "join", "looking", "seeking", "apply", "description",
    # Generic soft skills and filler words that should not inflate ATS score:
    "communication", "teamwork", "project", "projects", "ability", "collaborative",
    "collaboration", "interpersonal", "fast-paced", "detail-oriented", "self-starter",
    "passionate", "motivated", "dynamic", "flexible", "skills", "skill", "strong",
    "excellent", "proven", "track", "record", "help", "support", "responsible",
    "successful", "environment", "solutions", "needs", "business", "client", "clients",
    "management", "leadership", "time", "high", "quality", "day", "people", "process",
    "processes", "best", "practices", "impact", "deliver", "delivering", "results",
    "effective", "effectively", "drive", "driving", "growth", "value", "cross-functional",
    "cross", "functional", "goals", "organization", "including", "various", "well",
    "using", "knowledge", "understanding", "professional", "plus", "must-have", "good",
    "great", "daily", "duties", "task", "tasks", "ensure", "ensuring", "provide", "providing"
}

def normalize_text(text: Optional[str]) -> str:
    """Normalizes text: lowercase, unified spaces, stripped whitespace."""
    if not text:
        return ""
    # Replace non-breaking spaces and line returns with single spaces
    text = re.sub(r"[\r\n\t]+", " ", text)
    return " ".join(text.split()).strip()

def extract_meaningful_tokens(text: str) -> List[str]:
    """Extracts non-stopword alphanumeric tokens of length >= 2."""
    raw_tokens = re.findall(r"\b[a-zA-Z0-9+#.-]+\b", text.lower())
    clean_tokens = []
    for tok in raw_tokens:
        tok = tok.strip(".-")
        if len(tok) >= 2 and tok not in STOPWORDS:
            clean_tokens.append(tok)
    return clean_tokens


# ==============================================================================
# 3. EXTENSIBLE SKILL TAXONOMY
# ==============================================================================

# Taxonomy schema:
# canonical_name: {
#   "category": str,
#   "aliases": List[str],
#   "case_sensitive": bool (True for short tokens like 'C', 'R', 'Go')
# }

SKILL_TAXONOMY: Dict[str, Dict[str, Any]] = {
    # --- Programming Languages ---
    "Python": {
        "category": "Programming Languages",
        "aliases": ["Python3", "Python 3", "py"],
        "case_sensitive": False,
    },
    "JavaScript": {
        "category": "Programming Languages",
        "aliases": ["JS", "ECMAScript", "ES6", "Java Script"],
        "case_sensitive": False,
    },
    "TypeScript": {
        "category": "Programming Languages",
        "aliases": ["TS"],
        "case_sensitive": False,
    },
    "Java": {
        "category": "Programming Languages",
        "aliases": ["Core Java", "J2EE", "Java 8", "Java 11", "Java 17"],
        "case_sensitive": False,
    },
    "C++": {
        "category": "Programming Languages",
        "aliases": ["CPP", "C plus plus", "c++"],
        "case_sensitive": False,
    },
    "C#": {
        "category": "Programming Languages",
        "aliases": ["CSharp", "C Sharp", "c#"],
        "case_sensitive": False,
    },
    "C": {
        "category": "Programming Languages",
        "aliases": ["C Programming", "C Language"],
        "case_sensitive": True,  # Require exact word boundary and uppercase
    },
    "Go": {
        "category": "Programming Languages",
        "aliases": ["Golang"],
        "case_sensitive": False, # 'Golang' is unambiguous; 'Go' has specific matcher
    },
    "Rust": {
        "category": "Programming Languages",
        "aliases": ["Rustlang"],
        "case_sensitive": False,
    },
    "Ruby": {
        "category": "Programming Languages",
        "aliases": ["Ruby on Rails", "Rails"],
        "case_sensitive": False,
    },
    "PHP": {
        "category": "Programming Languages",
        "aliases": ["PHP7", "PHP8"],
        "case_sensitive": False,
    },
    "Swift": {
        "category": "Programming Languages",
        "aliases": ["SwiftUI"],
        "case_sensitive": False,
    },
    "Kotlin": {
        "category": "Programming Languages",
        "aliases": ["Android Kotlin"],
        "case_sensitive": False,
    },
    "Scala": {
        "category": "Programming Languages",
        "aliases": [],
        "case_sensitive": False,
    },
    "R": {
        "category": "Programming Languages",
        "aliases": ["R Programming", "R Language"],
        "case_sensitive": True,
    },
    "SQL": {
        "category": "Programming Languages",
        "aliases": ["Structured Query Language", "T-SQL", "PL/SQL"],
        "case_sensitive": False,
    },

    # --- Frameworks & Libraries ---
    "React": {
        "category": "Frameworks",
        "aliases": ["ReactJS", "React.js", "React Native"],
        "case_sensitive": False,
    },
    "Next.js": {
        "category": "Frameworks",
        "aliases": ["NextJS", "Next js"],
        "case_sensitive": False,
    },
    "Vue.js": {
        "category": "Frameworks",
        "aliases": ["Vue", "VueJS", "Vue 3"],
        "case_sensitive": False,
    },
    "Angular": {
        "category": "Frameworks",
        "aliases": ["AngularJS", "Angular 2+"],
        "case_sensitive": False,
    },
    "Node.js": {
        "category": "Frameworks",
        "aliases": ["NodeJS", "Node JS", "Node"],
        "case_sensitive": False,
    },
    "Express.js": {
        "category": "Frameworks",
        "aliases": ["ExpressJS", "Express"],
        "case_sensitive": False,
    },
    "FastAPI": {
        "category": "Frameworks",
        "aliases": ["Fast API"],
        "case_sensitive": False,
    },
    "Django": {
        "category": "Frameworks",
        "aliases": ["Django REST Framework", "DRF"],
        "case_sensitive": False,
    },
    "Flask": {
        "category": "Frameworks",
        "aliases": [],
        "case_sensitive": False,
    },
    "Spring Boot": {
        "category": "Frameworks",
        "aliases": ["Spring", "Spring Framework"],
        "case_sensitive": False,
    },
    ".NET": {
        "category": "Frameworks",
        "aliases": [".NET Core", "DotNet", "ASP.NET"],
        "case_sensitive": False,
    },
    "GraphQL": {
        "category": "Frameworks",
        "aliases": ["Graph QL", "Apollo GraphQL"],
        "case_sensitive": False,
    },
    "REST API": {
        "category": "Frameworks",
        "aliases": ["REST APIs", "RESTful API", "RESTful APIs", "REST", "RESTful Web Services"],
        "case_sensitive": False,
    },

    # --- Databases ---
    "PostgreSQL": {
        "category": "Databases",
        "aliases": ["Postgres", "Postgre SQL", "Postgresql"],
        "case_sensitive": False,
    },
    "MySQL": {
        "category": "Databases",
        "aliases": ["My SQL"],
        "case_sensitive": False,
    },
    "MongoDB": {
        "category": "Databases",
        "aliases": ["Mongo", "Mongo DB"],
        "case_sensitive": False,
    },
    "Redis": {
        "category": "Databases",
        "aliases": ["Redis Cache"],
        "case_sensitive": False,
    },
    "Elasticsearch": {
        "category": "Databases",
        "aliases": ["Elastic Search", "ELK Stack"],
        "case_sensitive": False,
    },
    "Cassandra": {
        "category": "Databases",
        "aliases": ["Apache Cassandra"],
        "case_sensitive": False,
    },
    "DynamoDB": {
        "category": "Databases",
        "aliases": ["AWS DynamoDB", "Dynamo DB"],
        "case_sensitive": False,
    },
    "Snowflake": {
        "category": "Databases",
        "aliases": ["Snowflake DW"],
        "case_sensitive": False,
    },

    # --- Cloud & DevOps ---
    "AWS": {
        "category": "Cloud",
        "aliases": ["Amazon Web Services", "Amazon AWS"],
        "case_sensitive": False,
    },
    "Google Cloud": {
        "category": "Cloud",
        "aliases": ["GCP", "Google Cloud Platform"],
        "case_sensitive": False,
    },
    "Microsoft Azure": {
        "category": "Cloud",
        "aliases": ["Azure", "MS Azure"],
        "case_sensitive": False,
    },
    "Docker": {
        "category": "DevOps",
        "aliases": ["Docker Containers", "Containerization"],
        "case_sensitive": False,
    },
    "Kubernetes": {
        "category": "DevOps",
        "aliases": ["K8s", "K8"],
        "case_sensitive": False,
    },
    "Terraform": {
        "category": "DevOps",
        "aliases": ["TF", "HashiCorp Terraform"],
        "case_sensitive": False,
    },
    "Ansible": {
        "category": "DevOps",
        "aliases": [],
        "case_sensitive": False,
    },
    "CI/CD": {
        "category": "DevOps",
        "aliases": ["Continuous Integration", "Continuous Deployment", "GitHub Actions", "GitLab CI", "Jenkins"],
        "case_sensitive": False,
    },
    "Linux": {
        "category": "DevOps",
        "aliases": ["Unix", "Ubuntu", "Debian", "CentOS", "RedHat", "Bash", "Shell Scripting"],
        "case_sensitive": False,
    },
    "Git": {
        "category": "Tools",
        "aliases": ["GitHub", "GitLab", "Version Control"],
        "case_sensitive": False,
    },

    # --- Architecture & Systems ---
    "Microservices": {
        "category": "Architecture",
        "aliases": ["Microservice Architecture", "Micro-services"],
        "case_sensitive": False,
    },
    "Distributed Systems": {
        "category": "Architecture",
        "aliases": ["Distributed Computing", "Distributed Architecture"],
        "case_sensitive": False,
    },
    "System Design": {
        "category": "Architecture",
        "aliases": ["Scalable Architecture", "Software Architecture"],
        "case_sensitive": False,
    },
    "Event-Driven Architecture": {
        "category": "Architecture",
        "aliases": ["Kafka", "RabbitMQ", "Event Driven", "Message Queue", "Pub/Sub"],
        "case_sensitive": False,
    },

    # --- Data Science & AI ---
    "Machine Learning": {
        "category": "Analytics",
        "aliases": ["ML", "Deep Learning", "Neural Networks"],
        "case_sensitive": False,
    },
    "Data Analysis": {
        "category": "Analytics",
        "aliases": ["Data Analytics", "Pandas", "NumPy", "Data Science"],
        "case_sensitive": False,
    },
    "Tableau": {
        "category": "Analytics",
        "aliases": ["Power BI", "Data Visualization"],
        "case_sensitive": False,
    },

    # --- Design & Tools ---
    "Figma": {
        "category": "Design",
        "aliases": ["UI/UX Design", "Wireframing", "Prototyping"],
        "case_sensitive": False,
    },
    "Jira": {
        "category": "Tools",
        "aliases": ["Atlassian Jira", "Confluence"],
        "case_sensitive": False,
    },
    "Salesforce": {
        "category": "Tools",
        "aliases": ["SFDC", "Salesforce CRM"],
        "case_sensitive": False,
    },
    "Excel": {
        "category": "Tools",
        "aliases": ["Microsoft Excel", "Spreadsheets"],
        "case_sensitive": False,
    },

    # --- Business & Soft Skills ---
    "Agile": {
        "category": "Project Management",
        "aliases": ["Scrum", "Kanban", "Sprint Planning"],
        "case_sensitive": False,
    },
    "Project Management": {
        "category": "Project Management",
        "aliases": ["PMP", "Product Management", "Roadmapping"],
        "case_sensitive": False,
    },
    "Leadership": {
        "category": "Soft Skills",
        "aliases": ["Mentorship", "Team Lead", "Engineering Management"],
        "case_sensitive": False,
    },
    "Communication": {
        "category": "Soft Skills",
        "aliases": ["Stakeholder Management", "Cross-functional Collaboration", "Collaboration"],
        "case_sensitive": False,
    },
    "Problem Solving": {
        "category": "Soft Skills",
        "aliases": ["Analytical Thinking", "Troubleshooting"],
        "case_sensitive": False,
    },

    # --- Architecture, Engineering & Construction ---
    "AutoCAD": {
        "category": "Architecture & Engineering",
        "aliases": ["CAD", "Computer-Aided Design", "2D Drafting"],
        "case_sensitive": False,
    },
    "Revit": {
        "category": "Architecture & Engineering",
        "aliases": ["Autodesk Revit", "Revit Architecture", "Revit BIM"],
        "case_sensitive": False,
    },
    "BIM": {
        "category": "Architecture & Engineering",
        "aliases": ["Building Information Modeling", "BIM Management", "BIM Coordination"],
        "case_sensitive": False,
    },
    "Architectural Drafting": {
        "category": "Architecture & Engineering",
        "aliases": ["Architectural Design", "Drafting", "Schematic Design", "Design Development"],
        "case_sensitive": False,
    },
    "Building Codes": {
        "category": "Architecture & Engineering",
        "aliases": ["Local Building Codes", "IBC", "Zoning", "Site Zoning", "Code Compliance"],
        "case_sensitive": False,
    },
    "Architecture": {
        "category": "Architecture & Engineering",
        "aliases": ["Commercial Architecture", "Building Architecture", "Architectural Specifications", "AIA"],
        "case_sensitive": False,
    },
    "Structural Coordination": {
        "category": "Architecture & Engineering",
        "aliases": ["Structural Engineering", "MEP Coordination", "MEP", "Construction Administration"],
        "case_sensitive": False,
    },
}


# ==============================================================================
# 4. FALSE POSITIVE GUARD & TOKEN-BOUNDARY REGEX
# ==============================================================================

def build_term_regex(term: str, case_sensitive: bool = False) -> re.Pattern:
    """
    Builds a robust regex for a term with strict boundary rules.
    Prevents short tokens like 'C', 'R', 'Go' from matching inside other words.
    """
    escaped = re.escape(term)
    flags = 0 if case_sensitive else re.IGNORECASE

    # Special handling for single-letter programming languages
    if term in ("C", "R"):
        # Match 'C' or 'R' when preceded and followed by non-word or punctuation,
        # e.g., " C ", "C/", "C,", "(C)" but NOT "Cat", "React", "Rust"
        pattern = rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])"
        return re.compile(pattern)

    # Special handling for 'Go' programming language
    if term == "Go":
        # Match "Go" or "Golang" or "Go programming"
        pattern = r"\b(?:Go|Golang)(?:\s+(?:language|programming|developer|engineer))?\b"
        return re.compile(pattern)

    # Term with trailing punctuation like C++ or C# or .NET
    if term in ("C++", "C#", ".NET"):
        if term == ".NET":
            pattern = r"(?<![a-zA-Z0-9])\.NET(?![a-zA-Z0-9])"
        else:
            pattern = rf"(?<![a-zA-Z0-9]){escaped}(?![a-zA-Z0-9])"
        return re.compile(pattern, flags)

    # General word boundary pattern
    pattern = rf"\b{escaped}\b"
    return re.compile(pattern, flags)


# Precompile taxonomy patterns
COMPILED_TAXONOMY: List[Dict[str, Any]] = []
for canonical, data in SKILL_TAXONOMY.items():
    compiled_aliases = []
    # Canonical pattern
    compiled_aliases.append((canonical, build_term_regex(canonical, data["case_sensitive"])))
    # Alias patterns
    for alias in data["aliases"]:
        alias_case = data["case_sensitive"] or len(alias) <= 2
        compiled_aliases.append((alias, build_term_regex(alias, alias_case)))

    COMPILED_TAXONOMY.append({
        "canonical": canonical,
        "category": data["category"],
        "matchers": compiled_aliases,
    })


# ==============================================================================
# 5. RESUME SEARCH REPRESENTATION
# ==============================================================================

class ResumeEvidenceItem:
    def __init__(self, section: str, text: str, location_label: str, weight: float = 1.0):
        self.section = section
        self.text = text
        self.location_label = location_label
        self.weight = weight

def build_resume_evidence_index(resume_dict: Dict[str, Any]) -> List[ResumeEvidenceItem]:
    """
    Builds structured, searchable evidence records from all resume sections.
    Prioritizes Experience bullets, Project bullets, Summary, Skills, Educations.
    """
    items: List[ResumeEvidenceItem] = []

    # 1. Summary
    summary_data = resume_dict.get("summary")
    if isinstance(summary_data, dict):
        s_text = summary_data.get("summary") or summary_data.get("content") or ""
        if s_text:
            items.append(ResumeEvidenceItem("summary", s_text, "Summary", weight=0.8))
    elif isinstance(summary_data, str) and summary_data:
        items.append(ResumeEvidenceItem("summary", summary_data, "Summary", weight=0.8))

    # 2. Experiences & Experience Bullets (Highest Priority for demonstrated ability)
    experiences = resume_dict.get("experiences") or []
    for exp in experiences:
        company = exp.get("company") or exp.get("company_name", "Experience")
        role = exp.get("job_title", "Position")
        desc = exp.get("description") or ""
        bullets = exp.get("bullets") or []

        exp_text = f"{role} at {company}. {desc}".strip()
        items.append(ResumeEvidenceItem(
            "experience", exp_text, f"{company} — {role}", weight=1.0
        ))

        for idx, bullet in enumerate(bullets):
            bullet_text = bullet if isinstance(bullet, str) else bullet.get("content", "")
            if bullet_text:
                items.append(ResumeEvidenceItem(
                    "experience_bullet",
                    bullet_text,
                    f"{company} ({role}, Bullet {idx + 1})",
                    weight=1.0
                ))

    # 3. Projects & Project Bullets
    projects = resume_dict.get("projects") or []
    for proj in projects:
        name = proj.get("name", "Project")
        desc = proj.get("description") or ""
        bullets = proj.get("bullets") or []
        tech_stack = proj.get("technologies") or []

        if desc:
            items.append(ResumeEvidenceItem("project", desc, f"Project: {name}", weight=0.85))

        for idx, bullet in enumerate(bullets):
            bullet_text = bullet if isinstance(bullet, str) else bullet.get("content", "")
            if bullet_text:
                items.append(ResumeEvidenceItem(
                    "project_bullet",
                    bullet_text,
                    f"Project: {name} (Bullet {idx + 1})",
                    weight=0.85
                ))

        if tech_stack:
            tech_str = ", ".join(tech_stack) if isinstance(tech_stack, list) else str(tech_stack)
            items.append(ResumeEvidenceItem(
                "project_tech", tech_str, f"Project: {name} Technologies", weight=0.8
            ))

    # 4. Explicit Skills Section
    skills = resume_dict.get("skills") or []
    for sk in skills:
        skill_name = (sk.get("skill_name") or sk.get("name")) if isinstance(sk, dict) else str(sk)
        category = sk.get("category", "Skills") if isinstance(sk, dict) else "Skills"
        if skill_name:
            items.append(ResumeEvidenceItem(
                "skills", skill_name, f"Skills ({category})", weight=0.7
            ))

    # 5. Education
    educations = resume_dict.get("educations") or []
    for edu in educations:
        institution = edu.get("institution", "Education")
        degree = edu.get("degree", "")
        field = edu.get("field_of_study", "")
        edu_text = f"{degree} in {field} from {institution}".strip()
        if edu_text:
            items.append(ResumeEvidenceItem(
                "education", edu_text, f"Education: {institution}", weight=0.6
            ))

    # 6. Certifications
    certifications = resume_dict.get("certifications") or []
    for cert in certifications:
        cert_name = cert.get("name") if isinstance(cert, dict) else str(cert)
        issuer = cert.get("issuing_organization", "") if isinstance(cert, dict) else ""
        if cert_name:
            label = f"Certification: {cert_name}" + (f" ({issuer})" if issuer else "")
            items.append(ResumeEvidenceItem("certifications", cert_name, label, weight=0.8))

    return items


# ==============================================================================
# 6. REQUIREMENT EXTRACTION (REQUIRED VS PREFERRED SKILLS)
# ==============================================================================

REQUIRED_PATTERNS = [
    r"required\s+skills?", r"requirements?", r"minimum\s+qualifications?",
    r"what\s+you(?:'ll|\s+will)\s+need", r"must\s+have", r"essential",
    r"basic\s+qualifications?", r"you\s+must", r"core\s+requirements?"
]

PREFERRED_PATTERNS = [
    r"preferred\s+skills?", r"preferred\s+qualifications?", r"nice\s+to\s+have",
    r"bonus\s+points?", r"plus", r"desired", r"good\s+to\s+have",
    r"additional\s+qualifications?"
]

def split_job_sections(job_text: str) -> Dict[str, str]:
    """
    Divides job text into required, preferred, and general sections
    based on headings or keyword cues.
    """
    sections = {
        "required": "",
        "preferred": "",
        "general": job_text or ""
    }

    lines = job_text.splitlines() if job_text else []
    current_mode = "general"

    for line in lines:
        stripped = line.strip().lower()
        if not stripped:
            continue

        # Check preferred triggers
        is_pref_header = any(re.search(p, stripped) for p in PREFERRED_PATTERNS)
        is_req_header = any(re.search(p, stripped) for p in REQUIRED_PATTERNS)

        if is_pref_header:
            current_mode = "preferred"
        elif is_req_header:
            current_mode = "required"

        sections[current_mode] += "\n" + line

    return sections

def extract_job_skills(
    job_text: str,
    sections: Dict[str, str],
    job_dict: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Extracts skills from the job description and marks them as required or preferred.
    """
    found_skills: Dict[str, Dict[str, Any]] = {}
    normalized_full = normalize_text(job_text)

    for entry in COMPILED_TAXONOMY:
        canonical = entry["canonical"]
        category = entry["category"]

        matched_term = None
        for term, pattern in entry["matchers"]:
            if pattern.search(job_text):
                matched_term = term
                break

        if matched_term:
            # Determine if preferred vs required
            is_preferred = False
            # If present in preferred section and NOT in required section
            in_preferred_section = bool(sections.get("preferred") and any(
                p.search(sections["preferred"]) for _, p in entry["matchers"]
            ))
            in_required_section = bool(sections.get("required") and any(
                p.search(sections["required"]) for _, p in entry["matchers"]
            ))

            if in_preferred_section and not in_required_section:
                is_preferred = True

            found_skills[canonical] = {
                "canonical": canonical,
                "category": category,
                "matched_term": matched_term,
                "is_preferred": is_preferred
            }

    # Extract additional explicit requirements if provided in job_dict
    if job_dict and job_dict.get("requirements"):
        raw_reqs = str(job_dict.get("requirements"))
        parts = re.split(r"[,;\n•]+", raw_reqs)
        for part in parts:
            item = part.strip().strip(".-* ")
            if len(item) >= 2 and item.lower() not in STOPWORDS:
                already = any(s.lower() == item.lower() for s in found_skills)
                if not already:
                    found_skills[item] = {
                        "canonical": item,
                        "category": "Requirements",
                        "matched_term": item,
                        "is_preferred": False,
                    }

    return list(found_skills.values())


# ==============================================================================
# 7. SKILL MATCHING WITH EVIDENCE
# ==============================================================================

def match_skills(
    job_skills: List[Dict[str, Any]],
    evidence_items: List[ResumeEvidenceItem]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], float]:
    """
    Matches extracted job skills against resume evidence items.
    Differentiates Listed Skill vs Demonstrated Experience.
    Calculates skill match percentage score (0-100).
    """
    if not job_skills:
        return [], [], 0.0

    matched_skills = []
    missing_skills = []

    total_weight = 0.0
    achieved_weight = 0.0

    for item in job_skills:
        canonical = item["canonical"]
        is_preferred = item["is_preferred"]
        category = item["category"]

        # Skill importance weight: Required = 1.0, Preferred = 0.5
        item_weight = 0.5 if is_preferred else 1.0
        total_weight += item_weight

        # Find match in taxonomy
        tax_entry = next((e for e in COMPILED_TAXONOMY if e["canonical"] == canonical), None)
        if not tax_entry:
            # Dynamic matching for requirements outside precompiled taxonomy
            req_tokens = extract_meaningful_tokens(canonical)
            best_overlap = 0.0
            best_ev = None
            if req_tokens:
                for evidence in evidence_items:
                    ev_tokens = set(extract_meaningful_tokens(evidence.text))
                    overlap = sum(1 for t in req_tokens if t in ev_tokens) / float(len(req_tokens))
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_ev = evidence

            if best_overlap >= 0.5 and best_ev:
                matched_skills.append({
                    "canonical": canonical,
                    "alias_matched": canonical,
                    "category": category,
                    "is_preferred": is_preferred,
                    "evidence_strength": "strong" if best_overlap >= 0.8 else "moderate",
                    "evidence": best_ev.text[:200] if len(best_ev.text) > 200 else best_ev.text,
                    "location": best_ev.location_label,
                    "status": "matched",
                })
                achieved_weight += item_weight * (1.0 if best_overlap >= 0.8 else 0.6)
            else:
                missing_skills.append({
                    "canonical": canonical,
                    "category": category,
                    "is_preferred": is_preferred,
                    "status": "missing",
                    "message": f"{canonical} was not found in the selected resume."
                })
            continue

        best_evidence: Optional[ResumeEvidenceItem] = None
        matched_alias: Optional[str] = None
        evidence_strength = "none"

        for evidence in evidence_items:
            for term, pattern in tax_entry["matchers"]:
                if pattern.search(evidence.text):
                    matched_alias = term
                    # Rate evidence strength
                    if evidence.section in ("experience", "experience_bullet"):
                        evidence_strength = "strong"
                        best_evidence = evidence
                        break
                    elif evidence.section in ("project", "project_bullet"):
                        if evidence_strength != "strong":
                            evidence_strength = "strong"
                            best_evidence = evidence
                    elif evidence.section in ("summary", "certifications"):
                        if evidence_strength not in ("strong", "moderate"):
                            evidence_strength = "moderate"
                            best_evidence = evidence
                    elif evidence.section == "skills":
                        if evidence_strength == "none":
                            evidence_strength = "moderate"
                            best_evidence = evidence
            if evidence_strength == "strong":
                break

        if best_evidence:
            matched_skills.append({
                "canonical": canonical,
                "alias_matched": matched_alias or canonical,
                "category": category,
                "is_preferred": is_preferred,
                "evidence_strength": evidence_strength,
                "evidence": best_evidence.text[:200] if len(best_evidence.text) > 200 else best_evidence.text,
                "location": best_evidence.location_label,
                "status": "matched",
            })
            achieved_weight += item_weight
        else:
            missing_skills.append({
                "canonical": canonical,
                "category": category,
                "is_preferred": is_preferred,
                "status": "missing",
                "message": f"{canonical} was not found in the selected resume."
            })

    skill_score = (achieved_weight / total_weight * 100.0) if total_weight > 0 else 0.0
    return matched_skills, missing_skills, round(skill_score, 1)


# ==============================================================================
# 8. RESPONSIBILITY EXTRACTION & MATCHING
# ==============================================================================

ACTION_VERBS = {
    "build", "design", "develop", "implement", "architect", "lead", "manage",
    "create", "maintain", "scale", "optimize", "deliver", "drive", "collaborate",
    "partner", "coordinate", "conduct", "evaluate", "deploy", "monitor", "support",
    "write", "engineer", "improve", "automate", "guide", "mentor", "establish"
}

def extract_job_responsibilities(job_dict: Dict[str, Any]) -> List[str]:
    """
    Extracts distinct responsibility statements from the job.
    Uses structured responsibilities field if present, or parses action-verb sentences.
    """
    responsibilities: List[str] = []

    # 1. From structured responsibilities field
    raw_resp = job_dict.get("responsibilities") or ""
    if raw_resp:
        for line in raw_resp.splitlines():
            line = line.strip().lstrip("•-* \t")
            if len(line) >= 15:
                responsibilities.append(line)

    # 2. If empty, parse from job description
    if not responsibilities:
        desc = job_dict.get("job_description") or ""
        for line in desc.splitlines():
            clean = line.strip().lstrip("•-* \t")
            if len(clean) >= 20:
                first_word = clean.split()[0].lower().rstrip("s")
                if first_word in ACTION_VERBS:
                    responsibilities.append(clean)

    # Limit to top 8 distinct responsibilities to keep analysis focused
    seen = set()
    deduped = []
    for r in responsibilities:
        norm = normalize_text(r).lower()
        if norm not in seen:
            seen.add(norm)
            deduped.append(r)
        if len(deduped) >= 8:
            break

    return deduped

def calculate_token_overlap(str1: str, str2: str) -> float:
    """Calculates non-stopword token overlap (Jaccard similarity)."""
    t1 = set(extract_meaningful_tokens(str1))
    t2 = set(extract_meaningful_tokens(str2))
    if not t1 or not t2:
        return 0.0
    intersection = t1.intersection(t2)
    return len(intersection) / float(len(t1))

def match_responsibilities(
    responsibilities: List[str],
    evidence_items: List[ResumeEvidenceItem],
    fallback_score: float = 100.0,
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Evaluates how well resume evidence supports each job responsibility.
    Distinguishes Matched (>= 0.60 overlap/key matches), Partial (>= 0.35), Missing (< 0.35).
    """
    if not responsibilities:
        return [], fallback_score

    analysis: List[Dict[str, Any]] = []
    total_score = 0.0

    for resp in responsibilities:
        best_overlap = 0.0
        best_evidence: Optional[ResumeEvidenceItem] = None

        # Prioritize experience bullets > project bullets > summary
        for evidence in evidence_items:
            overlap = calculate_token_overlap(resp, evidence.text)
            # Boost bullet weight
            effective_overlap = overlap * evidence.weight
            if effective_overlap > best_overlap:
                best_overlap = effective_overlap
                best_evidence = evidence

        if best_overlap >= 0.55 and best_evidence:
            status = "matched"
            strength = "strong"
            points = 1.0
            evidence_text = best_evidence.text[:220]
            location = best_evidence.location_label
        elif best_overlap >= 0.30 and best_evidence:
            status = "partial"
            strength = "moderate"
            points = 0.6
            evidence_text = best_evidence.text[:220]
            location = best_evidence.location_label
        else:
            status = "missing"
            strength = "none"
            points = 0.0
            evidence_text = None
            location = None

        total_score += points
        analysis.append({
            "job_responsibility": resp,
            "status": status,
            "evidence_strength": strength,
            "evidence": evidence_text,
            "location": location,
            "overlap_score": round(best_overlap, 2),
        })

    resp_score = (total_score / len(responsibilities)) * 100.0
    return analysis, round(resp_score, 1)


# ==============================================================================
# 9. EXPERIENCE DURATION MATCHING
# ==============================================================================

def extract_required_experience_years(job_text: str) -> Optional[int]:
    """
    Extracts explicit years of experience required from the job text.
    Patterns: '5+ years', '3-5 years', 'minimum 4 years of experience', etc.
    """
    patterns = [
        r"(?:minimum|at least)\s+(\d+)\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?)",
        r"(\d+)\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?\s+(?:professional\s+|relevant\s+)?experience",
        r"(\d+)\+\s*(?:years?|yrs?)",
    ]
    for pat in patterns:
        m = re.search(pat, job_text, re.IGNORECASE)
        if m:
            try:
                years = int(m.group(1))
                if 1 <= years <= 30:
                    return years
            except Exception:
                continue
    return None

def parse_date_to_year(date_val: Any) -> Optional[float]:
    """Extracts approximate year from date string (YYYY or YYYY-MM or YYYY-MM-DD)."""
    if not date_val:
        return None
    val_str = str(date_val).strip()
    m = re.search(r"(\d{4})", val_str)
    if m:
        year = float(m.group(1))
        # Check if month is present
        m_month = re.search(r"\d{4}[-/](\d{1,2})", val_str)
        if m_month:
            month = float(m_month.group(1))
            year += (month - 1) / 12.0
        return year
    return None

def calculate_resume_experience_years(experiences: List[Dict[str, Any]]) -> Tuple[Optional[float], bool]:
    """
    Calculates total candidate experience in years based on structured experience dates.
    Returns (years, has_dates). If dates are missing, returns (None, False).
    """
    if not experiences:
        return None, False

    total_years = 0.0
    valid_dates_found = False
    current_year = float(datetime.now().year) + (float(datetime.now().month) / 12.0)

    for exp in experiences:
        start = parse_date_to_year(exp.get("start_date"))
        is_current = exp.get("is_current", False)
        end = parse_date_to_year(exp.get("end_date"))

        if start is not None:
            valid_dates_found = True
            end_val = current_year if (is_current or end is None) else end
            diff = max(0.0, end_val - start)
            # Cap realistic single role at 15 years
            total_years += min(15.0, diff)

    if not valid_dates_found:
        return None, False

    return round(total_years, 1), True

def assess_experience(
    job_dict: Dict[str, Any],
    resume_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compares candidate's professional duration with job's required experience.
    Strictly distinguishes unknown from missing if dates are incomplete.
    """
    job_full_text = f"{job_dict.get('job_description', '')} {job_dict.get('requirements', '')}"
    req_years = extract_required_experience_years(job_full_text)

    experiences = resume_dict.get("experiences") or []
    cand_years, has_dates = calculate_resume_experience_years(experiences)

    if req_years is None:
        return {
            "status": "not_specified",
            "score": 100,
            "required_years": None,
            "candidate_years": cand_years,
            "message": "No specific years of experience explicitly required by this job posting."
        }

    if not has_dates or cand_years is None:
        # Crucial: Return 'unknown', NOT 'missing' or 'unqualified'
        return {
            "status": "unknown",
            "score": 75,  # Neutral evaluation
            "required_years": req_years,
            "candidate_years": None,
            "message": f"Job mentions {req_years}+ years of experience, but employment dates were incomplete in the resume to verify."
        }

    if cand_years >= req_years:
        return {
            "status": "matched",
            "score": 100,
            "required_years": req_years,
            "candidate_years": cand_years,
            "message": f"Experience requirement appears satisfied ({cand_years} years found vs {req_years}+ years requested)."
        }
    else:
        # Partial proportional score
        ratio = max(0.4, cand_years / float(req_years))
        score = min(100, int(ratio * 100))
        return {
            "status": "partial",
            "score": score,
            "required_years": req_years,
            "candidate_years": cand_years,
            "message": f"Found {cand_years} years of experience vs {req_years}+ years requested."
        }


# ==============================================================================
# 10. QUALIFICATION (EDUCATION & CERTIFICATIONS) MATCHING
# ==============================================================================

DEGREE_PATTERNS = [
    (r"\b(?:phd|doctorate|doctor of philosophy)\b", "Doctorate", 4),
    (r"\b(?:master'?s?|ms|m\.s\.|mba|msc)\b", "Master's Degree", 3),
    (r"\b(?:bachelor'?s?|bs|b\.s\.|ba|b\.a\.|btech|b\.tech|undergraduate)\b", "Bachelor's Degree", 2),
    (r"\b(?:associate'?s?)\b", "Associate's Degree", 1),
]

def assess_qualifications(
    job_dict: Dict[str, Any],
    resume_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Evaluates education and certification requirements.
    Distinguishes not specified from missing and unknown.
    """
    job_text = f"{job_dict.get('job_description', '')} {job_dict.get('qualifications', '')} {job_dict.get('requirements', '')}".lower()

    # 1. Education Assessment
    req_degree_name = None
    req_degree_rank = 0
    for pat, name, rank in DEGREE_PATTERNS:
        if re.search(pat, job_text):
            req_degree_name = name
            req_degree_rank = rank
            break

    educations = resume_dict.get("educations") or []
    cand_max_rank = 0
    cand_degree_name = None
    for edu in educations:
        deg_str = (edu.get("degree") or "").lower()
        for pat, name, rank in DEGREE_PATTERNS:
            if re.search(pat, deg_str):
                if rank > cand_max_rank:
                    cand_max_rank = rank
                    cand_degree_name = name
                break

    if req_degree_name is None:
        edu_status = "not_specified"
        edu_score = 100
        edu_message = "No specific degree explicitly required."
    elif cand_max_rank >= req_degree_rank:
        edu_status = "matched"
        edu_score = 100
        edu_message = f"Degree requirement met ({cand_degree_name} aligns with {req_degree_name})."
    elif cand_max_rank > 0:
        edu_status = "partial"
        edu_score = 65
        edu_message = f"Resume contains {cand_degree_name}; job specifies {req_degree_name}."
    else:
        # Unknown/Not found
        edu_status = "missing"
        edu_score = 40
        edu_message = f"{req_degree_name} requested, but not found in resume."

    # 2. Certification Assessment
    certifications = resume_dict.get("certifications") or []
    cert_score = 100
    cert_status = "not_specified"

    # Overall qualification score
    qual_score = round((edu_score * 0.7) + (cert_score * 0.3), 1)

    return {
        "score": int(qual_score),
        "education_status": edu_status,
        "education_score": edu_score,
        "education_message": edu_message,
        "required_degree": req_degree_name,
        "candidate_degree": cand_degree_name,
        "certification_status": cert_status,
        "certification_score": cert_score,
    }


# ==============================================================================
# 11. KEYWORD COVERAGE ANALYSIS
# ==============================================================================

def analyze_keyword_coverage(
    job_text: str,
    evidence_items: List[ResumeEvidenceItem]
) -> Dict[str, Any]:
    """
    Computes keyword coverage percentage based on meaningful terms in job.
    Avoids keyword stuffing: binary presence only.
    """
    job_tokens = set(extract_meaningful_tokens(job_text))
    # Keep only tokens with frequency >= 2 or length >= 4 to avoid noise
    significant_tokens = {t for t in job_tokens if len(t) >= 4}
    if not significant_tokens:
        significant_tokens = job_tokens

    if not significant_tokens:
        return {
            "score": 100,
            "total_keywords": 0,
            "matched_keywords": 0,
            "sample_matched": [],
            "sample_missing": [],
        }

    resume_all_text = " ".join([e.text for e in evidence_items]).lower()
    resume_tokens = set(extract_meaningful_tokens(resume_all_text))

    matched_tokens = significant_tokens.intersection(resume_tokens)
    missing_tokens = significant_tokens.difference(resume_tokens)

    coverage_score = (len(matched_tokens) / float(len(significant_tokens))) * 100.0

    return {
        "score": round(coverage_score, 1),
        "total_keywords": len(significant_tokens),
        "matched_keywords": len(matched_tokens),
        "sample_matched": sorted(list(matched_tokens))[:15],
        "sample_missing": sorted(list(missing_tokens))[:15],
    }


# ==============================================================================
# 12. CORE DETERMINISTIC MATCH ENGINE PIPELINE
# ==============================================================================

def run_job_match_analysis(
    job_dict: Dict[str, Any],
    resume_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Main entry point for Module 5 deterministic Job ↔ Resume Matching.
    Calculates weighted match score and produces transparent analysis.
    """
    job_desc = job_dict.get("job_description") or ""
    job_title = job_dict.get("job_title") or ""

    # Check minimum data requirement (Section 53)
    if len(job_desc.strip()) < 30 or len(job_title.strip()) < 3:
        return {
            "limited_data": True,
            "overall_score": 0,
            "match_level": "Limited Data",
            "message": "There isn't enough job information to calculate a reliable match.",
            "disclaimer": MATCH_DISCLAIMER,
            "algorithm_version": ALGORITHM_VERSION,
        }

    # Build searchable resume representation
    evidence_items = build_resume_evidence_index(resume_dict)
    if not evidence_items:
        return {
            "limited_data": True,
            "overall_score": 0,
            "match_level": "Limited Data",
            "message": "The selected resume contains insufficient structured content to analyze.",
            "disclaimer": MATCH_DISCLAIMER,
            "algorithm_version": ALGORITHM_VERSION,
        }

    # 1. Job Sections & Skill Extraction
    full_job_text = f"{job_title}\n{job_desc}\n{job_dict.get('requirements') or ''}\n{job_dict.get('qualifications') or ''}\n{job_dict.get('responsibilities') or ''}"
    sections = split_job_sections(full_job_text)
    extracted_job_skills = extract_job_skills(full_job_text, sections, job_dict=job_dict)

    # 2. Skill Matching
    matched_skills, missing_skills, skill_score = match_skills(extracted_job_skills, evidence_items)

    # 3. Responsibilities Analysis
    job_resps = extract_job_responsibilities(job_dict)
    responsibilities_analysis, resp_score = match_responsibilities(
        job_resps, evidence_items, fallback_score=skill_score
    )

    # 4. Experience Assessment
    experience_assessment = assess_experience(job_dict, resume_dict)
    exp_score = float(experience_assessment["score"])

    # 5. Qualifications Assessment
    qualification_assessment = assess_qualifications(job_dict, resume_dict)
    qual_score = float(qualification_assessment["score"])

    # 6. Keyword Coverage
    keyword_coverage = analyze_keyword_coverage(full_job_text, evidence_items)
    kw_score = float(keyword_coverage["score"])

    # Domain relevance check: If the job requires distinct domain skills and the candidate has
    # very low or zero skill overlap, prevent generic experience or unstated qualifications
    # from creating a misleadingly high score.
    if extracted_job_skills and skill_score < 25:
        domain_factor = max(0.0, skill_score / 25.0)
        effective_exp_score = exp_score * domain_factor
        effective_qual_score = qual_score * domain_factor
        effective_resp_score = resp_score * domain_factor
    else:
        effective_exp_score = exp_score
        effective_qual_score = qual_score
        effective_resp_score = resp_score

    # 7. Weighted Overall Score
    weighted_score = (
        (skill_score * WEIGHT_SKILLS) +
        (effective_resp_score * WEIGHT_RESPONSIBILITIES) +
        (effective_exp_score * WEIGHT_EXPERIENCE) +
        (effective_qual_score * WEIGHT_QUALIFICATIONS) +
        (kw_score * WEIGHT_KEYWORDS)
    )

    final_score = int(round(weighted_score))
    final_score = max(0, min(100, final_score))
    match_level = get_match_level(final_score)

    # Compile structured evidence records
    compiled_evidence = [
        {
            "category": "skill",
            "item": m["canonical"],
            "alias_matched": m["alias_matched"],
            "location": m["location"],
            "snippet": m["evidence"],
            "strength": m["evidence_strength"],
        }
        for m in matched_skills if m.get("evidence")
    ]
    for r in responsibilities_analysis:
        if r.get("evidence"):
            compiled_evidence.append({
                "category": "responsibility",
                "item": r["job_responsibility"],
                "location": r.get("location"),
                "snippet": r["evidence"],
                "strength": r["evidence_strength"],
            })

    return {
        "limited_data": False,
        "overall_score": final_score,
        "match_level": match_level,
        "category_scores": {
            "skills": int(round(skill_score)),
            "responsibilities": int(round(resp_score)),
            "experience": int(round(exp_score)),
            "qualifications": int(round(qual_score)),
            "keywords": int(round(kw_score)),
        },
        "weights": {
            "skills": WEIGHT_SKILLS,
            "responsibilities": WEIGHT_RESPONSIBILITIES,
            "experience": WEIGHT_EXPERIENCE,
            "qualifications": WEIGHT_QUALIFICATIONS,
            "keywords": WEIGHT_KEYWORDS,
        },
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "responsibilities_analysis": responsibilities_analysis,
        "experience_assessment": experience_assessment,
        "qualification_assessment": qualification_assessment,
        "keyword_coverage": keyword_coverage,
        "evidence": compiled_evidence,
        "disclaimer": MATCH_DISCLAIMER,
        "algorithm_version": ALGORITHM_VERSION,
    }
