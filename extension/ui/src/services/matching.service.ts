/**
 * TailorResume — Job Match Service (Module 5)
 * Client-side communication service for deterministic Job-Resume match analysis.
 * Uses authenticatedFetch with automatic Bearer token injection.
 */

import { authenticatedFetch } from './api';
import { JobMatchResult, JobMatchSummary } from '../types/match';

export interface ATSScoreResult {
  match_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  job_description: string;
  resume_id: string;
  resume_name: string;
  overall_score: number;
  missing_requirements: string[];
  created_at: string;
}

export class MatchingService {
  /**
   * Primary ATS scoring endpoint: calculates deterministic ATS score
   * from manual pasted job description and selected master resume.
   */
  async calculateATSScore(
    resumeId: string,
    jobDescription: string,
    jobTitle?: string,
    companyName?: string
  ): Promise<ATSScoreResult> {
    const resp = await authenticatedFetch('/api/job-matches/calculate-ats-score', {
      method: 'POST',
      body: JSON.stringify({
        resume_id: resumeId,
        job_description: jobDescription,
        job_title: jobTitle,
        company_name: companyName,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `ATS scoring failed (${resp.status})`);
    }

    return resp.json();
  }

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
