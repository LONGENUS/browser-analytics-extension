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
}

export const tailoringService = new TailoringService();
