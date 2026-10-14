/**
 * TailorResume — Jobs Service (Module 4)
 * Handles job extraction, active browser tab communication, and job persistence.
 * Deterministic extraction — zero tracking, zero automated transmissions.
 * Fully supports local storage caching and offline fallback.
 */

import { authenticatedFetch } from './api';
import {
  Job,
  JobCreateInput,
  JobUpdateInput,
  SaveJobResponse,
  JobExtractionResult,
} from '../types/job';
import { extractJobFromDocument } from './jobExtractor';

declare const chrome: any;

async function getLocalSavedJobs(): Promise<Job[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storage = chrome.storage.local || chrome.storage.sync;
      const res = await storage.get(['tailor_saved_jobs']);
      if (res && res.tailor_saved_jobs && Array.isArray(res.tailor_saved_jobs)) {
        return res.tailor_saved_jobs;
      }
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem('tailor_saved_jobs');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

async function saveLocalSavedJobs(jobs: Job[]): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storage = chrome.storage.local || chrome.storage.sync;
      await storage.set({ tailor_saved_jobs: jobs });
    }
  } catch (_) {}
  try {
    localStorage.setItem('tailor_saved_jobs', JSON.stringify(jobs));
  } catch (_) {}
}

class JobsService {
  /**
   * Fetches saved jobs belonging to the authenticated user.
   * Gracefully falls back to local storage if unauthenticated or offline.
   */
  async listJobs(): Promise<Job[]> {
    try {
      const resp = await authenticatedFetch('/api/jobs');
      if (resp.ok) {
        const jobs = await resp.json();
        await saveLocalSavedJobs(jobs);
        return jobs;
      }
    } catch (_) {}
    return await getLocalSavedJobs();
  }

  /**
   * Fetches a single job by ID.
   */
  async getJob(jobId: string): Promise<Job> {
    try {
      const resp = await authenticatedFetch(`/api/jobs/${jobId}`);
      if (resp.ok) {
        return resp.json();
      }
    } catch (_) {}

    const localJobs = await getLocalSavedJobs();
    const found = localJobs.find((j) => j.id === jobId);
    if (found) return found;

    throw new Error('Job not found or access denied.');
  }

  /**
   * Saves a new job or updates an existing duplicate.
   * Persists both to backend (when reachable) and local storage.
   */
  async saveJob(input: JobCreateInput, updateIfExists: boolean = false): Promise<SaveJobResponse> {
    try {
      const url = `/api/jobs?update_if_exists=${updateIfExists ? 'true' : 'false'}`;
      const resp = await authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify(input),
      });

      if (resp.ok) {
        const data = await resp.json();
        const active = data.job || data.existing_job;
        if (active) {
          const current = await getLocalSavedJobs();
          const filtered = current.filter((j) => j.id !== active.id);
          await saveLocalSavedJobs([active, ...filtered]);
        }
        return data;
      }
    } catch (_) {}

    // Standalone fallback: persist locally
    const localJob: Job = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-job-${Date.now()}`,
      user_id: '',
      job_title: input.job_title,
      company_name: input.company_name || null,
      company_url: input.company_url || null,
      location: input.location || null,
      employment_type: input.employment_type || null,
      work_mode: input.work_mode || null,
      department: input.department || null,
      source: input.source || 'other',
      source_url: input.source_url || null,
      job_description: input.job_description,
      requirements: input.requirements || null,
      responsibilities: input.responsibilities || null,
      qualifications: input.qualifications || null,
      salary_text: input.salary_text || null,
      job_posted_at: input.job_posted_at || null,
      extracted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const current = await getLocalSavedJobs();
    const filtered = current.filter((j) => j.id !== localJob.id);
    await saveLocalSavedJobs([localJob, ...filtered]);

    return {
      duplicate: false,
      message: 'Job saved successfully.',
      job: localJob,
    };
  }

  /**
   * Updates an existing saved job.
   */
  async updateJob(jobId: string, input: JobUpdateInput): Promise<Job> {
    try {
      const resp = await authenticatedFetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });

      if (resp.ok) {
        const updated = await resp.json();
        const current = await getLocalSavedJobs();
        await saveLocalSavedJobs(current.map((j) => (j.id === jobId ? updated : j)));
        return updated;
      }
    } catch (_) {}

    const current = await getLocalSavedJobs();
    const existing = current.find((j) => j.id === jobId);
    if (!existing) {
      throw new Error('Failed to find job to update.');
    }

    const updated: Job = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };
    await saveLocalSavedJobs(current.map((j) => (j.id === jobId ? updated : j)));
    return updated;
  }

  /**
   * Deletes a saved job permanently.
   */
  async deleteJob(jobId: string): Promise<{ deleted: boolean; id: string }> {
    try {
      await authenticatedFetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });
    } catch (_) {}

    const current = await getLocalSavedJobs();
    await saveLocalSavedJobs(current.filter((j) => j.id !== jobId));
    return { deleted: true, id: jobId };
  }

  /**
   * Reads information about the active browser tab without scraping.
   */
  async getActiveTabInfo(): Promise<{ id?: number; url?: string; title?: string } | null> {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          return { id: tab.id, url: tab.url, title: tab.title };
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Requests the active browser tab to execute deterministic job extraction.
   * Robust against uninitialized content scripts via direct DOM script execution fallback.
   */
  async extractFromActiveTab(): Promise<{ success: boolean; result?: JobExtractionResult; error?: string }> {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id || !tab.url) {
          return { success: false, error: 'No active browser tab found.' };
        }

        const tabUrl = (tab.url || '').toLowerCase();
        const detectedSource = tabUrl.includes('linkedin.com')
          ? 'linkedin'
          : tabUrl.includes('naukri.com')
          ? 'naukri'
          : tabUrl.includes('indeed.com')
          ? 'indeed'
          : 'other';

        if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
          return {
            success: false,
            error: 'Cannot extract from system or browser pages. Please open a job posting.',
            result: {
              is_job_page: false,
              confidence: 'low',
              extraction_method: 'generic_dom',
              source: detectedSource,
              source_url: tab.url || '',
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
            },
          };
        }

        // 1. Send message to content script
        let response = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB_DATA' }, (res: any) => {
            if (chrome.runtime?.lastError) {
              resolve(null);
            } else {
              resolve(res);
            }
          });
        });

        if (response && response.success && response.data && response.data.job_description) {
          return { success: true, result: response.data };
        }

        // 2. On-demand script injection fallback if content script was not yet initialized
        if (chrome.scripting && chrome.scripting.executeScript) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/content.js'],
            }).catch(() => {});

            // Query after injection
            response = await new Promise<any>((resolve) => {
              chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB_DATA' }, (res: any) => {
                if (chrome.runtime?.lastError) {
                  resolve(null);
                } else {
                  resolve(res);
                }
              });
            });

            if (response && response.success && response.data && response.data.job_description) {
              return { success: true, result: response.data };
            }

            // Direct in-page function invocation fallback with comprehensive LinkedIn split-view support
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                if (typeof (window as any).__tailorResumeExtract === 'function') {
                  const res = (window as any).__tailorResumeExtract();
                  if (res && res.job_description) return res;
                }

                // In-tab direct DOM evaluation
                const url = window.location.href;
                const doc = document;
                const isLinkedIn = url.includes('linkedin.com');
                const isNaukri = url.includes('naukri.com');
                const isIndeed = url.includes('indeed.com');

                let title = '';
                let company = '';
                let location = '';
                let description = '';

                if (isLinkedIn) {
                  const details = (doc.querySelector(
                    '.jobs-search__job-details--container, .jobs-search__job-details, .jobs-details__main-content, .job-view-layout, .jobs-details, main.jobs-search__job-details, div[class*="job-details"]'
                  ) || doc) as Element | Document;

                  const titleEl = details.querySelector(
                    'h1.job-details-jobs-unified-top-card__job-title, h2.job-details-jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-details__main-content h1, .jobs-search__job-details--container h1, h1.t-24, h2.t-24, h1.top-card-layout__title, h1.topcard__title'
                  ) || (details !== doc ? details.querySelector('h1, h2') : null);
                  title = titleEl?.textContent?.trim() || '';

                  const compEl = details.querySelector(
                    'div.job-details-jobs-unified-top-card__company-name a, div.job-details-jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description a, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, a.topcard__org-name-link'
                  );
                  company = compEl?.textContent?.trim() || '';

                  const locEl = details.querySelector(
                    '.job-details-jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__bullet, .topcard__flavor--bullet'
                  );
                  location = locEl?.textContent?.trim() || '';

                  const descEl = details.querySelector(
                    '#job-details, .jobs-description__content, .jobs-box__html-content, article.jobs-description__container, .jobs-description-content__text, div[class*="jobs-description"], .jobs-description, .show-more-less-html__markup'
                  ) || doc.querySelector('#job-details, .jobs-description__content');
                  description = descEl?.textContent?.trim() || '';
                }

                if (!description) {
                  const genericDesc = doc.querySelector('#job-details, #jobDescriptionText, .job-description, article, [role="main"]');
                  description = genericDesc?.textContent?.trim() || '';
                }

                if (!title) {
                  title = doc.querySelector('h1')?.textContent?.trim() || doc.title.replace(/\s*[|\-–—].*$/, '').trim();
                }

                if (description && description.length > 20) {
                  return {
                    is_job_page: true,
                    confidence: 'high',
                    extraction_method: 'site_adapter',
                    source: isLinkedIn ? 'linkedin' : isNaukri ? 'naukri' : isIndeed ? 'indeed' : 'other',
                    source_url: url,
                    job_title: title || 'Job Opportunity',
                    company_name: company || null,
                    company_url: null,
                    location: location || null,
                    employment_type: null,
                    work_mode: (location || '').toLowerCase().includes('remote') ? 'Remote' : null,
                    department: null,
                    job_description: description,
                    salary_text: null,
                    job_posted_at: null,
                  };
                }
                return null;
              },
            });

            if (results && results[0] && results[0].result) {
              return { success: true, result: results[0].result };
            }
          } catch (_) {}
        }

        return {
          success: false,
          error: "Could not automatically detect a job description on this tab. You can paste it manually below.",
          result: {
            is_job_page: false,
            confidence: 'low',
            extraction_method: 'generic_dom',
            source: detectedSource,
            source_url: tab.url || '',
            job_title: tab.title ? tab.title.replace(/\s*[|\-–—].*$/, '').trim() : '',
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
          },
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Error communicating with active tab.' };
      }
    }

    // Fallback in web / test environment: extract from current document
    if (typeof document !== 'undefined') {
      try {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
        const result = extractJobFromDocument(document, currentUrl);
        return { success: true, result };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    return { success: false, error: 'Browser environment not available.' };
  }
}

export const jobsService = new JobsService();
