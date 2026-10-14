/**
 * TailorResume — Resume Tailoring Service (Module 6)
 * Client-side communication service for deterministic and AI-assisted resume tailoring.
 * Interacts with backend API under /api/resumes/{resume_id}/tailor endpoints.
 */

import { authenticatedFetch } from './api';
import {
  TailoringOptions,
  TailoringDraftResult,
  SaveTailoredResumeInput,
  SaveTailoredResumeResponse,
  TailoredResumeMetadata,
} from '../types/tailoring';

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

export interface ResumeChangeItem {
  id: string;
  source_resume_id: string;
  tailored_resume_id: string;
  section: string;
  paragraph_id: string;
  section_title: string;
  item_title?: string;
  change_type: 'added' | 'modified' | 'removed' | 'unchanged';
  original_text?: string;
  proposed_text?: string;
  diff_segments: DiffSegment[];
  explanation?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface ResumeChangesResponse {
  status: string;
  tailored_resume_id: string;
  tailored_resume_name: string;
  source_resume_id: string;
  source_resume_name: string;
  total_changes: number;
  counts: {
    added: number;
    modified: number;
    removed: number;
    unchanged: number;
  };
  changes: ResumeChangeItem[];
}

export class TailoringService {
  /**
   * Generates an in-memory job-specific tailored draft without modifying the master resume.
   */
  async generateTailoredDraft(
    resumeId: string,
    options: TailoringOptions
  ): Promise<TailoringDraftResult> {
    const resp = await authenticatedFetch(`/api/resumes/${resumeId}/tailor`, {
      method: 'POST',
      body: JSON.stringify(options),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Tailoring draft generation failed (${resp.status})`);
    }

    return resp.json();
  }

  /**
   * Saves the reviewed tailored resume draft as a brand new separate resume entity.
   */
  async saveTailoredResume(
    resumeId: string,
    input: SaveTailoredResumeInput
  ): Promise<SaveTailoredResumeResponse> {
    const resp = await authenticatedFetch(`/api/resumes/${resumeId}/tailor/save`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to save tailored resume (${resp.status})`);
    }

    return resp.json();
  }

  /**
   * Retrieves all tailored resume records for the user.
   */
  async listTailoredResumes(): Promise<TailoredResumeMetadata[]> {
    try {
      const resp = await authenticatedFetch('/api/resumes/tailored');
      if (resp.ok) {
        return resp.json();
      }
    } catch (_) {}
    return [];
  }

  /**
   * Retrieves full change log and metadata for a specific tailored resume.
   */
  async getTailoredResumeDetail(tailoringId: string): Promise<TailoredResumeMetadata> {
    const resp = await authenticatedFetch(`/api/resumes/tailored/${tailoringId}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to load tailored resume detail (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Deletes a tailored resume and its associated record.
   */
  async deleteTailoredResume(tailoringId: string): Promise<{ deleted: boolean; id: string }> {
    const resp = await authenticatedFetch(`/api/resumes/tailored/${tailoringId}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete tailored resume (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Directly generates and persists a tailored resume from master resume and job description.
   */
  async directTailorResume(
    resumeId: string,
    jobId: string,
    name?: string
  ): Promise<{
    status: string;
    message: string;
    tailored_resume_id: string;
    name: string;
    source_resume_id: string;
    source_resume_name: string;
    target_job_id: string;
    target_job_title: string;
    target_company_name: string;
    preview_url: string;
    download_pdf_url: string;
    download_docx_url: string;
    created_at: string;
  }> {
    const resp = await authenticatedFetch('/api/tailoring/direct-tailor', {
      method: 'POST',
      body: JSON.stringify({
        resume_id: resumeId,
        job_id: jobId,
        name: name,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Direct tailoring failed (${resp.status})`);
    }

    return resp.json();
  }

  /**
   * Retrieves complete AI change tracking records for a tailored resume.
   */
  async getTailoredResumeChanges(resumeId: string): Promise<ResumeChangesResponse> {
    const resp = await authenticatedFetch(`/api/tailoring/${resumeId}/changes`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch resume changes (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Reviews (accepts or rejects) an individual AI change.
   */
  async reviewTailoredResumeChange(
    resumeId: string,
    changeId: string,
    status: 'accepted' | 'rejected'
  ): Promise<{ status: string; message: string; change: ResumeChangeItem }> {
    const resp = await authenticatedFetch(`/api/tailoring/${resumeId}/changes/${changeId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to review change (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Accepts or rejects all AI changes in batch.
   */
  async batchReviewChanges(
    resumeId: string,
    action: 'accept_all' | 'reject_all'
  ): Promise<{ status: string; action: string; affected_count: number }> {
    const resp = await authenticatedFetch(`/api/tailoring/${resumeId}/review-batch`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to batch review changes (${resp.status})`);
    }
    return resp.json();
  }
}

export const tailoringService = new TailoringService();
