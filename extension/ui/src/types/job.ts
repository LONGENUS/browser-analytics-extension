/**
 * TailorResume — Job Ingestion Domain Types (Module 4)
 * Strongly typed definitions for job detection, extraction, and structured storage.
 */

export type JobSource =
  | 'linkedin'
  | 'naukri'
  | 'indeed'
  | 'company_site'
  | 'job_board'
  | 'other';

export type JobExtractionConfidence = 'high' | 'medium' | 'low';

export interface Job {
  id: string;
  user_id: string;
  source: JobSource;
  source_url: string | null;
  job_title: string;
  company_name: string | null;
  company_url: string | null;
  location: string | null;
  employment_type: string | null;
  work_mode: string | null;
  department: string | null;
  job_description: string;
  requirements: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  salary_text: string | null;
  job_posted_at: string | null;
  extracted_at: string;
  created_at: string;
  updated_at: string;
}

export interface JobCreateInput {
  job_title: string;
  company_name?: string | null;
  company_url?: string | null;
  location?: string | null;
  source?: JobSource;
  source_url?: string | null;
  employment_type?: string | null;
  work_mode?: string | null;
  department?: string | null;
  job_description: string;
  requirements?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  salary_text?: string | null;
  job_posted_at?: string | null;
}

export interface JobUpdateInput {
  job_title?: string;
  company_name?: string | null;
  company_url?: string | null;
  location?: string | null;
  source?: JobSource;
  source_url?: string | null;
  employment_type?: string | null;
  work_mode?: string | null;
  department?: string | null;
  job_description?: string;
  requirements?: string | null;
  responsibilities?: string | null;
  qualifications?: string | null;
  salary_text?: string | null;
  job_posted_at?: string | null;
}

export interface JobExtractionResult {
  is_job_page: boolean;
  confidence: JobExtractionConfidence;
  extraction_method: 'json_ld' | 'site_adapter' | 'generic_dom' | 'manual';
  source: JobSource;
  source_url: string;
  job_title: string;
  company_name: string | null;
  company_url: string | null;
  location: string | null;
  employment_type: string | null;
  work_mode: string | null;
  department: string | null;
  job_description: string;
  requirements: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  salary_text: string | null;
  job_posted_at: string | null;
  raw_warnings?: string[];
}

export interface SaveJobResponse {
  duplicate: boolean;
  message?: string;
  existing_job?: Job;
  job: Job;
}
