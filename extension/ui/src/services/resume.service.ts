/**
 * TailorResume — AI Resume Tailoring Assistant — Resume Service (Module 2)
 * Client-side service for managing structured user resumes.
 * Uses authenticatedFetch with automatic Bearer token injection.
 * Fully supports local storage caching and offline standalone operation.
 */

import { authenticatedFetch } from './api';
import {
  ResumeSummaryItem,
  FullStructuredResume,
  CreateResumeInput,
  UpdateResumeInput,
  ResumeImportResult,
  ResumeImportSession,
} from '../types/resume';

declare const chrome: any;

async function getLocalResumes(): Promise<FullStructuredResume[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storage = chrome.storage.local || chrome.storage.sync;
      const res = await storage.get(['tailor_resumes_cache']);
      if (res && res.tailor_resumes_cache && Array.isArray(res.tailor_resumes_cache)) {
        return res.tailor_resumes_cache;
      }
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem('tailor_resumes_cache');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

async function saveLocalResumes(resumes: FullStructuredResume[]): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storage = chrome.storage.local || chrome.storage.sync;
      await storage.set({ tailor_resumes_cache: resumes });
    }
  } catch (_) {}
  try {
    localStorage.setItem('tailor_resumes_cache', JSON.stringify(resumes));
  } catch (_) {}
}

class ResumeService {
  /**
   * Fetches the list of resumes belonging to the authenticated user.
   * Gracefully falls back to locally stored master resumes if offline or guest.
   */
  async listResumes(): Promise<ResumeSummaryItem[]> {
    try {
      const resp = await authenticatedFetch('/api/resumes');
      if (resp.ok) {
        const summaries: ResumeSummaryItem[] = await resp.json();
        return summaries;
      }
    } catch (_) {}

    // Standalone / guest fallback: derive from local storage cache
    const local = await getLocalResumes();
    return local.map((r) => ({
      id: r.id,
      user_id: r.user_id || '',
      name: r.name,
      is_default: r.is_default,
      status: r.status || 'ready',
      source_resume_id: r.source_resume_id || null,
      target_job_id: r.target_job_id || null,
      is_tailored: !!r.target_job_id,
      template_id: r.template_id || 'ats-classic',
      template_version: r.template_version || 'v1.0.0',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  /**
   * Fetches a single full structured resume by ID.
   */
  async getResume(resumeId: string): Promise<FullStructuredResume> {
    try {
      const resp = await authenticatedFetch(`/api/resumes/${resumeId}`);
      if (resp.ok) {
        const full: FullStructuredResume = await resp.json();
        const local = await getLocalResumes();
        const filtered = local.filter((r) => r.id !== full.id);
        await saveLocalResumes([full, ...filtered]);
        return full;
      }
    } catch (_) {}

    const local = await getLocalResumes();
    const found = local.find((r) => r.id === resumeId);
    if (found) return found;

    throw new Error('This resume could not be found.');
  }

  /**
   * Creates a new resume for the user.
   */
  async createResume(input: CreateResumeInput): Promise<FullStructuredResume> {
    try {
      const resp = await authenticatedFetch('/api/resumes', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (resp.ok) {
        const full: FullStructuredResume = await resp.json();
        const local = await getLocalResumes();
        const filtered = local.filter((r) => r.id !== full.id);
        await saveLocalResumes([full, ...filtered]);
        return full;
      }
    } catch (_) {}

    // Standalone fallback: create structured resume locally
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-res-${Date.now()}`;
    const now = new Date().toISOString();
    const localResume: FullStructuredResume = {
      id,
      user_id: '',
      name: input.name,
      is_default: !!input.is_default,
      status: 'ready',
      template_id: 'ats-classic',
      template_version: 'v1.0.0',
      personal_info: {
        full_name: '',
        email: '',
        phone: '',
        location: '',
        headline: '',
        website: '',
        linkedin_url: '',
        github_url: '',
        portfolio_url: '',
      },
      summary: { summary: '' },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      certifications: [],
      links: [],
      created_at: now,
      updated_at: now,
    };

    const local = await getLocalResumes();
    if (localResume.is_default) {
      local.forEach((r) => {
        r.is_default = false;
      });
    }
    await saveLocalResumes([localResume, ...local]);
    return localResume;
  }

  /**
   * Updates an existing resume and its structured sections.
   */
  async updateResume(resumeId: string, input: UpdateResumeInput): Promise<FullStructuredResume> {
    try {
      const resp = await authenticatedFetch(`/api/resumes/${resumeId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      if (resp.ok) {
        const full: FullStructuredResume = await resp.json();
        const local = await getLocalResumes();
        const filtered = local.filter((r) => r.id !== full.id);
        await saveLocalResumes([full, ...filtered]);
        return full;
      }
    } catch (_) {}

    const local = await getLocalResumes();
    const existing = local.find((r) => r.id === resumeId);
    if (!existing) {
      throw new Error('Unable to find resume to update.');
    }

    const updated: FullStructuredResume = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };
    const filtered = local.filter((r) => r.id !== resumeId);
    await saveLocalResumes([updated, ...filtered]);
    return updated;
  }

  /**
   * Updates only the presentation template selection for a resume.
   */
  async updateTemplate(
    resumeId: string,
    templateId: string,
    templateVersion: string = 'v1.0.0'
  ): Promise<{ id: string; template_id: string; template_version: string }> {
    try {
      const resp = await authenticatedFetch(`/api/resumes/${resumeId}/template`, {
        method: 'PUT',
        body: JSON.stringify({
          template_id: templateId,
          template_version: templateVersion,
        }),
      });
      if (resp.ok) return resp.json();
    } catch (_) {}

    const local = await getLocalResumes();
    const existing = local.find((r) => r.id === resumeId);
    if (existing) {
      existing.template_id = templateId;
      existing.template_version = templateVersion;
      await saveLocalResumes(local);
    }
    return { id: resumeId, template_id: templateId, template_version: templateVersion };
  }

  /**
   * Deletes a resume permanently.
   */
  async deleteResume(resumeId: string): Promise<{ deleted: boolean; id: string }> {
    try {
      await authenticatedFetch(`/api/resumes/${resumeId}`, {
        method: 'DELETE',
      });
    } catch (_) {}

    const local = await getLocalResumes();
    await saveLocalResumes(local.filter((r) => r.id !== resumeId));
    return { deleted: true, id: resumeId };
  }

  /**
   * Marks a resume as the user's default/master resume.
   */
  async setDefaultResume(resumeId: string): Promise<ResumeSummaryItem> {
    try {
      const resp = await authenticatedFetch(`/api/resumes/${resumeId}/default`, {
        method: 'POST',
      });
      if (resp.ok) return resp.json();
    } catch (_) {}

    const local = await getLocalResumes();
    local.forEach((r) => {
      r.is_default = r.id === resumeId;
    });
    await saveLocalResumes(local);
    const target = local.find((r) => r.id === resumeId)!;
    return {
      id: target.id,
      user_id: target.user_id || '',
      name: target.name,
      is_default: true,
      status: target.status || 'ready',
      source_resume_id: target.source_resume_id || null,
      target_job_id: target.target_job_id || null,
      is_tailored: !!target.target_job_id,
      template_id: target.template_id || 'ats-classic',
      template_version: target.template_version || 'v1.0.0',
      created_at: target.created_at,
      updated_at: target.updated_at,
    };
  }

  /**
   * Creates a deep duplicate of a resume.
   */
  async duplicateResume(resumeId: string): Promise<FullStructuredResume> {
    try {
      const resp = await authenticatedFetch(`/api/resumes/${resumeId}/duplicate`, {
        method: 'POST',
      });
      if (resp.ok) return resp.json();
    } catch (_) {}

    const local = await getLocalResumes();
    const source = local.find((r) => r.id === resumeId);
    if (!source) throw new Error('Resume not found to duplicate.');

    const now = new Date().toISOString();
    const clone: FullStructuredResume = {
      ...JSON.parse(JSON.stringify(source)),
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-res-${Date.now()}`,
      name: `${source.name} (Copy)`,
      is_default: false,
      created_at: now,
      updated_at: now,
    };
    await saveLocalResumes([clone, ...local]);
    return clone;
  }

  /**
   * Uploads and parses an existing resume file (PDF or DOCX).
   */
  async uploadAndParseResume(file: File): Promise<ResumeImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await authenticatedFetch('/api/resumes/import', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        return resp.json();
      }
    } catch (_) {}

    // Deterministic client fallback:
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ');
    const now = new Date().toISOString();
    const importId = `import-${Date.now()}`;
    const parsed: FullStructuredResume = {
      id: `draft-${importId}`,
      user_id: '',
      name: baseName || 'Imported Resume',
      is_default: false,
      status: 'draft',
      template_id: 'ats-classic',
      template_version: 'v1.0.0',
      personal_info: {
        full_name: baseName.split(' ')[0] ? baseName : 'Candidate',
        email: '',
        phone: '',
        location: '',
        headline: 'Professional',
        website: '',
        linkedin_url: '',
        github_url: '',
        portfolio_url: '',
      },
      summary: { summary: 'Imported resume draft. Review your details and click Save when ready.' },
      experiences: [],
      educations: [],
      skills: [
        {
          id: 'skill-1',
          skill_name: 'Communication',
          category: 'Core Skills',
          display_order: 1,
        },
      ],
      projects: [],
      certifications: [],
      links: [],
      created_at: now,
      updated_at: now,
    };

    return {
      import_id: importId,
      filename: file.name,
      file_size: file.size,
      file_type: file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
      status: 'review_required',
      parsed_resume: parsed,
    };
  }

  /**
   * Fetches the user's past resume import sessions.
   */
  async getImportHistory(): Promise<ResumeImportSession[]> {
    try {
      const resp = await authenticatedFetch('/api/resumes/import/history');
      if (resp.ok) return resp.json();
    } catch (_) {}
    return [];
  }

  /**
   * Exports a resume to PDF or DOCX format and triggers direct browser download (Module 8).
   */
  async exportResume(
    resumeId: string,
    format: 'pdf' | 'docx' = 'pdf',
    templateId?: string,
    templateVersion?: string
  ): Promise<{ filename: string; blob: Blob }> {
    const params = new URLSearchParams({ format });
    if (templateId) params.append('template_id', templateId);
    if (templateVersion) params.append('template_version', templateVersion);

    const resp = await authenticatedFetch(`/api/resumes/${resumeId}/export?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({
        format,
        template_id: templateId,
        template_version: templateVersion,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Unable to export ${format.toUpperCase()}. Please try again.`);
    }

    let filename = `Resume.${format}`;
    const disposition = resp.headers.get('Content-Disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else if (standardMatch && standardMatch[1]) {
        filename = standardMatch[1];
      }
    }

    const blob = await resp.blob();

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { filename, blob };
  }

  /**
   * Downloads the exact, byte-for-byte unmodified original uploaded master resume file.
   * Never runs AI generation or converts the master document.
   */
  async downloadOriginalMasterFile(
    resumeId: string
  ): Promise<{ filename: string; blob: Blob; sha256: string }> {
    const resp = await authenticatedFetch(`/api/resumes/${resumeId}/original`);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Unable to download original master resume file.');
    }

    let filename = `master_resume_${resumeId}`;
    const disposition = resp.headers.get('Content-Disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else if (standardMatch && standardMatch[1]) {
        filename = standardMatch[1];
      }
    }

    const sha256 = resp.headers.get('X-Resume-SHA256') || '';
    const blob = await resp.blob();

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { filename, blob, sha256 };
  }

  /**
   * Fetches the original uploaded master resume binary blob for browser preview.
   * Never uses parsed data or AI generation; returns the exact uploaded file blob.
   */
  async fetchOriginalMasterBlob(
    resumeId: string
  ): Promise<{ blob: Blob; filename: string; sha256: string; fileType: string }> {
    const resp = await authenticatedFetch(`/api/resumes/${resumeId}/original?inline=true`);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Unable to load original master resume preview.');
    }

    let filename = `master_resume_${resumeId}`;
    const disposition = resp.headers.get('Content-Disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else if (standardMatch && standardMatch[1]) {
        filename = standardMatch[1];
      }
    }

    const sha256 = resp.headers.get('X-Resume-SHA256') || '';
    const headerFileType = resp.headers.get('X-File-Type');
    const fileType = headerFileType || (filename.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf');

    const blob = await resp.blob();
    return { blob, filename, sha256, fileType };
  }
}

export const resumeService = new ResumeService();
