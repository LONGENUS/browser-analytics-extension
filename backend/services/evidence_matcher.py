"""
TailorResume — Evidence-Based Context Matching Engine (Module 5 Extension)
Maps job requirements against the parsed master resume using semantic and taxonomy-aware evidence analysis.

Classifies every job requirement into one of four evidence tiers:
1. 'strongly_supported': Direct evidence in master resume (e.g. explicitly used tool in relevant role)
2. 'partially_supported': Transferable experience (e.g. equivalent/related paradigm or technology)
3. 'related_unsupported': Related conceptual background but lacking direct proof
4. 'unsupported_gap': Zero evidence in the master resume (flagged as genuine skill gap)

Guarantees:
- Zero fabrication of candidate capabilities.
- Prevents missing keywords from being flagged as missing skills when transferable evidence exists.
- Provides actionable tailoring recommendations for summary and experience bullet emphasis.
"""

from typing import Dict, Any, List, Optional, Set, Tuple

from services.matching_engine import (
    build_resume_evidence_index,
    calculate_token_overlap,
    extract_meaningful_tokens,
    COMPILED_TAXONOMY,
)


# Transferable / Related Technology Ecosystems
TRANSFERABLE_ECOSYSTEMS = {
    # Relational Databases
    "PostgreSQL": ["MySQL", "SQL Server", "Oracle", "SQLite", "Relational Databases", "SQL"],
    "MySQL": ["PostgreSQL", "SQL Server", "SQLite", "Relational Databases", "SQL"],
    "SQL Server": ["PostgreSQL", "MySQL", "Oracle", "SQL"],
    # Web Frameworks
    "FastAPI": ["Flask", "Django", "Tornado", "Express", "REST APIs"],
    "Django": ["Flask", "FastAPI", "Ruby on Rails", "Spring Boot", "MVC"],
    "React": ["Vue.js", "Angular", "Next.js", "Frontend", "JavaScript", "TypeScript"],
    "Next.js": ["React", "Vue.js", "Frontend Architecture", "SSR"],
    # Cloud & DevOps
    "AWS": ["GCP", "Google Cloud", "Azure", "Cloud Infrastructure"],
    "GCP": ["AWS", "Azure", "Google Cloud"],
    "Azure": ["AWS", "GCP"],
    "Kubernetes": ["Docker", "Containerization", "ECS", "Nomad"],
    "Docker": ["Containerization", "Kubernetes", "Podman"],
    # Message Queues
    "Kafka": ["RabbitMQ", "ActiveMQ", "SQS", "Redis Streams", "Pub/Sub"],
    "RabbitMQ": ["Kafka", "Celery", "SQS", "Message Queues"],
    # Languages
    "Python": ["Ruby", "Go", "Backend Scripting"],
    "TypeScript": ["JavaScript", "React", "Node.js"],
    "JavaScript": ["TypeScript", "Frontend"],
}


def _get_ev_text(ev: Any) -> str:
    if hasattr(ev, "text"):
        return ev.text or ""
    if isinstance(ev, dict):
        return ev.get("text", "")
    return str(ev)


def _get_ev_location(ev: Any) -> str:
    if hasattr(ev, "location_label"):
        return ev.location_label or ""
    if isinstance(ev, dict):
        return ev.get("location_label") or ev.get("location", "")
    return ""


def find_direct_and_transferable_evidence(
    requirement: str,
    evidence_items: List[Any],
) -> Tuple[str, List[Any], Optional[str]]:
    """
    Analyzes master resume evidence for a specific job requirement.
    Returns (classification, supporting_evidence_list, transferable_skill_name).
    """
    req_lower = requirement.lower().strip()
    direct_evidence = []
    transferable_evidence = []
    related_evidence = []

    # 1. Search for direct mention or canonical taxonomy match
    canonical_entry = None
    for entry in COMPILED_TAXONOMY:
        if entry["canonical"].lower() == req_lower:
            canonical_entry = entry
            break

    matchers = canonical_entry["matchers"] if canonical_entry else [(requirement, None)]

    for ev in evidence_items:
        text = _get_ev_text(ev)
        text_lower = text.lower()

        # Check direct matcher
        matched_direct = False
        if canonical_entry:
            for term, pat in matchers:
                if pat.search(text):
                    direct_evidence.append(ev)
                    matched_direct = True
                    break
        elif req_lower in text_lower:
            direct_evidence.append(ev)
            matched_direct = True

        if matched_direct:
            continue

        # 2. Check transferable ecosystem equivalents
        related_skills = TRANSFERABLE_ECOSYSTEMS.get(requirement, [])
        for rel in related_skills:
            if rel.lower() in text_lower:
                transferable_evidence.append((rel, ev))
                break

        # 3. Check token overlap for general responsibilities
        overlap = calculate_token_overlap(requirement, text)
        if overlap >= 0.35:
            related_evidence.append(ev)

    # Classify based on evidence strength
    if direct_evidence:
        return "strongly_supported", direct_evidence[:3], None

    if transferable_evidence:
        rel_skill, ev_item = transferable_evidence[0]
        return "partially_supported", [ev_item], rel_skill

    if related_evidence:
        return "related_unsupported", related_evidence[:2], None

    return "unsupported_gap", [], None


def build_evidence_match_report(
    job_profile: Dict[str, Any],
    source_resume: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Maps all job requirements, responsibilities, and qualifications against
    the master resume evidence index.
    """
    evidence_index = build_resume_evidence_index(source_resume)

    matched_requirements: List[Dict[str, Any]] = []
    strongly_supported_count = 0
    partially_supported_count = 0
    skill_gaps: List[str] = []

    # 1. Analyze Required Skills
    for skill in job_profile.get("required_skills", []):
        classification, evidence_list, rel_skill = find_direct_and_transferable_evidence(
            skill, evidence_index
        )
        if classification == "strongly_supported":
            strongly_supported_count += 1
            action = f"Prioritize direct achievements utilizing {skill}."
        elif classification == "partially_supported":
            partially_supported_count += 1
            action = f"Highlight transferable expertise in {rel_skill} as direct foundation for {skill}."
        elif classification == "related_unsupported":
            action = f"Frame relevant background toward {skill} without claiming unevidenced production use."
        else:
            skill_gaps.append(skill)
            action = f"Keep unevidenced skill {skill} strictly out of claimed experience; record as growth gap."

        matched_requirements.append({
            "requirement": skill,
            "type": "required_skill",
            "importance": "high",
            "classification": classification,
            "transferable_skill": rel_skill,
            "evidence_snippets": [_get_ev_text(e) for e in evidence_list],
            "evidence_locations": [_get_ev_location(e) for e in evidence_list],
            "tailoring_action": action,
        })

    # 2. Analyze Preferred Skills
    for skill in job_profile.get("preferred_skills", []):
        classification, evidence_list, rel_skill = find_direct_and_transferable_evidence(
            skill, evidence_index
        )
        if classification in ("strongly_supported", "partially_supported"):
            action = f"Emphasize secondary strength in {skill} for competitive advantage."
        else:
            action = f"Do not invent {skill}; candidate fulfills core requirements without it."

        matched_requirements.append({
            "requirement": skill,
            "type": "preferred_skill",
            "importance": "medium",
            "classification": classification,
            "transferable_skill": rel_skill,
            "evidence_snippets": [_get_ev_text(e) for e in evidence_list],
            "evidence_locations": [_get_ev_location(e) for e in evidence_list],
            "tailoring_action": action,
        })

    # 3. Analyze Key Responsibilities
    responsibility_alignments: List[Dict[str, Any]] = []
    for resp in job_profile.get("responsibilities", []):
        classification, evidence_list, _ = find_direct_and_transferable_evidence(
            resp, evidence_index
        )
        responsibility_alignments.append({
            "responsibility": resp,
            "classification": classification,
            "evidence_snippets": [_get_ev_text(e) for e in evidence_list],
            "evidence_locations": [_get_ev_location(e) for e in evidence_list],
        })

    # 4. Synthesize Strategic Alignment Summary
    domain = job_profile.get("domain", "General Engineering")
    seniority = job_profile.get("seniority_level", "Senior")

    recommended_focus = (
        f"Position candidate as a {seniority} {domain} specialist. "
        f"Directly align experience with {strongly_supported_count} strongly evidenced requirements. "
        f"Bridge {partially_supported_count} requirements via transferable skills. "
        f"Strictly preserve {len(skill_gaps)} identified skill gaps in missing qualifications."
    )

    return {
        "job_title": job_profile.get("job_title"),
        "company_name": job_profile.get("company_name"),
        "domain": domain,
        "seniority_level": seniority,
        "matched_requirements": matched_requirements,
        "responsibility_alignments": responsibility_alignments,
        "skill_gaps": skill_gaps,
        "strongly_supported_count": strongly_supported_count,
        "partially_supported_count": partially_supported_count,
        "recommended_strategic_focus": recommended_focus,
    }
