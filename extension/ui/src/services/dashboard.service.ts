/**
 * TailorResume — Dashboard Service (Module 10)
 * Client service for fetching authenticated dashboard overview metrics and recent activity.
 * Supports automatic fallback calculation from local store when offline.
 */

import { authenticatedFetch } from './api';
import { DashboardOverviewData, RecentActivityItem } from '../types/dashboard';
import { resumeService } from './resume.service';
import { jobsService } from './jobs.service';

class DashboardService {
  /**
   * Fetches authentic dashboard overview counts and chronological recent items.
   * If server is unreachable or unauthenticated, derives metrics from local storage.
   */
  async getOverview(): Promise<DashboardOverviewData> {
    try {
      const resp = await authenticatedFetch('/api/dashboard/overview');
      if (resp.ok) {
        return resp.json();
      }
    } catch (_) {}

    // Fallback: derive counts and activity from local resumes and jobs
    const [resumes, jobs] = await Promise.all([
      resumeService.listResumes().catch(() => []),
      jobsService.listJobs().catch(() => []),
    ]);

    const masterCount = resumes.filter((r) => !r.is_tailored).length;
    const tailoredCount = resumes.filter((r) => r.is_tailored).length;
    const jobCount = jobs.length;

    const recentItems: RecentActivityItem[] = [];
    resumes.slice(0, 5).forEach((r) => {
      recentItems.push({
        id: r.id,
        type: r.is_tailored ? 'tailored_resume' : 'master_resume',
        title: r.name,
        subtitle: r.is_tailored ? 'Tailored application draft' : 'Master application source',
        timestamp: r.updated_at,
        metadata: { is_default: r.is_default },
      });
    });

    jobs.slice(0, 5).forEach((j) => {
      recentItems.push({
        id: j.id,
        type: 'job',
        title: j.job_title,
        subtitle: j.company_name || 'Saved opportunity',
        timestamp: j.updated_at,
      });
    });

    recentItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      status: 'success',
      counts: {
        master_resumes: masterCount,
        tailored_resumes: tailoredCount,
        saved_jobs: jobCount,
      },
      recent_items: recentItems.slice(0, 10),
    };
  }
}

export const dashboardService = new DashboardService();
