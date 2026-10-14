/**
 * TailorResume — Dashboard Types (Module 10)
 * Type definitions for authentic overview metrics and activity feeds.
 */

export interface DashboardCounts {
  master_resumes: number;
  tailored_resumes: number;
  saved_jobs: number;
}

export type RecentActivityType = 'master_resume' | 'tailored_resume' | 'job';

export interface RecentActivityItem {
  id: string;
  type: RecentActivityType;
  title: string;
  subtitle: string;
  timestamp: string | null;
  metadata?: Record<string, any>;
}

export interface DashboardOverviewData {
  status: string;
  counts: DashboardCounts;
  recent_items: RecentActivityItem[];
}
