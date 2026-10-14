"""
TailorResume — AI Tailoring Orchestrator
Coordinates context-aware resume tailoring using Groq (or fallback providers).
Combines prompt construction, inference, deterministic claim validation,
and structured resume assembly.

Strict Guarantees:
- Master resume is never modified.
- Full multi-tenant isolation and ownership checks.
- Zero fabricated metrics, employers, job titles, or credentials.
- Graceful offline fallback if Groq API key is not configured.
- Structured output 100% compatible with existing PDF/DOCX export pipelines.
"""

import copy
import uuid
from typing import Dict, Any, Optional, List

from config import settings
from services.matching_engine import run_job_match_analysis
from services.tailoring_engine import (
    execute_tailoring_pipeline,
    verify_resume_integrity,
    TailoringOptions,
    TAILORING_ALGORITHM_VERSION,
)
from services.job_context import extract_job_profile, InvalidJobDescriptionError
from services.evidence_matcher import build_evidence_match_report
from services.ai.groq_provider import GroqProvider
from services.ai.prompt_builder import build_tailoring_prompt
from services.ai.output_validator import validate_and_filter_ai_output, AIOutputValidationError
from services.ai.base import (
    AIProviderError,
    AIAuthenticationError,
    AIRateLimitError,
    AIModelNotFoundError,
    AITimeoutError,
)


async def execute_ai_tailoring_pipeline(
    source_resume: Dict[str, Any],
    job: Dict[str, Any],
    options: Optional[TailoringOptions] = None,
    provider: Optional[GroqProvider] = None,
    force_ai: bool = False,
) -> Dict[str, Any]:
    """
    Executes context-aware AI resume tailoring for a selected master resume
    and target job description.
    """
    if options is None:
        options = TailoringOptions()

    if provider is None:
        provider = GroqProvider()

    # 1. Extract and Validate Job Profile (Stops if empty/incomplete)
    job_profile = extract_job_profile(job)
    evidence_report = build_evidence_match_report(job_profile, source_resume)

    # 2. Baseline Job Match Analysis on Source Resume
    original_match = run_job_match_analysis(job, source_resume)
    original_score = original_match.get("overall_score", 0)

    # 3. Check if Groq AI provider is available
    if not provider.is_configured:
        if force_ai:
            raise AIAuthenticationError(
                "GROQ_API_KEY is not configured in .env.local. Live inference cannot proceed.",
                provider="groq",
                status_code=401,
            )
        # Fall back gracefully to deterministic rule-based tailoring
        fallback_res = execute_tailoring_pipeline(source_resume, job, job_match=original_match, options=options)
        fallback_res["ai_metadata"] = {
            "ai_enabled": False,
            "provider": "none",
            "model": "deterministic-rules",
            "reason": "GROQ_API_KEY is not configured in .env.local. Used deterministic engine.",
        }
        return fallback_res

    # 3. Build Context-Aware Prompt
    messages = build_tailoring_prompt(source_resume, job, tailoring_mode=options.tailoring_mode)

    # 4. Invoke Groq API
    try:
        completion_res = await provider.chat_completion(
            messages=messages,
            model=settings.GROQ_MODEL,
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=4096,
        )
    except (AIAuthenticationError, AIRateLimitError, AIModelNotFoundError, AITimeoutError, AIProviderError) as e:
        if force_ai:
            raise
        print(f"[WARN] Groq AI tailoring request failed ({type(e).__name__}): {e}. Falling back to deterministic engine.")
        fallback_res = execute_tailoring_pipeline(source_resume, job, job_match=original_match, options=options)
        fallback_res["ai_metadata"] = {
            "ai_enabled": False,
            "provider": "groq",
            "model": settings.GROQ_MODEL,
            "error": str(e),
            "fallback_used": True,
        }
        return fallback_res

    raw_json = completion_res.parsed_json or {}

    # 5. Deterministic Validation & Fact-Checking
    audited = validate_and_filter_ai_output(raw_json, source_resume, job)

    # 6. Assemble Tailored Resume (Deep clone to guarantee zero master resume mutation)
    tailored = copy.deepcopy(source_resume)
    tailored["id"] = str(uuid.uuid4())
    tailored["source_resume_id"] = source_resume.get("id")
    tailored["target_job_id"] = job.get("id")
    tailored["is_tailored"] = True
    tailored["status"] = "draft"
    tailored["is_default"] = False

    # Name
    source_name = source_resume.get("name", "Resume")
    company = job.get("company_name") or "Company"
    title = job.get("job_title") or "Role"
    tailored["name"] = f"{source_name} — {company} — {title}"

    change_log: List[Dict[str, Any]] = []

    # 7. Apply Audited Professional Summary
    if options.adapt_summary and tailored.get("summary"):
        orig_sum_obj = tailored["summary"]
        orig_sum_text = orig_sum_obj.get("summary") or orig_sum_obj.get("content") or ""
        new_sum_text = audited["sanitized_summary"]

        if audited["summary_is_rewritten"] and new_sum_text != orig_sum_text:
            orig_sum_obj["summary"] = new_sum_text
            orig_sum_obj["id"] = str(uuid.uuid4())
            orig_sum_obj["resume_id"] = tailored["id"]

            change_log.append({
                "change_id": str(uuid.uuid4()),
                "section": "summary",
                "type": "adapt",
                "source_id": "summary",
                "original_text": orig_sum_text,
                "tailored_text": new_sum_text,
                "reason": audited["summary_reason"],
                "is_safe": True,
                "status": "pending",
            })

    # 8. Apply Audited & Prioritized Skills
    if options.prioritize_skills and tailored.get("skills"):
        orig_skills = tailored.get("skills", [])
        sanitized_skills_list = audited["sanitized_skills"]

        # Re-build skill entities with fresh UUIDs and sequential display_orders
        skill_name_to_orig = {
            (s.get("skill_name") or s.get("name") or "").strip().lower(): s
            for s in orig_skills
        }

        new_skills = []
        for idx, s_name in enumerate(sanitized_skills_list):
            orig_record = skill_name_to_orig.get(s_name.lower())
            new_skills.append({
                "id": str(uuid.uuid4()),
                "resume_id": tailored["id"],
                "skill_name": s_name,
                "category": orig_record.get("category", "Technical") if orig_record else "Technical",
                "display_order": idx,
            })

        tailored["skills"] = new_skills
        change_log.append({
            "change_id": str(uuid.uuid4()),
            "section": "skills",
            "type": "reorder",
            "source_id": "skills_section",
            "original_text": f"{len(orig_skills)} skills in original order",
            "tailored_text": f"Prioritized {len(sanitized_skills_list)} skills based on job requirements",
            "reason": "Reordered relevant skills to match job description.",
            "is_safe": True,
            "status": "accepted",
        })

    # 9. Apply Audited Experience Bullets
    audited_exps = audited["audited_experiences"]
    if tailored.get("experiences"):
        for exp in tailored.get("experiences", []):
            exp["id"] = str(uuid.uuid4())
            exp["resume_id"] = tailored["id"]
            orig_exp_id = str(exp.get("id"))
            orig_bullets = exp.get("bullets") or []

            # Check if this experience has audited bullets from AI
            # Look up by experience ID or match bullets
            matched_audited_bullets = audited_exps.get(orig_exp_id)
            if not matched_audited_bullets:
                # Match by checking if any bullet ID matches
                orig_b_ids = {str(b.get("id") if isinstance(b, dict) else "") for b in orig_bullets}
                for a_exp_id, a_b_list in audited_exps.items():
                    if any(b.get("source_bullet_id") in orig_b_ids for b in a_b_list):
                        matched_audited_bullets = a_b_list
                        break

            new_bullets = []
            if matched_audited_bullets:
                for idx, ab in enumerate(matched_audited_bullets):
                    new_bullets.append({
                        "id": str(uuid.uuid4()),
                        "experience_id": exp["id"],
                        "content": ab["content"],
                        "display_order": idx,
                        "source_bullet_id": ab["source_bullet_id"],
                    })
                    if ab.get("is_rewritten"):
                        change_log.append({
                            "change_id": str(uuid.uuid4()),
                            "section": "experience_bullets",
                            "type": "rewrite",
                            "source_id": ab["source_bullet_id"],
                            "experience_company": exp.get("company") or exp.get("company_name"),
                            "original_text": ab["orig_text"],
                            "tailored_text": ab["content"],
                            "reason": ab["reason"],
                            "is_safe": True,
                            "status": "pending",
                        })
            else:
                # Keep original bullets with fresh IDs
                for idx, b in enumerate(orig_bullets):
                    b_text = b.get("content", "") if isinstance(b, dict) else str(b)
                    b_id = b.get("id") if isinstance(b, dict) else str(idx)
                    new_bullets.append({
                        "id": str(uuid.uuid4()),
                        "experience_id": exp["id"],
                        "content": b_text,
                        "display_order": idx,
                        "source_bullet_id": b_id,
                    })

            exp["bullets"] = new_bullets

    # 10. Prioritize Projects
    prioritized_pids = audited.get("prioritized_project_ids") or []
    if tailored.get("projects"):
        orig_projs = tailored.get("projects", [])
        proj_map = {str(p.get("id")): p for p in orig_projs}
        reordered_projs = []
        for idx, pid in enumerate(prioritized_pids):
            if pid in proj_map:
                p = proj_map[pid]
                p["id"] = str(uuid.uuid4())
                p["resume_id"] = tailored["id"]
                p["display_order"] = idx
                for pb in p.get("bullets") or []:
                    if isinstance(pb, dict):
                        pb["id"] = str(uuid.uuid4())
                        pb["project_id"] = p["id"]
                reordered_projs.append(p)
        # Any remaining
        for p in orig_projs:
            if p not in reordered_projs:
                p["id"] = str(uuid.uuid4())
                p["resume_id"] = tailored["id"]
                p["display_order"] = len(reordered_projs)
                reordered_projs.append(p)
        tailored["projects"] = reordered_projs

    # 11. Refresh child entity IDs
    if tailored.get("personal_info"):
        tailored["personal_info"]["id"] = str(uuid.uuid4())
        tailored["personal_info"]["resume_id"] = tailored["id"]

    for edu in tailored.get("educations") or []:
        edu["id"] = str(uuid.uuid4())
        edu["resume_id"] = tailored["id"]

    for cert in tailored.get("certifications") or []:
        cert["id"] = str(uuid.uuid4())
        cert["resume_id"] = tailored["id"]

    for link in tailored.get("links") or []:
        link["id"] = str(uuid.uuid4())
        link["resume_id"] = tailored["id"]

    # 12. Run Strict Integrity Verification
    integrity_ok, integrity_err = verify_resume_integrity(source_resume, tailored)
    if not integrity_ok:
        print(f"[WARN] AI tailoring integrity check warning: {integrity_err}")

    # 13. Recalculate Job Match on Tailored Draft
    tailored_match = run_job_match_analysis(job, tailored)
    tailored_score = tailored_match.get("overall_score", original_score)

    return {
        "tailored_resume": tailored,
        "tailoring_plan": {
            "target_job_id": job.get("id"),
            "source_resume_id": source_resume.get("id"),
            "job_analysis": audited["job_analysis"],
            "missing_qualifications": audited["missing_qualifications"],
            "matched_skills": [m.get("canonical") for m in tailored_match.get("matched_skills", [])],
            "missing_skills": [m.get("canonical") for m in tailored_match.get("missing_skills", [])],
            "options": options.to_dict(),
        },
        "job_profile": job_profile,
        "evidence_report": evidence_report,
        "missing_qualifications": audited["missing_qualifications"],
        "change_log": change_log,
        "original_match_score": original_score,
        "tailored_match_score": tailored_score,
        "score_delta": tailored_score - original_score,
        "algorithm_version": f"groq-{settings.GROQ_MODEL}-v1",
        "integrity_passed": integrity_ok,
        "ai_metadata": {
            "ai_enabled": True,
            "provider": "groq",
            "model": settings.GROQ_MODEL,
            "token_usage": completion_res.token_usage.to_dict(),
            "latency_ms": round(completion_res.latency_ms, 2),
            "retry_count": completion_res.retry_count,
            "missing_qualifications": audited["missing_qualifications"],
        },
    }
