/**
 * TailorResume — AI Resume Tailoring Assistant — Resume Domain Types (Module 2)
 * Strongly typed definitions for structured resume data.
 * Pure deterministic schema matching the relational PostgreSQL/Supabase foundation.
 */

export interface Bullet {
  id?: string;
  content: string;
  display_order: number;
}

export interface PersonalInfo {
  id?: string;
  resume_id?: string;
  full_name?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
}

export interface ResumeSummary {
  id?: string;
  resume_id?: string;
  summary?: string | null;
}

export interface Experience {
  id?: string;
  resume_id?: string;
  company: string;
  job_title: string;
  location?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  description?: string | null;
  display_order: number;
  bullets: Bullet[];
}

export interface Education {
  id?: string;
  resume_id?: string;
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  display_order: number;
}

export interface Skill {
  id?: string;
  resume_id?: string;
  skill_name: string;
  category?: string | null; // e.g., 'Languages', 'Frameworks', 'Cloud', 'Databases', 'Tools', 'Soft Skills'
  display_order: number;
}

export interface Project {
  id?: string;
  resume_id?: string;
  name: string;
  description?: string | null;
  url?: string | null;
  technologies?: string | null;
  display_order: number;
  bullets: Bullet[];
}

export interface Certification {
  id?: string;
  resume_id?: string;
  name: string;
  issuer?: string | null;
  issue_date?: string | null;
  expiration_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
  display_order: number;
}

export interface ResumeLink {
  id?: string;
  resume_id?: string;
  label: string;
  url: string;
  display_order: number;
}

export interface ResumeSummaryItem {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  status: 'draft' | 'ready';
  source_resume_id?: string | null;
  target_job_id?: string | null;
  is_tailored?: boolean;
  template_id?: string;
  template_version?: string;
  file_sha256?: string | null;
  original_filename?: string | null;
  original_file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
}

export interface FullStructuredResume {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  status: 'draft' | 'ready';
  source_resume_id?: string | null;
  target_job_id?: string | null;
  is_tailored?: boolean;
  template_id?: string;
  template_version?: string;
  file_sha256?: string | null;
  original_filename?: string | null;
  original_file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
  personal_info: PersonalInfo | null;
  summary: ResumeSummary | null;
  experiences: Experience[];
  educations: Education[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  links: ResumeLink[];
  unsupported_sections?: { title: string; content: string }[];
}

export interface CreateResumeInput {
  name: string;
  is_default?: boolean;
  file_sha256?: string | null;
  original_filename?: string | null;
  original_file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export interface UpdateResumeInput {
  name?: string;
  is_default?: boolean;
  status?: 'draft' | 'ready';
  template_id?: string;
  template_version?: string;
  file_sha256?: string | null;
  original_filename?: string | null;
  original_file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  personal_info?: PersonalInfo | null;
  summary?: ResumeSummary | null;
  experiences?: Experience[];
  educations?: Education[];
  skills?: Skill[];
  projects?: Project[];
  certifications?: Certification[];
  links?: ResumeLink[];
}

export interface ResumeImportResult {
  import_id: string;
  filename: string;
  file_size: number;
  file_type: 'pdf' | 'docx';
  status: 'review_required';
  parsed_resume: FullStructuredResume;
}

export interface ResumeImportSession {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  status: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

