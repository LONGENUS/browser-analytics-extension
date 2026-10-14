/**
 * TailorResume — AI Resume Tailoring Assistant — Resume Tailoring Types (Module 6)
 * Strongly typed models for deterministic and AI-assisted resume tailoring.
 */

import { FullStructuredResume } from './resume';

export type TailoringMode = 'conservative' | 'balanced' | 'strong';

export interface TailoringOptions {
  job_id: string;
  tailoring_mode: TailoringMode;
  prioritize_skills: boolean;
  prioritize_experience_bullets: boolean;
  prioritize_projects: boolean;
  adapt_summary: boolean;
  concise_mode: boolean;
  bullet_rewriting: TailoringMode;
}

export type ChangeType = 'reorder' | 'rewrite' | 'adapt_summary' | 'prioritize';
export type ChangeSection = 'skills' | 'experiences' | 'projects' | 'summary';

export interface ChangeLogItem {
  id: string;
  type: ChangeType;
  section: ChangeSection;
  item_id?: string;
  parent_id?: string;
  original: string;
  tailored: string;
  reason: string;
  is_safe: boolean;
  status: 'accepted' | 'rejected';
  claims?: string[];
}

export interface TailoringPlanExperience {
  id: string;
  company: string;
  job_title: string;
  relevance_score: number;
  bullet_order: string[];
}

export interface TailoringPlanProject {
  id: string;
  name: string;
  relevance_score: number;
}

export interface BulletRewriteCandidate {
  bullet_id: string;
  experience_id: string;
  original_text: string;
  reason: string;
}

export interface TailoringPlan {
  target_job_id: string;
  source_resume_id: string;
  relevant_skills: string[];
  missing_skills: string[];
  prioritized_experience: TailoringPlanExperience[];
  prioritized_projects: TailoringPlanProject[];
  prioritized_certifications: string[];
  summary_recommendations: {
    original: string;
    proposed: string;
    rationale: string;
  };
  bullet_rewrite_candidates: BulletRewriteCandidate[];
  section_ordering: string[];
}

export interface TailoringDraftResult {
  tailored_resume: FullStructuredResume;
  source_resume: FullStructuredResume;
  job_id: string;
  job_title: string;
  company: string;
  tailoring_plan: TailoringPlan;
  change_log: ChangeLogItem[];
  original_match_score?: number | null;
  tailored_match_score?: number | null;
  tailoring_mode: string;
  algorithm_version: string;
}

export interface SaveTailoredResumeInput {
  job_id: string;
  name: string;
  tailored_resume: FullStructuredResume;
  change_log: ChangeLogItem[];
  tailoring_mode: string;
  original_match_score?: number | null;
  tailored_match_score?: number | null;
}

export interface SaveTailoredResumeResponse {
  status: string;
  message: string;
  tailored_resume_id: string;
  tailored_resume: FullStructuredResume;
  source_resume_id: string;
  target_job_id: string;
}

export interface TailoredResumeMetadata {
  id: string;
  user_id: string;
  resume_id: string;
  tailored_resume_id?: string;
  source_resume_id?: string | null;
  job_id?: string | null;
  target_job_id?: string | null;
  name?: string;
  tailored_resume_name?: string;
  template_id?: string;
  template_version?: string;
  source_resume_name?: string | null;
  source_resume_deleted?: boolean;
  target_job_title?: string | null;
  target_company_name?: string | null;
  target_job_deleted?: boolean;
  is_stale?: boolean;
  tailoring_mode: string;
  algorithm_version: string;
  original_match_score?: number | null;
  tailored_match_score?: number | null;
  changes_count?: number;
  change_log?: ChangeLogItem[];
  created_at: string;
  updated_at: string;
}
