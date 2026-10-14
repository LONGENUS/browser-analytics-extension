import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  CheckCheck,
  Loader2,
  Sliders,
  FileText,
  Briefcase,
  Layers,
  Wand2,
} from 'lucide-react';
import { tailoringService } from '../../services/tailoring.service';
import { resumeService } from '../../services/resume.service';
import { ResumeSummaryItem, FullStructuredResume } from '../../types/resume';
import { Job } from '../../types/job';
import {
  TailoringOptions,
  TailoringDraftResult,
  ChangeLogItem,
  TailoringMode,
} from '../../types/tailoring';

interface ResumeTailorModalProps {
  job: Job;
  initialResumeId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (tailoredResumeId: string) => void;
}

export const ResumeTailorModal: React.FC<ResumeTailorModalProps> = ({
  job,
  initialResumeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  // --- Form & Options State ---
  const [resumes, setResumes] = useState<ResumeSummaryItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId || '');
  const [tailoringMode, setTailoringMode] = useState<TailoringMode>('balanced');
  const [prioritizeSkills, setPrioritizeSkills] = useState<boolean>(true);
  const [prioritizeExperience, setPrioritizeExperience] = useState<boolean>(true);
  const [prioritizeProjects, setPrioritizeProjects] = useState<boolean>(true);
  const [adaptSummary, setAdaptSummary] = useState<boolean>(true);
  const [conciseMode, setConciseMode] = useState<boolean>(false);
  const [bulletRewriting, setBulletRewriting] = useState<TailoringMode>('balanced');

  // --- Pipeline & Step State ---
  const [step, setStep] = useState<'options' | 'generating' | 'review'>('options');
  const [loadingStage, setLoadingStage] = useState<string>('Preparing your resume...');
  const [isLoadingResumes, setIsLoadingResumes] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Draft Result State ---
  const [draftResult, setDraftResult] = useState<TailoringDraftResult | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogItem[]>([]);
  const [tailoredName, setTailoredName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load available resumes on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchResumes = async () => {
      setIsLoadingResumes(true);
      setError(null);
      try {
        const list = await resumeService.listResumes();
        if (isMounted) {
          setResumes(list);
          if (initialResumeId && list.some((r) => r.id === initialResumeId)) {
            setSelectedResumeId(initialResumeId);
          } else {
            const master = list.find((r) => r.is_default) || list[0];
            if (master) setSelectedResumeId(master.id);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load resumes');
      } finally {
        if (isMounted) setIsLoadingResumes(false);
      }
    };

    fetchResumes();
  }, [isOpen, initialResumeId]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep('options');
      setDraftResult(null);
      setChangeLog([]);
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Handle Draft Generation ---
  const handleGenerateDraft = async () => {
    if (!selectedResumeId) {
      setError('Please select a base resume first.');
      return;
    }

    setStep('generating');
    setError(null);

    // Staged loading feedback
    setLoadingStage('Analyzing target job and source resume...');
    const stageTimer1 = setTimeout(() => {
      setLoadingStage('Prioritizing relevant skills and experience...');
    }, 600);
    const stageTimer2 = setTimeout(() => {
      setLoadingStage('Adapting professional summary & verifying facts...');
    }, 1200);

    try {
      const options: TailoringOptions = {
        job_id: job.id,
        tailoring_mode: tailoringMode,
        prioritize_skills: prioritizeSkills,
        prioritize_experience_bullets: prioritizeExperience,
        prioritize_projects: prioritizeProjects,
        adapt_summary: adaptSummary,
        concise_mode: conciseMode,
        bullet_rewriting: bulletRewriting,
      };

      const result = await tailoringService.generateTailoredDraft(selectedResumeId, options);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      setDraftResult(result);
      setChangeLog(result.change_log || []);

      const baseResume = resumes.find((r) => r.id === selectedResumeId);
      const baseName = baseResume?.name || 'Resume';
      const companyPart = job.company_name ? `${job.company_name} — ` : '';
      setTailoredName(`${baseName} — ${companyPart}${job.job_title}`);

      setStep('review');
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setError(err.message || 'Failed to generate tailored resume draft. Your original resume is unchanged.');
      setStep('options');
    }
  };

  // --- Change Review Actions ---
  const handleAcceptChange = (index: number) => {
    setChangeLog((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'accepted' as const } : c))
    );
  };

  const handleRejectChange = (index: number) => {
    setChangeLog((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'rejected' as const } : c))
    );
  };

  const handleAcceptAllSafe = () => {
    setChangeLog((prev) =>
      prev.map((c) => (c.is_safe ? { ...c, status: 'accepted' as const } : c))
    );
  };

  const handleRevertAll = () => {
    setChangeLog((prev) =>
      prev.map((c) => ({ ...c, status: 'rejected' as const }))
    );
  };

  // --- Handle Save Final Tailored Resume ---
  const handleSaveTailoredResume = async () => {
    if (!draftResult) return;
    if (!tailoredName.trim()) {
      setError('Please provide a name for the tailored resume.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Re-apply only accepted changes onto the drafted structured resume
      const finalResume: FullStructuredResume = JSON.parse(
        JSON.stringify(draftResult.tailored_resume)
      );

      // If summary adaptation was rejected by user, revert to source summary
      const summaryChange = changeLog.find((c) => c.section === 'summary');
      if (summaryChange && summaryChange.status === 'rejected') {
        if (finalResume.summary) {
          finalResume.summary.summary = draftResult.source_resume.summary?.summary || '';
        }
      }

      // If bullet rewrites were rejected, revert those specific bullets
      for (const change of changeLog) {
        if (change.section === 'experiences' && change.status === 'rejected' && change.item_id) {
          for (const exp of finalResume.experiences) {
            for (const b of exp.bullets) {
              if (b.id === change.item_id || b.content === change.tailored) {
                b.content = change.original;
              }
            }
          }
        }
      }

      const savePayload = {
        job_id: job.id,
        name: tailoredName.trim(),
        tailored_resume: finalResume,
        change_log: changeLog,
        tailoring_mode: tailoringMode,
        original_match_score: draftResult.original_match_score,
        tailored_match_score: draftResult.tailored_match_score,
      };

      const resp = await tailoringService.saveTailoredResume(selectedResumeId, savePayload);
      if (onSaved) {
        onSaved(resp.tailored_resume_id);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save tailored resume. Your master resume is untouched.');
    } finally {
      setIsSaving(false);
    }
  };

  const acceptedCount = changeLog.filter((c) => c.status === 'accepted').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* --- Header --- */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Job-Specific Resume Tailoring
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                  Module 6
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                Target: <span className="font-semibold text-slate-700 dark:text-slate-300">{job.job_title}</span>
                {job.company_name ? ` at ${job.company_name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* --- Error Banner --- */}
        {error && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">Notice</p>
              <p className="text-[11px] leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* --- Content Area --- */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* STEP 1: OPTIONS FORM */}
          {step === 'options' && (
            <div className="space-y-4">
              
              {/* Base Resume Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Base Resume (Immutable Source)
                </label>
                {isLoadingResumes ? (
                  <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ) : (
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.is_default ? '★ (Master Resume)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                  Your base resume will never be modified. A separate tailored draft will be created.
                </p>
              </div>

              {/* Tailoring Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  Tailoring Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['conservative', 'balanced', 'strong'] as TailoringMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setTailoringMode(mode);
                        setBulletRewriting(mode);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        tailoringMode === mode
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 ring-1 ring-purple-500'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-xs capitalize text-slate-900 dark:text-white flex items-center justify-between">
                        {mode}
                        {mode === 'balanced' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {mode === 'conservative'
                          ? 'Strict reordering & emphasis. Zero rewriting.'
                          : mode === 'balanced'
                          ? 'Reorder, adapt summary, controlled bullet refinement.'
                          : 'Maximum alignment strictly within verified source facts.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tailoring Strategies Checkboxes */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Tailoring Actions
                </span>

                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prioritizeSkills}
                      onChange={(e) => setPrioritizeSkills(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Prioritize relevant skills (matches moved first; missing skills never added)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prioritizeExperience}
                      onChange={(e) => setPrioritizeExperience(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Prioritize relevant experience bullets (high-relevance achievements first)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prioritizeProjects}
                      onChange={(e) => setPrioritizeProjects(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Prioritize relevant projects</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adaptSummary}
                      onChange={(e) => setAdaptSummary(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Adapt professional summary (highlight only candidate's verified skills)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conciseMode}
                      onChange={(e) => setConciseMode(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Concise mode (focus on highest-relevance achievements)</span>
                  </label>
                </div>
              </div>

              {/* Strict Integrity Guarantee Note */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p>
                  <strong>Zero-Fabrication Guarantee:</strong> The system will never invent metrics, employers, job titles, or missing skills. All tailored suggestions are strictly validated against your base resume data.
                </p>
              </div>

            </div>
          )}

          {/* STEP 2: GENERATING SPINNER */}
          {step === 'generating' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400 absolute inset-0 m-auto" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tailoring Resume Draft
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono animate-pulse">
                  {loadingStage}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW CHANGES DIFF */}
          {step === 'review' && draftResult && (
            <div className="space-y-4">

              {/* Match Score Improvement Pill */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Job Match Alignment
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold font-mono">
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Original: {draftResult.original_match_score ?? '—'}%
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                  <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Tailored: {draftResult.tailored_match_score ?? '—'}%
                  </span>
                </div>
              </div>

              {/* Resume Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tailored Resume Name
                </label>
                <input
                  type="text"
                  value={tailoredName}
                  onChange={(e) => setTailoredName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Bulk Actions Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Proposed Changes ({acceptedCount}/{changeLog.length} Accepted)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptAllSafe}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Accept All Safe
                  </button>
                  <button
                    type="button"
                    onClick={handleRevertAll}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Revert All
                  </button>
                </div>
              </div>

              {/* Changes List */}
              {changeLog.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  <p className="text-xs text-slate-500">
                    No changes needed. Your resume is already optimally aligned with this job!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {changeLog.map((change, index) => (
                    <div
                      key={change.id || index}
                      className={`p-3 rounded-xl border transition-all ${
                        change.status === 'accepted'
                          ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60'
                      }`}
                    >
                      {/* Change Top Meta */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {change.section}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              change.is_safe
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {change.is_safe ? 'Safe Change' : 'Review Wording'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-[200px]">
                            {change.reason}
                          </span>
                        </div>

                        {/* Accept / Reject Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptChange(index)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              change.status === 'accepted'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectChange(index)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              change.status === 'rejected'
                                ? 'bg-rose-600 text-white'
                                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>

                      {/* Diff Comparison */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Original
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans line-clamp-4">
                            {change.original}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-1">
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
                            Tailored Suggestion
                          </span>
                          <p className="text-slate-900 dark:text-white leading-relaxed font-sans line-clamp-4 font-medium">
                            {change.tailored}
                          </p>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

        {/* --- Footer Controls --- */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          {step === 'options' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={isLoadingResumes || !selectedResumeId}
                className="py-1.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Tailored Draft</span>
              </button>
            </>
          ) : step === 'generating' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setStep('options')}
                className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('options')}
                className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Back to Options
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Discard Draft
                </button>
                <button
                  type="button"
                  onClick={handleSaveTailoredResume}
                  disabled={isSaving || !tailoredName.trim()}
                  className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Tailored Resume</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
