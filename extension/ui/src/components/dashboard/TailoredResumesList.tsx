import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  Calendar,
  Building,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Layers,
  FileCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { tailoringService } from '../../services/tailoring.service';
import { resumeService } from '../../services/resume.service';
import { TailoredResumeMetadata, ChangeLogItem } from '../../types/tailoring';
import { FullStructuredResume } from '../../types/resume';
import { ResumePreview } from '../resume/ResumePreview';

interface TailoredResumesListProps {
  onNavigateToJobs?: () => void;
  onNavigateToTailor?: () => void;
}

export const TailoredResumesList: React.FC<TailoredResumesListProps> = ({
  onNavigateToJobs,
  onNavigateToTailor,
}) => {
  const [items, setItems] = useState<TailoredResumeMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Sort
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent_created' | 'recent_updated' | 'company' | 'name'>('recent_created');

  // Preview Modal
  const [previewResume, setPreviewResume] = useState<FullStructuredResume | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // Review Changes Modal
  const [reviewItem, setReviewItem] = useState<TailoredResumeMetadata | null>(null);

  // Export State
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<TailoredResumeMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadTailoredResumes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tailoringService.listTailoredResumes();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load tailored resumes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTailoredResumes();
  }, []);

  // --- Actions ---

  const handleOpenPreview = async (item: TailoredResumeMetadata) => {
    const targetResumeId = item.tailored_resume_id || item.resume_id || item.id;
    setIsLoadingPreview(true);
    try {
      const full = await resumeService.getResume(targetResumeId);
      setPreviewResume(full);
    } catch (err: any) {
      showNotification(err.message || 'Failed to open preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExport = async (item: TailoredResumeMetadata, format: 'pdf' | 'docx') => {
    const targetResumeId = item.tailored_resume_id || item.resume_id || item.id;
    setExportingId(targetResumeId);
    setExportFormat(format);
    try {
      const result = await resumeService.exportResume(
        targetResumeId,
        format,
        item.template_id || 'ats-classic',
        item.template_version || 'v1.0.0'
      );
      showNotification(`Downloaded ${result.filename}`);
    } catch (err: any) {
      showNotification(err.message || `Failed to download ${format.toUpperCase()}.`);
    } finally {
      setExportingId(null);
      setExportFormat(null);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await tailoringService.deleteTailoredResume(itemToDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setItemToDelete(null);
      showNotification('Tailored resume deleted.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete tailored resume.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Filtering & Sorting ---
  const filteredItems = items
    .filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const title = (item.name || item.tailored_resume_name || '').toLowerCase();
      const jobTitle = (item.target_job_title || '').toLowerCase();
      const company = (item.target_company_name || '').toLowerCase();
      const source = (item.source_resume_name || '').toLowerCase();
      return (
        title.includes(q) ||
        jobTitle.includes(q) ||
        company.includes(q) ||
        source.includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'recent_created') {
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      }
      if (sortBy === 'recent_updated') {
        return new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime();
      }
      if (sortBy === 'company') {
        const compA = a.target_company_name || '';
        const compB = b.target_company_name || '';
        return compA.localeCompare(compB);
      }
      if (sortBy === 'name') {
        const nameA = a.name || a.tailored_resume_name || '';
        const nameB = b.name || b.tailored_resume_name || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

  // If in Preview Mode, render Module 7 Preview
  if (previewResume) {
    return (
      <ResumePreview
        resume={previewResume}
        onBack={() => setPreviewResume(null)}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Tailored Resumes History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            View, review changes, and export your saved job-specific resume adaptations.
          </p>
        </div>

        {onNavigateToTailor && (
          <button
            onClick={onNavigateToTailor}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-2xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tailor New Resume</span>
          </button>
        )}
      </div>

      {/* 2. Notifications */}
      {notification && (
        <div className="p-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadTailoredResumes}
            className="text-[11px] font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tailored resumes, jobs, companies..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-purple-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] text-slate-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="recent_created">Recently Created</option>
            <option value="recent_updated">Recently Updated</option>
            <option value="company">Company Name</option>
            <option value="name">Resume Title</option>
          </select>
        </div>
      </div>

      {/* 4. List / Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse p-4"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3 bg-white/50 dark:bg-slate-900/40 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No tailored resumes yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Tailored resumes are created when you customize your master resume for a specific job posting.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            {onNavigateToTailor && (
              <button
                onClick={onNavigateToTailor}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-2xs transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tailor Active Job</span>
              </button>
            )}
            {onNavigateToJobs && (
              <button
                onClick={onNavigateToJobs}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5"
              >
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Browse Saved Jobs</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        /* No search results */
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No tailored resumes match &quot;{searchQuery}&quot;.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 underline"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const hasScoreImprovement =
              item.original_match_score !== null &&
              item.original_match_score !== undefined &&
              item.tailored_match_score !== null &&
              item.tailored_match_score !== undefined;

            return (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Top: Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>{item.tailoring_mode || 'Balanced'} Mode</span>
                    </span>

                    {/* Score Improvement Badge */}
                    {hasScoreImprovement && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {item.original_match_score}% → {item.tailored_match_score}% Match
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <h3
                      onClick={() => handleOpenPreview(item)}
                      className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 cursor-pointer transition-colors line-clamp-1"
                      title={item.name || item.tailored_resume_name || 'Tailored Resume'}
                    >
                      {item.name || item.tailored_resume_name || 'Tailored Resume'}
                    </h3>

                    {/* Target Job Info */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-1">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {item.target_job_deleted ? (
                        <span className="text-slate-400 italic text-[11px]">
                          Target job listing removed
                        </span>
                      ) : item.target_job_title ? (
                        <span className="truncate">
                          <strong>{item.target_job_title}</strong>
                          {item.target_company_name && ` at ${item.target_company_name}`}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Target Job</span>
                      )}
                    </div>

                    {/* Source Resume Info */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {item.source_resume_deleted ? (
                        <span className="text-slate-400 italic">
                          Source master resume removed
                        </span>
                      ) : item.source_resume_name ? (
                        <span className="truncate">
                          From: {item.source_resume_name}
                        </span>
                      ) : (
                        <span>Master Resume</span>
                      )}
                    </div>
                  </div>

                  {/* Stale Warning Banner */}
                  {item.is_stale && (
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Source resume was modified after this tailoring was saved.
                      </span>
                    </div>
                  )}

                  {/* Template & Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {(item.template_id || 'ats-classic').replace('-', ' ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Card Bottom: Actions */}
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    {/* Review Changes */}
                    {item.change_log && item.change_log.length > 0 && (
                      <button
                        onClick={() => setReviewItem(item)}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        title="Review Accepted Changes"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Changes ({item.change_log.length})</span>
                      </button>
                    )}

                    {/* Preview */}
                    <button
                      onClick={() => handleOpenPreview(item)}
                      disabled={isLoadingPreview}
                      className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Preview Tailored Resume"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* PDF Export */}
                    <button
                      onClick={() => handleExport(item, 'pdf')}
                      disabled={exportingId === (item.tailored_resume_id || item.resume_id || item.id) && exportFormat === 'pdf'}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors disabled:opacity-50"
                      title="Download PDF"
                    >
                      {exportingId === (item.tailored_resume_id || item.resume_id || item.id) && exportFormat === 'pdf' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      ) : (
                        <span className="text-[10px] font-bold">PDF</span>
                      )}
                    </button>

                    {/* DOCX Export */}
                    <button
                      onClick={() => handleExport(item, 'docx')}
                      disabled={exportingId === (item.tailored_resume_id || item.resume_id || item.id) && exportFormat === 'docx'}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
                      title="Download DOCX"
                    >
                      {exportingId === (item.tailored_resume_id || item.resume_id || item.id) && exportFormat === 'docx' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <span className="text-[10px] font-bold">DOCX</span>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Tailored Resume"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Review Changes Modal */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Tailoring Change Log
                </h3>
              </div>
              <button
                onClick={() => setReviewItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-300 text-xs">
                <strong>{reviewItem.name || reviewItem.tailored_resume_name}</strong>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                  Tailoring mode: <strong>{reviewItem.tailoring_mode}</strong> •{' '}
                  {reviewItem.change_log?.length || 0} modifications applied
                </p>
              </div>

              {(!reviewItem.change_log || reviewItem.change_log.length === 0) ? (
                <p className="text-slate-400 text-center py-6">
                  No individual change log recorded for this version.
                </p>
              ) : (
                <div className="space-y-2">
                  {reviewItem.change_log.map((change, idx) => (
                    <div
                      key={change.id || idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                          {change.section} • {change.type}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          Accepted
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                        {change.reason}
                      </p>
                      {change.original && (
                        <div className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-[11px] font-mono">
                          <span className="font-bold block text-[10px] uppercase text-rose-600">Original:</span>
                          {change.original}
                        </div>
                      )}
                      {change.tailored && (
                        <div className="p-2 rounded bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-mono">
                          <span className="font-bold block text-[10px] uppercase text-emerald-600">Tailored:</span>
                          {change.tailored}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setReviewItem(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Delete Tailored Resume?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong>&quot;{itemToDelete.name || itemToDelete.tailored_resume_name}&quot;</strong>? This
              will remove this tailored version and its history. Your master resume will remain intact.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
