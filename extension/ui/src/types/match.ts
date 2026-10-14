/**
 * TailorResume — Job Match Types (Module 5)
 * Strict deterministic Job Match schemas with explainable evidence.
 */

export type MatchLevel =
  | 'Excellent Match'
  | 'Strong Match'
  | 'Moderate Match'
  | 'Low Match'
  | 'Weak Match'
  | 'Limited Data';

export type EvidenceStrength = 'strong' | 'moderate' | 'weak' | 'none';

export type RequirementStatus = 'matched' | 'partial' | 'missing' | 'unknown' | 'not_specified';

export interface MatchCategoryScores {
  skills: number;
  responsibilities: number;
  experience: number;
  qualifications: number;
  keywords: number;
}

export interface MatchWeights {
  skills: number;
  responsibilities: number;
  experience: number;
  qualifications: number;
  keywords: number;
}

export interface MatchedSkill {
  canonical: string;
  alias_matched: string;
  category: string;
  is_preferred: boolean;
  evidence_strength: EvidenceStrength;
  evidence?: string;
  location?: string;
  status: 'matched';
}

export interface MissingSkill {
  canonical: string;
  category: string;
  is_preferred: boolean;
  status: 'missing';
  message: string;
}

export interface ResponsibilityAnalysis {
  job_responsibility: string;
  status: 'matched' | 'partial' | 'missing';
  evidence_strength: EvidenceStrength;
  evidence?: string | null;
  location?: string | null;
  overlap_score: number;
}

export interface ExperienceAssessment {
  status: RequirementStatus;
  score: number;
  required_years?: number | null;
  candidate_years?: number | null;
  message: string;
}

export interface QualificationAssessment {
  score: number;
  education_status: RequirementStatus;
  education_score: number;
  education_message: string;
  required_degree?: string | null;
  candidate_degree?: string | null;
  certification_status: RequirementStatus;
  certification_score: number;
}

export interface KeywordCoverage {
  score: number;
  total_keywords: number;
  matched_keywords: number;
  sample_matched: string[];
  sample_missing: string[];
}

export interface MatchEvidence {
  category: string;
  item: string;
  alias_matched?: string;
  location?: string | null;
  snippet?: string | null;
  strength: EvidenceStrength;
}

export interface JobMatchResult {
  match_id?: string;
  job_id: string;
  job_title: string;
  company_name?: string | null;
  resume_id: string;
  resume_name: string;
  overall_score: number;
  match_level: MatchLevel;
  limited_data: boolean;
  message?: string;
  is_stale: boolean;
  cached?: boolean;
  category_scores: MatchCategoryScores;
  weights: MatchWeights;
  matched_skills: MatchedSkill[];
  missing_skills: MissingSkill[];
  responsibilities_analysis: ResponsibilityAnalysis[];
  experience_assessment: ExperienceAssessment;
  qualification_assessment: QualificationAssessment;
  keyword_coverage: KeywordCoverage;
  evidence: MatchEvidence[];
  disclaimer: string;
  algorithm_version: string;
  created_at?: string | null;
}

export interface JobMatchSummary {
  id: string;
  job_id: string;
  resume_id: string;
  resume_name: string;
  overall_score: number;
  category_scores: MatchCategoryScores;
  algorithm_version: string;
  is_stale: boolean;
  created_at?: string | null;
}
