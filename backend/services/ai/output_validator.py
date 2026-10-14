"""
TailorResume — AI Structured Output Validator
Enforces deterministic factual grounding, anti-hallucination verification,
and schema validation on AI-tailored resume responses.

Strict Guarantees:
- Deterministic verification: Does NOT rely on the LLM to police itself.
- Metric protection: Zero fabricated numbers, percentages, dollar values, or metrics.
- Source traceability: Every tailored bullet must trace to a verified source bullet ID.
- Fallback resilience: If an individual bullet rewrite fails validation, reverts that
  bullet to its original master text while keeping valid changes intact.
- Missing qualifications preservation: Prevents candidate from falsely claiming missing skills.
"""

import copy
import re
from typing import Dict, Any, List, Optional, Tuple, Set

from services.tailoring_engine import (
    extract_source_technologies,
    extract_numbers_and_metrics,
    validate_factual_grounding,
)


class AIOutputValidationError(Exception):
    """Raised when model output fails structural schema checks."""
    pass


def validate_and_filter_ai_output(
    ai_output: Dict[str, Any],
    source_resume: Dict[str, Any],
    target_job: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Validates and deterministically audits the AI-tailored output against the
    unalterable master resume.
    Returns a sanitized dictionary containing validated sections and an audit log.
    """
    if not isinstance(ai_output, dict):
        raise AIOutputValidationError("AI output is not a JSON object")

    allowed_techs = extract_source_technologies(source_resume)

    # 1. Validate Job Analysis and Missing Qualifications
    job_analysis = ai_output.get("job_analysis") or {}
    missing_qualifications = ai_output.get("missing_qualifications") or []
    if not isinstance(missing_qualifications, list):
        missing_qualifications = []

    # 2. Build Master Bullet Map
    # Maps bullet_id -> { "content": str, "exp_id": str, "company": str, "title": str }
    master_bullet_map: Dict[str, Dict[str, Any]] = {}
    master_skills_set = set()
    master_skills_order = []

    for s in source_resume.get("skills") or []:
        s_name = (s.get("skill_name") or s.get("name") or "").strip()
        if s_name:
            master_skills_set.add(s_name.lower())
            master_skills_order.append(s_name)

    experiences = source_resume.get("experiences") or []
    for exp_idx, exp in enumerate(experiences):
        exp_id = exp.get("id") or f"exp_{exp_idx}"
        company = exp.get("company") or exp.get("company_name", "Company")
        title = exp.get("job_title", "Role")
        bullets = exp.get("bullets") or []
        for b_idx, b in enumerate(bullets):
            b_id = b.get("id") if isinstance(b, dict) else f"b_{exp_idx}_{b_idx}"
            b_text = b.get("content", "") if isinstance(b, dict) else str(b)
            master_bullet_map[str(b_id)] = {
                "content": b_text,
                "exp_id": str(exp_id),
                "company": company,
                "title": title,
                "exp_index": exp_idx,
                "bullet_index": b_idx,
            }

    # 3. Validate & Sanitize Prioritized Skills
    raw_prioritized_skills = ai_output.get("prioritized_skills") or []
    sanitized_skills = []
    dropped_invented_skills = []

    if isinstance(raw_prioritized_skills, list):
        for s in raw_prioritized_skills:
            if not isinstance(s, str):
                continue
            s_clean = s.strip()
            # Must exist in master skills or allowed technologies
            if s_clean.lower() in master_skills_set or s_clean.lower() in allowed_techs:
                if s_clean not in sanitized_skills:
                    sanitized_skills.append(s_clean)
            else:
                dropped_invented_skills.append(s_clean)
                if s_clean not in missing_qualifications:
                    missing_qualifications.append(s_clean)

    # Append any master skills that were omitted by the model
    for s_orig in master_skills_order:
        if s_orig not in sanitized_skills:
            sanitized_skills.append(s_orig)

    # 4. Validate & Sanitize Summary
    raw_summary = ai_output.get("tailored_summary") or ""
    summary_reason = ai_output.get("summary_reason") or "Aligned summary with target role requirements."
    orig_sum_obj = source_resume.get("summary") or {}
    orig_summary = orig_sum_obj.get("summary") or orig_sum_obj.get("content") or ""

    sanitized_summary = orig_summary
    summary_is_rewritten = False

    # Metric source context: summary can reference metrics/years grounded anywhere in the source resume
    full_source_text_parts = [orig_summary]
    for exp in source_resume.get("experiences") or []:
        if exp.get("description"):
            full_source_text_parts.append(exp["description"])
        for b in exp.get("bullets") or []:
            b_text = b.get("content", "") if isinstance(b, dict) else str(b)
            if b_text:
                full_source_text_parts.append(b_text)
    for p in source_resume.get("projects") or []:
        if p.get("description"):
            full_source_text_parts.append(p["description"])
    full_source_context = " ".join(full_source_text_parts)

    if raw_summary and isinstance(raw_summary, str) and raw_summary.strip() != orig_summary.strip():
        # Deterministic check for numbers & metrics and unsupported tech against full resume context
        is_valid, reason = validate_factual_grounding(raw_summary, full_source_context, allowed_techs)
        if is_valid:
            sanitized_summary = raw_summary.strip()
            summary_is_rewritten = True
        else:
            # Fallback to original summary with note
            sanitized_summary = orig_summary
            summary_reason = f"Reverted AI summary to master: {reason}"

    # 5. Validate & Sanitize Experience Bullets
    tailored_exps_input = ai_output.get("tailored_experiences") or []
    audited_experiences: Dict[str, List[Dict[str, Any]]] = {}
    change_log_items: List[Dict[str, Any]] = []

    for item in tailored_exps_input:
        exp_id = str(item.get("experience_id", ""))
        bullets_input = item.get("bullets") or []
        audited_bullets = []

        for b_cand in bullets_input:
            source_b_id = str(b_cand.get("source_bullet_id", ""))
            proposed_content = (b_cand.get("content") or "").strip()
            is_rewritten = bool(b_cand.get("is_rewritten", False))
            reason = b_cand.get("reason") or "Aligned phrasing with target job description."

            # Verify that source bullet actually exists
            if source_b_id not in master_bullet_map:
                # If cannot match source ID, drop ghost bullet
                continue

            orig_info = master_bullet_map[source_b_id]
            orig_text = orig_info["content"]

            final_text = orig_text
            final_is_rewritten = False
            audit_status = "accepted"
            rejection_reason = None

            if is_rewritten and proposed_content and proposed_content != orig_text:
                # Fact-check proposed rewrite
                is_valid, validation_err = validate_factual_grounding(
                    proposed_content, orig_text, allowed_techs
                )
                if is_valid:
                    final_text = proposed_content
                    final_is_rewritten = True
                else:
                    # Revert to master bullet to prevent fabrication
                    final_text = orig_text
                    final_is_rewritten = False
                    audit_status = "reverted"
                    rejection_reason = validation_err

            audited_bullets.append({
                "source_bullet_id": source_b_id,
                "content": final_text,
                "is_rewritten": final_is_rewritten,
                "orig_text": orig_text,
                "reason": rejection_reason if rejection_reason else reason,
                "status": audit_status,
                "company": orig_info["company"],
                "title": orig_info["title"],
            })

            # Record in change log if rewritten or reordered
            if final_is_rewritten:
                change_log_items.append({
                    "id": f"ai_chg_{source_b_id}",
                    "section": "experience_bullets",
                    "type": "rewrite",
                    "source_id": source_b_id,
                    "experience_company": orig_info["company"],
                    "original_text": orig_text,
                    "tailored_text": final_text,
                    "reason": reason,
                    "is_safe": True,
                    "status": "pending",
                })

        if exp_id:
            audited_experiences[exp_id] = audited_bullets

    # 6. Prioritized Projects
    raw_project_ids = ai_output.get("prioritized_project_ids") or []
    master_proj_ids = [str(p.get("id")) for p in (source_resume.get("projects") or []) if p.get("id")]
    sanitized_proj_ids = [pid for pid in raw_project_ids if str(pid) in master_proj_ids]
    # Append any omitted projects
    for pid in master_proj_ids:
        if pid not in sanitized_proj_ids:
            sanitized_proj_ids.append(pid)

    return {
        "job_analysis": job_analysis,
        "missing_qualifications": missing_qualifications,
        "sanitized_summary": sanitized_summary,
        "summary_is_rewritten": summary_is_rewritten,
        "summary_reason": summary_reason,
        "sanitized_skills": sanitized_skills,
        "dropped_invented_skills": dropped_invented_skills,
        "audited_experiences": audited_experiences,
        "change_log_items": change_log_items,
        "prioritized_project_ids": sanitized_proj_ids,
        "validation_passed": True,
    }
