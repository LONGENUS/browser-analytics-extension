import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Download,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Check,
  RotateCcw,
  ShieldCheck,
  FileText,
  Filter,
  Info,
} from 'lucide-react';
import {
  tailoringService,
  ResumeChangesResponse,
  ResumeChangeItem,
  DiffSegment,
} from '../../services/tailoring.service';

interface TailoredResumeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailoredResumeId: string;
  tailoredResumeName?: string;
  sourceResumeName?: string;
  targetJobTitle?: string;
  onRefresh?: () => void;
}

export const TailoredResumeReviewModal: React.FC<TailoredResumeReviewModalProps> = ({
  isOpen,
  onClose,
  tailoredResumeId,
  tailoredResumeName,
  sourceResumeName,
  targetJobTitle,
  onRefresh,
}) => {
  const [showHighlights, setShowHighlights] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [changesData, setChangesData] = useState<ResumeChangesResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'added' | 'modified' | 'removed'>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && tailoredResumeId) {
      loadChanges();
    }
  }, [isOpen, tailoredResumeId]);

  const loadChanges = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await tailoringService.getTailoredResumeChanges(tailoredResumeId);
      setChangesData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load change tracking data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewChange = async (changeId: string, status: 'accepted' | 'rejected') => {
    setReviewingId(changeId);
    try {
      await tailoringService.reviewTailoredResumeChange(tailoredResumeId, changeId, status);
      // Update local state
      setChangesData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          changes: prev.changes.map((c) =>
            c.id === changeId ? { ...c, status } : c
          ),
        };
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    } finally {
      setReviewingId(null);
    }
  };

  const handleBatchReview = async (action: 'accept_all' | 'reject_all') => {
    setBatchActionLoading(true);
    try {
      await tailoringService.batchReviewChanges(tailoredResumeId, action);
      await loadChanges();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Batch review action failed: ${err.message}`);
    } finally {
      setBatchActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const changes = changesData?.changes || [];
  const counts = changesData?.counts || { added: 0, modified: 0, removed: 0, unchanged: 0 };
  const totalActionable = counts.added + counts.modified + counts.removed;

  const filteredChanges = changes.filter((c) => {
    if (filter === 'all') return true;
    return c.change_type === filter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 1. Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {tailoredResumeName || changesData?.tailored_resume_name || 'Tailored Resume Review'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Source: <strong className="text-slate-700 dark:text-slate-300">{sourceResumeName || changesData?.source_resume_name || 'Master Resume'}</strong></span>
              {targetJobTitle && (
                <>
                  <span>•</span>
                  <span>Target: <strong className="text-slate-700 dark:text-slate-300">{targetJobTitle}</strong></span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle highlights button */}
            <button
              onClick={() => setShowHighlights(!showHighlights)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showHighlights
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title={showHighlights ? 'Hide change highlights' : 'Show change highlights'}
            >
              {showHighlights ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Highlights ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Highlights OFF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Actions & Metrics Toolbar */}
        <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </span>

            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Items ({changes.length})
            </button>

            <button
              onClick={() => setFilter('modified')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filter === 'modified'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Modified ({counts.modified})</span>
            </button>

            <button
              onClick={() => setFilter('added')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filter === 'added'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Added ({counts.added})</span>
            </button>

            {counts.removed > 0 && (
              <button
                onClick={() => setFilter('removed')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  filter === 'removed'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Removed ({counts.removed})</span>
              </button>
            )}
          </div>

          {/* Batch review buttons */}
          {totalActionable > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatchReview('accept_all')}
                disabled={batchActionLoading}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all"
              >
                <Check className="w-3 h-3" />
                <span>Accept All</span>
              </button>
              <button
                onClick={() => handleBatchReview('reject_all')}
                disabled={batchActionLoading}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-red-500 text-red-700 dark:text-red-400 font-semibold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reject All</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Document Content Review Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Comparing tailored draft with source master resume...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
              {error}
            </div>
          ) : filteredChanges.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No changes match the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChanges.map((change) => {
                const isModified = change.change_type === 'modified';
                const isAdded = change.change_type === 'added';
                const isRemoved = change.change_type === 'removed';
                const isUnchanged = change.change_type === 'unchanged';
                const isRejected = change.status === 'rejected';

                // If highlights are OFF, render a clean card
                if (!showHighlights) {
                  // If removed item was rejected, we don't render it in clean view
                  if (isRemoved && change.status === 'accepted') return null;
                  const cleanText = isRejected
                    ? change.original_text || ''
                    : change.proposed_text || change.original_text || '';

                  if (!cleanText.trim()) return null;

                  return (
                    <div
                      key={change.id}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {change.section_title} {change.item_title && `• ${change.item_title}`}
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                        {cleanText}
                      </p>
                    </div>
                  );
                }

                // If highlights are ON:
                return (
                  <div
                    key={change.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isModified
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
                        : isAdded
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                        : isRemoved
                        ? 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800/60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Item Meta Tag & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                          {change.section_title}
                        </span>
                        {change.item_title && (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {change.item_title}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                            isModified
                              ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                              : isAdded
                              ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                              : isRemoved
                              ? 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {change.change_type}
                        </span>

                        {change.status && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              change.status === 'accepted'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {change.status === 'accepted' ? '✓ Accepted' : '✗ Reverted'}
                          </span>
                        )}
                      </div>

                      {/* Individual Review Actions */}
                      {!isUnchanged && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReviewChange(change.id, 'accepted')}
                            disabled={reviewingId === change.id || change.status === 'accepted'}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                              change.status === 'accepted'
                                ? 'bg-emerald-600 text-white opacity-80 cursor-default'
                                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={() => handleReviewChange(change.id, 'rejected')}
                            disabled={reviewingId === change.id || change.status === 'rejected'}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                              change.status === 'rejected'
                                ? 'bg-red-600 text-white opacity-80 cursor-default'
                                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Revert</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diff Segment Highlighter */}
                    <div className="text-xs leading-relaxed font-sans text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80">
                      {isModified ? (
                        <div>
                          {change.diff_segments.map((seg, sIdx) => {
                            if (seg.type === 'removed') {
                              return (
                                <del
                                  key={sIdx}
                                  className="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 line-through px-1 py-0.5 rounded mx-0.5"
                                >
                                  {seg.text}
                                </del>
                              );
                            } else if (seg.type === 'added') {
                              return (
                                <ins
                                  key={sIdx}
                                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 no-underline font-semibold px-1 py-0.5 rounded mx-0.5"
                                >
                                  {seg.text}
                                </ins>
                              );
                            } else {
                              return <span key={sIdx}>{seg.text}</span>;
                            }
                          })}
                        </div>
                      ) : isAdded ? (
                        <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                          + {change.proposed_text}
                        </div>
                      ) : isRemoved ? (
                        <div className="line-through text-red-700 dark:text-red-400">
                          - {change.original_text}
                        </div>
                      ) : (
                        <div className="text-slate-700 dark:text-slate-300">
                          {change.proposed_text || change.original_text}
                        </div>
                      )}
                    </div>

                    {/* Explanation */}
                    {change.explanation && (
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{change.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Footer: Clean Download Guarantee & Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Clean Download Guarantee:</strong> Downloaded files contain only final accepted resume content without review colors, strikethroughs or annotations.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                window.open(`/api/resumes/${tailoredResumeId}/export?format=pdf`, '_blank');
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={() => {
                window.open(`/api/resumes/${tailoredResumeId}/export?format=docx`, '_blank');
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download DOCX</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
