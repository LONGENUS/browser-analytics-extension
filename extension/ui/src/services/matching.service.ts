/**
 * TailorResume — Job Match Service (Module 5)
 * Client-side communication service for deterministic Job-Resume match analysis.
 * Uses authenticatedFetch with automatic Bearer token injection.
 */

import { authenticatedFetch } from './api';
import { JobMatchResult, JobMatchSummary } from '../types/match';

export class MatchingService {
  /**
   * Triggers or retrieves deterministic job-resume match analysis.
   */
  async analyzeJobMatch(
    jobId: string,
    resumeId: string,
    forceRecalculate: boolean = false
  ): Promise<JobMatchResult> {
    const resp = await authenticatedFetch(`/api/jobs/${jobId}/match`, {
      method: 'POST',
      body: JSON.stringify({
        resume_id: resumeId,
        force_recalculate: forceRecalculate,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Match analysis failed (${resp.status})`);
    }

    return resp.json();
  }

  /**
   * Lists past match analyses for a saved job.
   */
  async listJobMatches(jobId: string): Promise<JobMatchSummary[]> {
    const resp = await authenticatedFetch(`/api/jobs/${jobId}/matches`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch match history (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Fetches full details of a specific match analysis.
   */
  async getMatchDetail(matchId: string): Promise<JobMatchResult> {
    const resp = await authenticatedFetch(`/api/jobs/matches/${matchId}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to load match detail (${resp.status})`);
    }
    return resp.json();
  }

  /**
   * Deletes a match analysis record.
   */
  async deleteJobMatch(matchId: string): Promise<void> {
    const resp = await authenticatedFetch(`/api/jobs/matches/${matchId}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete match analysis (${resp.status})`);
    }
  }
}

export const matchingService = new MatchingService();
