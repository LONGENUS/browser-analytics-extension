"""
TailorResume — Change Tracking & Document Diff Engine
Computes precise section-by-section, paragraph-by-paragraph, and word-by-word
diffs between a source resume and its tailored counterpart.

Strict Guarantees:
- Pure comparison between actual source document and actual generated version.
- Never creates approximate reconstructions.
- Detects added, modified, removed, and unchanged content.
- Generates fine-grained inline word-level diff segments for visual highlighting.
- Separates change metadata from clean document exports.
"""

import difflib
import re
import uuid
from typing import Dict, Any, List, Optional, Tuple


def tokenize_words(text: str) -> List[str]:
    """Splits text into words and whitespace/punctuation tokens to preserve exact formatting in diffs."""
    if not text:
        return []
    # Tokenize words while keeping whitespace and punctuation attached
    tokens = re.findall(r"\S+|\s+", text)
    return tokens


def compute_word_diff_segments(orig_text: str, prop_text: str) -> List[Dict[str, str]]:
    """
    Computes precise word-level diff segments using difflib.SequenceMatcher.
    Returns a list of dicts:
      [
        {"type": "equal" | "added" | "removed", "text": "..."}
      ]
    """
    orig_tokens = tokenize_words(orig_text or "")
    prop_tokens = tokenize_words(prop_text or "")

    if not orig_tokens and not prop_tokens:
        return []

    if not orig_tokens:
        return [{"type": "added", "text": prop_text}]

    if not prop_tokens:
        return [{"type": "removed", "text": orig_text}]

    matcher = difflib.SequenceMatcher(None, orig_tokens, prop_tokens)
    segments: List[Dict[str, str]] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            text = "".join(orig_tokens[i1:i2])
            if text:
                segments.append({"type": "equal", "text": text})
        elif tag == "replace":
            rem_text = "".join(orig_tokens[i1:i2])
            add_text = "".join(prop_tokens[j1:j2])
            if rem_text:
                segments.append({"type": "removed", "text": rem_text})
            if add_text:
                segments.append({"type": "added", "text": add_text})
        elif tag == "delete":
            rem_text = "".join(orig_tokens[i1:i2])
            if rem_text:
                segments.append({"type": "removed", "text": rem_text})
        elif tag == "insert":
            add_text = "".join(prop_tokens[j1:j2])
            if add_text:
                segments.append({"type": "added", "text": add_text})

    return segments


def compute_resume_diff(
    source_resume: Dict[str, Any],
    tailored_resume: Dict[str, Any],
    source_id: Optional[str] = None,
    tailored_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Compares the source resume against the tailored resume and returns a structured
    list of change records for each affected section and paragraph.
    """
    src_id = source_id or source_resume.get("id") or "source"
    tgt_id = tailored_id or tailored_resume.get("id") or "tailored"
    changes: List[Dict[str, Any]] = []

    # --------------------------------------------------------------------------
    # 1. Summary Section
    # --------------------------------------------------------------------------
    src_sum_data = source_resume.get("summary") or {}
    src_summary = (
        src_sum_data.get("summary") or src_sum_data.get("content") or ""
        if isinstance(src_sum_data, dict)
        else str(src_sum_data or "")
    ).strip()

    tgt_sum_data = tailored_resume.get("summary") or {}
    tgt_summary = (
        tgt_sum_data.get("summary") or tgt_sum_data.get("content") or ""
        if isinstance(tgt_sum_data, dict)
        else str(tgt_sum_data or "")
    ).strip()

    if not src_summary and not tgt_summary:
        pass
    elif src_summary == tgt_summary:
        changes.append({
            "id": f"{tgt_id}_summary_unchanged",
            "source_resume_id": src_id,
            "tailored_resume_id": tgt_id,
            "section": "summary",
            "paragraph_id": "summary",
            "section_title": "Professional Summary",
            "item_title": "Summary Statement",
            "change_type": "unchanged",
            "original_text": src_summary,
            "proposed_text": tgt_summary,
            "diff_segments": [{"type": "equal", "text": tgt_summary}],
            "explanation": "Summary text is identical to source resume.",
            "status": "accepted",
        })
    elif not src_summary and tgt_summary:
        changes.append({
            "id": f"{tgt_id}_summary_added",
            "source_resume_id": src_id,
            "tailored_resume_id": tgt_id,
            "section": "summary",
            "paragraph_id": "summary",
            "section_title": "Professional Summary",
            "item_title": "Summary Statement",
            "change_type": "added",
            "original_text": "",
            "proposed_text": tgt_summary,
            "diff_segments": [{"type": "added", "text": tgt_summary}],
            "explanation": "Professional summary added to emphasize qualifications for target role.",
            "status": "accepted",
        })
    elif src_summary and not tgt_summary:
        changes.append({
            "id": f"{tgt_id}_summary_removed",
            "source_resume_id": src_id,
            "tailored_resume_id": tgt_id,
            "section": "summary",
            "paragraph_id": "summary",
            "section_title": "Professional Summary",
            "item_title": "Summary Statement",
            "change_type": "removed",
            "original_text": src_summary,
            "proposed_text": "",
            "diff_segments": [{"type": "removed", "text": src_summary}],
            "explanation": "Summary removed in tailored version.",
            "status": "accepted",
        })
    else:
        diff_segs = compute_word_diff_segments(src_summary, tgt_summary)
        changes.append({
            "id": f"{tgt_id}_summary_modified",
            "source_resume_id": src_id,
            "tailored_resume_id": tgt_id,
            "section": "summary",
            "paragraph_id": "summary",
            "section_title": "Professional Summary",
            "item_title": "Summary Statement",
            "change_type": "modified",
            "original_text": src_summary,
            "proposed_text": tgt_summary,
            "diff_segments": diff_segs,
            "explanation": "Adapted summary phrasing to highlight key target requirements and competencies.",
            "status": "accepted",
        })

    # --------------------------------------------------------------------------
    # 2. Skills Section
    # --------------------------------------------------------------------------
    src_skills = source_resume.get("skills") or []
    tgt_skills = tailored_resume.get("skills") or []

    src_skill_names = [
        ((s.get("skill_name") or s.get("name") or "").strip())
        if isinstance(s, dict) else str(s).strip()
        for s in src_skills
    ]
    src_skill_names = [s for s in src_skill_names if s]

    tgt_skill_names = [
        ((s.get("skill_name") or s.get("name") or "").strip())
        if isinstance(s, dict) else str(s).strip()
        for s in tgt_skills
    ]
    tgt_skill_names = [s for s in tgt_skill_names if s]

    src_skill_set = {s.lower(): s for s in src_skill_names}
    tgt_skill_set = {s.lower(): s for s in tgt_skill_names}

    # Added skills
    for s_name in tgt_skill_names:
        if s_name.lower() not in src_skill_set:
            changes.append({
                "id": f"{tgt_id}_skill_{s_name}_added",
                "source_resume_id": src_id,
                "tailored_resume_id": tgt_id,
                "section": "skills",
                "paragraph_id": f"skill_{s_name}",
                "section_title": "Skills",
                "item_title": f"Skill: {s_name}",
                "change_type": "added",
                "original_text": "",
                "proposed_text": s_name,
                "diff_segments": [{"type": "added", "text": s_name}],
                "explanation": f"Added relevant technical skill '{s_name}' based on job requirements.",
                "status": "accepted",
            })

    # Removed skills
    for s_name in src_skill_names:
        if s_name.lower() not in tgt_skill_set:
            changes.append({
                "id": f"{tgt_id}_skill_{s_name}_removed",
                "source_resume_id": src_id,
                "tailored_resume_id": tgt_id,
                "section": "skills",
                "paragraph_id": f"skill_{s_name}",
                "section_title": "Skills",
                "item_title": f"Skill: {s_name}",
                "change_type": "removed",
                "original_text": s_name,
                "proposed_text": "",
                "diff_segments": [{"type": "removed", "text": s_name}],
                "explanation": f"De-emphasized skill '{s_name}' to focus on target role priorities.",
                "status": "accepted",
            })

    # Reordered skills check
    common_src = [s for s in src_skill_names if s.lower() in tgt_skill_set]
    common_tgt = [s for s in tgt_skill_names if s.lower() in src_skill_set]
    if common_src != common_tgt and len(common_src) > 1:
        changes.append({
            "id": f"{tgt_id}_skills_reordered",
            "source_resume_id": src_id,
            "tailored_resume_id": tgt_id,
            "section": "skills",
            "paragraph_id": "skills_order",
            "section_title": "Skills",
            "item_title": "Skills Priority Order",
            "change_type": "modified",
            "original_text": ", ".join(common_src),
            "proposed_text": ", ".join(common_tgt),
            "diff_segments": compute_word_diff_segments(", ".join(common_src), ", ".join(common_tgt)),
            "explanation": "Prioritized job-relevant skills to the beginning of the skills list.",
            "status": "accepted",
        })

    # --------------------------------------------------------------------------
    # 3. Experiences & Experience Bullets
    # --------------------------------------------------------------------------
    src_exps = source_resume.get("experiences") or []
    tgt_exps = tailored_resume.get("experiences") or []

    for exp_idx, tgt_exp in enumerate(tgt_exps):
        company = tgt_exp.get("company") or tgt_exp.get("company_name", f"Position {exp_idx+1}")
        role = tgt_exp.get("job_title", "Role")
        sec_title = f"Experience: {role} at {company}"

        # Find corresponding source experience by company / role
        src_exp = None
        for candidate in src_exps:
            c_comp = candidate.get("company") or candidate.get("company_name", "")
            c_role = candidate.get("job_title", "")
            if (
                (c_comp and c_comp.lower() == company.lower())
                or (c_role and c_role.lower() == role.lower())
            ):
                src_exp = candidate
                break

        if not src_exp and exp_idx < len(src_exps):
            src_exp = src_exps[exp_idx]

        src_bullets_raw = src_exp.get("bullets") if src_exp else []
        src_bullet_texts = [
            (b.get("content", "") if isinstance(b, dict) else str(b)).strip()
            for b in src_bullets_raw
        ]
        tgt_bullets_raw = tgt_exp.get("bullets") or []
        tgt_bullet_texts = [
            (b.get("content", "") if isinstance(b, dict) else str(b)).strip()
            for b in tgt_bullets_raw
        ]

        # Match bullets using similarity
        used_src_indices = set()
        for b_idx, tgt_b in enumerate(tgt_bullet_texts):
            p_id = f"exp_{exp_idx}_b_{b_idx}"
            item_lbl = f"Bullet {b_idx + 1}"

            # Find best matching source bullet
            best_sim = 0.0
            best_src_idx = None
            for s_idx, src_b in enumerate(src_bullet_texts):
                if s_idx in used_src_indices:
                    continue
                sim = difflib.SequenceMatcher(None, src_b, tgt_b).ratio()
                if sim > best_sim:
                    best_sim = sim
                    best_src_idx = s_idx

            if best_sim >= 0.999:
                used_src_indices.add(best_src_idx)
                changes.append({
                    "id": f"{tgt_id}_{p_id}",
                    "source_resume_id": src_id,
                    "tailored_resume_id": tgt_id,
                    "section": "experience_bullet",
                    "paragraph_id": p_id,
                    "section_title": sec_title,
                    "item_title": item_lbl,
                    "change_type": "unchanged",
                    "original_text": tgt_b,
                    "proposed_text": tgt_b,
                    "diff_segments": [{"type": "equal", "text": tgt_b}],
                    "explanation": "Bullet point unchanged from original master resume.",
                    "status": "accepted",
                })
            elif best_sim >= 0.35 and best_src_idx is not None:
                used_src_indices.add(best_src_idx)
                orig_b = src_bullet_texts[best_src_idx]
                diff_segs = compute_word_diff_segments(orig_b, tgt_b)
                changes.append({
                    "id": f"{tgt_id}_{p_id}",
                    "source_resume_id": src_id,
                    "tailored_resume_id": tgt_id,
                    "section": "experience_bullet",
                    "paragraph_id": p_id,
                    "section_title": sec_title,
                    "item_title": item_lbl,
                    "change_type": "modified",
                    "original_text": orig_b,
                    "proposed_text": tgt_b,
                    "diff_segments": diff_segs,
                    "explanation": "Rewritten to emphasize key competencies and impact relevant to target role.",
                    "status": "accepted",
                })
            else:
                # Newly added bullet
                changes.append({
                    "id": f"{tgt_id}_{p_id}",
                    "source_resume_id": src_id,
                    "tailored_resume_id": tgt_id,
                    "section": "experience_bullet",
                    "paragraph_id": p_id,
                    "section_title": sec_title,
                    "item_title": item_lbl,
                    "change_type": "added",
                    "original_text": "",
                    "proposed_text": tgt_b,
                    "diff_segments": [{"type": "added", "text": tgt_b}],
                    "explanation": "Added bullet point directly aligned with target role responsibilities.",
                    "status": "accepted",
                })

        # Removed bullets that were in source but not tailored
        for s_idx, src_b in enumerate(src_bullet_texts):
            if s_idx not in used_src_indices and src_b:
                p_id = f"exp_{exp_idx}_src_b_{s_idx}_removed"
                changes.append({
                    "id": f"{tgt_id}_{p_id}",
                    "source_resume_id": src_id,
                    "tailored_resume_id": tgt_id,
                    "section": "experience_bullet",
                    "paragraph_id": p_id,
                    "section_title": sec_title,
                    "item_title": f"Original Bullet {s_idx + 1}",
                    "change_type": "removed",
                    "original_text": src_b,
                    "proposed_text": "",
                    "diff_segments": [{"type": "removed", "text": src_b}],
                    "explanation": "Removed bullet point to prioritize higher-relevance experience for target position.",
                    "status": "accepted",
                })

    # --------------------------------------------------------------------------
    # 4. Projects & Project Bullets
    # --------------------------------------------------------------------------
    src_projs = source_resume.get("projects") or []
    tgt_projs = tailored_resume.get("projects") or []

    for p_idx, tgt_p in enumerate(tgt_projs):
        p_name = tgt_p.get("name", f"Project {p_idx+1}")
        sec_title = f"Project: {p_name}"

        # Find matching source project
        src_p = None
        for candidate in src_projs:
            if candidate.get("name", "").lower() == p_name.lower():
                src_p = candidate
                break
        if not src_p and p_idx < len(src_projs):
            src_p = src_projs[p_idx]

        src_desc = (src_p.get("description") or "").strip() if src_p else ""
        tgt_desc = (tgt_p.get("description") or "").strip()

        if src_desc and tgt_desc and src_desc != tgt_desc:
            changes.append({
                "id": f"{tgt_id}_proj_{p_idx}_desc",
                "source_resume_id": src_id,
                "tailored_resume_id": tgt_id,
                "section": "project",
                "paragraph_id": f"proj_{p_idx}_desc",
                "section_title": sec_title,
                "item_title": "Project Description",
                "change_type": "modified",
                "original_text": src_desc,
                "proposed_text": tgt_desc,
                "diff_segments": compute_word_diff_segments(src_desc, tgt_desc),
                "explanation": "Adapted project description to highlight relevance to target role.",
                "status": "accepted",
            })

    return changes
