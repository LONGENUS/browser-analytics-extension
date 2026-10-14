import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Briefcase,
  Plus,
  Upload,
  ArrowRight,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building,
  Star,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { dashboardService } from '../../services/dashboard.service';
import { DashboardOverviewData, RecentActivityItem } from '../../types/dashboard';
import { TabKey } from '../TabBar';

import { AuthState } from '../../services/auth';

interface DashboardOverviewProps {
  onNavigateTab: (tab: TabKey) => void;
  onOpenCreateResume: () => void;
  onOpenImportResume: () => void;
  onOpenResumePreview?: (resumeId: string) => void;
  onOpenResumeEdit?: (resumeId: string) => void;
  authState?: AuthState;
  onOpenAuth?: (view?: 'login' | 'register') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  onOpenCreateResume,
  onOpenImportResume,
  onOpenResumePreview,
  onOpenResumeEdit,
  authState,
  onOpenAuth,
}) => {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const overview = await dashboardService.getOverview();
      setData(overview);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard overview.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatActivityTime = (isoStr: string | null) => {
    if (!isoStr) return 'Recently';
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleActivityClick = (item: RecentActivityItem) => {
    if (item.type === 'master_resume') {
      if (onOpenResumeEdit) {
        onOpenResumeEdit(item.id);
      } else {
        onNavigateTab('resumes');
      }
    } else if (item.type === 'tailored_resume') {
      onNavigateTab('tailored');
    } else if (item.type === 'job') {
      onNavigateTab('jobs');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Skeletons */}
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-4"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-4" />
      </div>
    );
  }

  const counts = data?.counts || { master_resumes: 0, tailored_resumes: 0, saved_jobs: 0 };
  const recentItems = data?.recent_items || [];
  const isBrandNewUser = counts.master_resumes === 0 && counts.saved_jobs === 0 && counts.tailored_resumes === 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Guest / Unauthenticated Welcome Callout */}
      {authState !== 'logged_in' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Sign in to unlock full cloud synchronization</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Create an account or log in to sync your master resumes, tailored drafts, and saved jobs across devices.
            </p>
          </div>
          <button
            onClick={() => onOpenAuth?.('login')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all shrink-0 cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      )}

      {error && authState === 'logged_in' && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <span>{error}</span>
          <button onClick={loadData} className="font-semibold underline hover:no-underline">Retry</button>
        </div>
      )}
      {/* 1. Welcome & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Career Command Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Centralized overview of your master profile, targeted resumes, and saved job opportunities.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
          title="Refresh dashboard metrics"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Authentic Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Master Resumes Card */}
        <div
          onClick={() => onNavigateTab('resumes')}
          className="group cursor-pointer p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-2xs hover:shadow-md transition-all flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Master Resumes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {counts.master_resumes}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {counts.master_resumes === 1 ? 'source' : 'sources'}
              </span>
            </div>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center gap-1 pt-1">
              <span>Manage Resumes</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Tailored Resumes Card */}
        <div
          onClick={() => onNavigateTab('tailored')}
          className="group cursor-pointer p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 shadow-2xs hover:shadow-md transition-all flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tailored Resumes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {counts.tailored_resumes}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {counts.tailored_resumes === 1 ? 'version' : 'versions'}
              </span>
            </div>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold group-hover:underline flex items-center gap-1 pt-1">
              <span>View History</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* Saved Jobs Card */}
        <div
          onClick={() => onNavigateTab('jobs')}
          className="group cursor-pointer p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 shadow-2xs hover:shadow-md transition-all flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Saved Jobs
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {counts.saved_jobs}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {counts.saved_jobs === 1 ? 'listing' : 'listings'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline flex items-center gap-1 pt-1">
              <span>Browse Library</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. High-Value Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenCreateResume}
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Create Resume</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Start fresh draft</div>
          </button>

          <button
            onClick={onOpenImportResume}
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Import Resume</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Upload PDF or DOCX</div>
          </button>

          <button
            onClick={() => onNavigateTab('tailor')}
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-left transition-all group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Tailor a Resume</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Adapt for active job</div>
          </button>

          <button
            onClick={() => onNavigateTab('jobs')}
            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">View Saved Jobs</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Review job postings</div>
          </button>
        </div>
      </div>

      {/* 4. Recent Activity (Chronological Persisted Records) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Recent Activity</span>
          </h2>
          {recentItems.length > 0 && (
            <span className="text-[11px] text-slate-400">
              Showing last {recentItems.length} items
            </span>
          )}
        </div>

        {isBrandNewUser ? (
          /* Empty State for New User */
          <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3 bg-white/60 dark:bg-slate-900/60">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Welcome to your Resume Dashboard!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Get started by creating your master resume or uploading an existing document.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={onOpenCreateResume}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Master Resume</span>
              </button>
              <button
                onClick={onOpenImportResume}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import Existing</span>
              </button>
            </div>
          </div>
        ) : recentItems.length === 0 ? (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 bg-white dark:bg-slate-900">
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            {recentItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleActivityClick(item)}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === 'master_resume'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        : item.type === 'tailored_resume'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {item.type === 'master_resume' ? (
                      <FileText className="w-4 h-4" />
                    ) : item.type === 'tailored_resume' ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Briefcase className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h4>
                      {item.metadata?.is_default && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatActivityTime(item.timestamp)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
