/**
 * TailorResume — Job Extraction Engine Entrypoint (Module 4)
 * Orchestrates deterministic extraction:
 * Source Detection -> JSON-LD Schema -> Site Adapters -> Generic Heuristic Extraction -> Normalization.
 * 100% deterministic, local browser execution with zero external AI/LLM dependencies.
 */

import { JobExtractionResult, JobSource } from '../../types/job';
import { extractJsonLdJobPosting } from './jsonLd';
import { detectJobSource, extractSiteSpecificJob } from './siteAdapters';
import { extractGenericJob } from './genericExtractor';
import { cleanJobText } from './cleaner';

export * from './cleaner';
export * from './jsonLd';
export * from './siteAdapters';
export * from './genericExtractor';

/**
 * Extracts structured job data from a browser DOM Document and target URL.
 */
export function extractJobFromDocument(doc: Document, url: string): JobExtractionResult {
  const cleanUrl = (url || '').trim();
  const source: JobSource = detectJobSource(cleanUrl, doc);

  // 1. Priority 1: JSON-LD Schema (JobPosting)
  const jsonLdResult = extractJsonLdJobPosting(doc);
  if (jsonLdResult && jsonLdResult.title && jsonLdResult.description.length >= 50) {
    return {
      is_job_page: true,
      confidence: 'high',
      extraction_method: 'json_ld',
      source,
      source_url: cleanUrl,
      job_title: cleanJobText(jsonLdResult.title),
      company_name: jsonLdResult.company_name ? cleanJobText(jsonLdResult.company_name) : null,
      company_url: jsonLdResult.company_url,
      location: jsonLdResult.location ? cleanJobText(jsonLdResult.location) : null,
      employment_type: jsonLdResult.employment_type,
      work_mode: detectWorkMode(jsonLdResult.location, jsonLdResult.description),
      department: null,
      job_description: jsonLdResult.description,
      requirements: jsonLdResult.qualifications,
      responsibilities: jsonLdResult.responsibilities,
      qualifications: jsonLdResult.qualifications,
      salary_text: jsonLdResult.salary_text,
      job_posted_at: jsonLdResult.date_posted,
    };
  }

  // 2. Priority 2: Site-Specific Adapters (LinkedIn, Naukri, Indeed, Company Platforms)
  const siteResult = extractSiteSpecificJob(source, doc);
  if (siteResult && siteResult.title && siteResult.description.length >= 50) {
    return {
      is_job_page: true,
      confidence: 'high',
      extraction_method: 'site_adapter',
      source,
      source_url: cleanUrl,
      job_title: cleanJobText(siteResult.title),
      company_name: siteResult.company_name ? cleanJobText(siteResult.company_name) : null,
      company_url: siteResult.company_url,
      location: siteResult.location ? cleanJobText(siteResult.location) : null,
      employment_type: siteResult.employment_type,
      work_mode: detectWorkMode(siteResult.location, siteResult.description),
      department: null,
      job_description: siteResult.description,
      requirements: null,
      responsibilities: null,
      qualifications: null,
      salary_text: siteResult.salary_text,
      job_posted_at: siteResult.job_posted_at,
    };
  }

  // 3. Priority 3: Generic Semantic Heuristic Extraction
  const genericResult = extractGenericJob(doc);
  if (genericResult && genericResult.description.length >= 50) {
    const isStrong = genericResult.description.length >= 250;
    return {
      is_job_page: true,
      confidence: isStrong ? 'medium' : 'low',
      extraction_method: 'generic_dom',
      source,
      source_url: cleanUrl,
      job_title: cleanJobText(genericResult.title || 'Job Opportunity'),
      company_name: genericResult.company_name ? cleanJobText(genericResult.company_name) : null,
      company_url: null,
      location: genericResult.location ? cleanJobText(genericResult.location) : null,
      employment_type: null,
      work_mode: detectWorkMode(genericResult.location, genericResult.description),
      department: null,
      job_description: genericResult.description,
      requirements: null,
      responsibilities: null,
      qualifications: null,
      salary_text: null,
      job_posted_at: null,
    };
  }

  // 4. Fallback: Not recognized as a valid job page
  return {
    is_job_page: false,
    confidence: 'low',
    extraction_method: 'generic_dom',
    source,
    source_url: cleanUrl,
    job_title: '',
    company_name: null,
    company_url: null,
    location: null,
    employment_type: null,
    work_mode: null,
    department: null,
    job_description: '',
    requirements: null,
    responsibilities: null,
    qualifications: null,
    salary_text: null,
    job_posted_at: null,
    raw_warnings: ['Could not detect a job posting on this page.'],
  };
}

/**
 * Heuristically detects work mode (Remote, Hybrid, On-site) from location and description text.
 */
function detectWorkMode(location: string | null, description: string): string | null {
  const combined = `${location || ''} ${description}`.toLowerCase();
  if (combined.includes('remote') || combined.includes('work from home') || combined.includes('telecommute')) {
    if (combined.includes('hybrid')) {
      return 'Hybrid';
    }
    return 'Remote';
  }
  if (combined.includes('hybrid')) {
    return 'Hybrid';
  }
  if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in-office')) {
    return 'On-site';
  }
  return null;
}
