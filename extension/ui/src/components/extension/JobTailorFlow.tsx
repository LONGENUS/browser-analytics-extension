import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Briefcase,
  Building,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  FileText,
  Loader2,
  Download,
  FileDown,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  X,
  Plus,
  Upload,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { jobsService } from '../../services/jobs.service';
import { matchingService } from '../../services/matching.service';
import { tailoringService } from '../../services/tailoring.service';
import { resumeService } from '../../services/resume.service';
import { sanitizeUrl } from '../resume/templates/templateRegistry';
import { Job, JobCreateInput, JobExtractionResult, JobSource } from '../../types/job';
import { ResumeSummaryItem, FullStructuredResume } from '../../types/resume';
import { JobMatchResult } from '../../types/match';
import { TailoringMode, TailoringDraftResult, ChangeLogItem } from '../../types/tailoring';
import { AuthUser } from '../../services/auth';
import { ResumePreview } from '../resume/ResumePreview';

interface JobTailorFlowProps {
  currentUser: AuthUser | null;
  onOpenAuth: (view?: 'login' | 'register', prompt?: string) => void;
  onNavigateToResumes: () => void;
}

export const JobTailorFlow: React.FC<JobTailorFlowProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateToResumes,
}) => {
  // --- Active Tab & Detection State ---
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectedUrl, setDetectedUrl] = useState<string>('');
  const [isJobDetected, setIsJobDetected] = useState<boolean>(false);
  const [detectionSource, setDetectionSource] = useState<JobSource>('other');

  // --- Job Form State ---
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [isEditingJob, setIsEditingJob] = useState<boolean>(false);
  const [jobTitle, setJobTitle] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [savedJob, setSavedJob] = useState<Job | null>(null);
  const [isSavingJob, setIsSavingJob] = useState<boolean>(false);

  // --- Resume Selection State ---
  const [resumes, setResumes] = useState<ResumeSummaryItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isLoadingResumes, setIsLoadingResumes] = useState<boolean>(false);

  // --- Match State (Module 5) ---
  const [isAnalyzingMatch, setIsAnalyzingMatch] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [isMatchDetailsExpanded, setIsMatchDetailsExpanded] = useState<boolean>(false);

  // --- Tailoring State (Module 6) ---
  const [tailoringMode, setTailoringMode] = useState<TailoringMode>('balanced');
  const [isTailoring, setIsTailoring] = useState<boolean>(false);
  const [tailorStep, setTailorStep] = useState<string>('');
  const [draftResult, setDraftResult] = useState<TailoringDraftResult | null>(null);
  const [tailoredResumeId, setTailoredResumeId] = useState<string | null>(null);
  const [tailoredResumeName, setTailoredResumeName] = useState<string>('');
  const [isSavingTailored, setIsSavingTailored] = useState<boolean>(false);

  // --- Export State (Module 8) ---
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);

  // --- Preview Modal State (Module 7) ---
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewResume, setPreviewResume] = useState<FullStructuredResume | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // --- Notification Feedback ---
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- Initial Tab Inspection on Mount ---
  useEffect(() => {
    runTabDetection();
  }, []);

  // --- Load Resumes when User is Authenticated ---
  useEffect(() => {
    if (currentUser) {
      loadResumes();
    } else {
      setResumes([]);
      setSelectedResumeId('');
    }
  }, [currentUser]);

  const loadResumes = async () => {
    setIsLoadingResumes(true);
    try {
      const list = await resumeService.listResumes();
      // Show master resumes (non-tailored) first, followed by others
      const sorted = [...list].sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        if (!a.is_tailored && b.is_tailored) return -1;
        if (a.is_tailored && !b.is_tailored) return 1;
        return 0;
      });
      setResumes(sorted);

      // Pre-select default or first master resume
      const defaultRes = sorted.find((r) => r.is_default) || sorted.find((r) => !r.is_tailored) || sorted[0];
      if (defaultRes && !selectedResumeId) {
        setSelectedResumeId(defaultRes.id);
      }
    } catch (err: any) {
      console.warn('Could not load user resumes:', err);
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const runTabDetection = async () => {
    setIsDetecting(true);
    setMatchResult(null);
    setDraftResult(null);
    setTailoredResumeId(null);
    setSavedJob(null);

    try {
      const resp = await jobsService.extractFromActiveTab();
      if (resp.result) {
        const res = resp.result;
        setDetectedUrl(res.source_url || '');
        setDetectionSource(res.source as JobSource || 'other');

        if (res.is_job_page && res.job_description) {
          setJobTitle(res.job_title || 'Job Opportunity');
          setCompanyName(res.company_name || '');
          setLocation(res.location || '');
          setSourceUrl(res.source_url || '');
          setJobDescription(res.job_description || '');
          setIsJobDetected(true);
          setIsManualMode(false);
          setIsEditingJob(false);
          showToast('info', `Job detected from ${res.source || 'active page'}`);
        } else {
          setIsJobDetected(false);
          setSourceUrl(res.source_url || '');
          if (res.job_title) setJobTitle(res.job_title);
        }
      } else {
        setIsJobDetected(false);
      }
    } catch (err: any) {
      setIsJobDetected(false);
      showToast('error', err.message || 'Error detecting job from active tab');
    } finally {
      setIsDetecting(false);
    }
  };

  // --- Save / Ensure Job Exists on Backend ---
  const ensureJobSaved = async (): Promise<Job> => {
    if (savedJob) return savedJob;

    if (!jobTitle.trim()) {
      throw new Error('Please provide a job title.');
    }
    if (!jobDescription.trim() || jobDescription.trim().length < 10) {
      throw new Error('Job description must be at least 10 characters.');
    }

    setIsSavingJob(true);
    try {
      const payload: JobCreateInput = {
        job_title: jobTitle.trim(),
        company_name: companyName.trim() || null,
        location: location.trim() || null,
        source: detectionSource || 'other',
        source_url: sourceUrl.trim() || null,
        job_description: jobDescription.trim(),
      };

      const res = await jobsService.saveJob(payload, true);
      const active = res.job || res.existing_job;
      if (!active) {
        throw new Error('Failed to save job record on backend.');
      }
      setSavedJob(active);
      return active;
    } finally {
      setIsSavingJob(false);
    }
  };

  // --- Run Job Match Analysis (Module 5) ---
  const handleAnalyzeMatch = async () => {
    if (!currentUser) {
      onOpenAuth('login', 'Sign in to analyze your resume match.');
      return;
    }
    if (!selectedResumeId) {
      showToast('error', 'Please select a master resume to match against.');
      return;
    }

    setIsAnalyzingMatch(true);
    try {
      const currentJob = await ensureJobSaved();
      const match = await matchingService.analyzeJobMatch(currentJob.id, selectedResumeId, false);
      setMatchResult(match);
      showToast('success', `Job Match calculated: ${match.overall_score}%`);
    } catch (err: any) {
      showToast('error', err.message || 'Match analysis failed. Please try again.');
    } finally {
      setIsAnalyzingMatch(false);
    }
  };

  // --- Generate Tailored Draft (Module 6) ---
  const handleTailorResume = async () => {
    if (!currentUser) {
      onOpenAuth('login', 'Sign in to generate tailored resumes.');
      return;
    }
    if (!selectedResumeId) {
      showToast('error', 'Please select a master resume to tailor.');
      return;
    }

    setIsTailoring(true);
    setTailorStep('Ingesting job keywords & master resume...');
    try {
      const currentJob = await ensureJobSaved();

      setTailorStep('Generating grounded bullet enhancements...');
      const draft = await tailoringService.generateTailoredDraft(selectedResumeId, {
        job_id: currentJob.id,
        tailoring_mode: tailoringMode,
        prioritize_skills: true,
        prioritize_experience_bullets: true,
        prioritize_projects: true,
        adapt_summary: true,
        concise_mode: false,
        bullet_rewriting: tailoringMode,
      });

      setDraftResult(draft);

      // Auto-save the tailored resume
      setTailorStep('Saving tailored resume draft...');
      const defaultTailoredName = `${jobTitle} — ${companyName || 'Target Job'} (Tailored)`;
      const saveResp = await tailoringService.saveTailoredResume(selectedResumeId, {
        job_id: currentJob.id,
        name: defaultTailoredName,
        tailored_resume: draft.tailored_resume,
        change_log: draft.change_log,
        tailoring_mode: tailoringMode,
        original_match_score: draft.original_match_score,
        tailored_match_score: draft.tailored_match_score,
      });

      setTailoredResumeId(saveResp.tailored_resume_id);
      setTailoredResumeName(defaultTailoredName);
      showToast('success', 'Tailored resume generated and saved successfully!');
    } catch (err: any) {
      showToast('error', err.message || 'Tailoring failed. Master resume remains untouched.');
    } finally {
      setIsTailoring(false);
      setTailorStep('');
    }
  };

  // --- Export File (Module 8) ---
  const handleExport = async (format: 'pdf' | 'docx') => {
    const targetId = tailoredResumeId || selectedResumeId;
    if (!targetId) {
      showToast('error', 'No resume selected for export.');
      return;
    }

    if (format === 'pdf') setIsExportingPdf(true);
    else setIsExportingDocx(true);

    try {
      const res = await resumeService.exportResume(targetId, format);
      showToast('success', `Downloaded ${res.filename}`);
    } catch (err: any) {
      showToast('error', err.message || `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setIsExportingPdf(false);
      setIsExportingDocx(false);
    }
  };

  // --- Open Preview (Module 7) ---
  const handleOpenPreview = async () => {
    const targetId = tailoredResumeId || selectedResumeId;
    if (!targetId) return;

    setIsLoadingPreview(true);
    try {
      const full = await resumeService.getResume(targetId);
      setPreviewResume(full);
      setIsPreviewOpen(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load resume preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800';
    if (score >= 60) return 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800';
    if (score >= 40) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800';
    return 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800';
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 text-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
            )}
            <span className="truncate">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* --- SECTION 1: ACTIVE JOB CARD --- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Target Job
                </span>
                <span className="text-[9px] font-mono uppercase px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  {detectionSource}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {jobTitle || (isDetecting ? 'Detecting active tab...' : 'No Job Detected')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={runTabDetection}
              disabled={isDetecting}
              title="Re-check active browser tab"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsEditingJob((prev) => !prev)}
              title="Edit or adjust job details"
              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors ${
                isEditingJob ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Company & Location Badges */}
        {(companyName || location) && !isEditingJob && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
            {companyName && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {companyName}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {location}
              </span>
            )}
            {sanitizeUrl(sourceUrl) && (
              <a
                href={sanitizeUrl(sourceUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
              >
                <ExternalLink className="w-3 h-3" />
                Original Link
              </a>
            )}
          </div>
        )}

        {/* Not a job page banner */}
        {!isJobDetected && !isEditingJob && !isManualMode && (
          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No job description found on active tab</p>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                  Navigate to a job post on LinkedIn, Indeed, Naukri, or paste the description below.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsManualMode(true);
                setIsEditingJob(true);
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Paste Job Description Manually</span>
            </button>
          </div>
        )}

        {/* Job Edit / Manual Form */}
        {isEditingJob && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Google"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Remote / New York"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Job Description *
                </label>
                <span className="text-[10px] text-slate-400">
                  {jobDescription.length} characters
                </span>
              </div>
              <textarea
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description, requirements, and responsibilities here..."
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingJob(false)}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Done Editing
              </button>
            </div>
          </div>
        )}

        {/* Description Snippet (when not editing) */}
        {!isEditingJob && jobDescription && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
            {jobDescription}
          </div>
        )}
      </div>

      {/* --- SECTION 2: AUTHENTICATION CHECK --- */}
      {!currentUser ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 p-4 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white mx-auto flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Sign In to Continue
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Sign in to link your master resume, analyze alignment scores, and generate tailored drafts.
            </p>
          </div>
          <button
            onClick={() => onOpenAuth('login', 'Sign in to access your master resumes.')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
          >
            <span>Sign In to TailorResume</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* --- SECTION 3: MASTER RESUME SELECTION --- */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Select Master Resume
                </h3>
              </div>
              <button
                onClick={onNavigateToResumes}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage Resumes
              </button>
            </div>

            {isLoadingResumes ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>Loading your resumes...</span>
              </div>
            ) : resumes.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-500">You don't have any saved resumes yet.</p>
                <button
                  onClick={onNavigateToResumes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Master Resume</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedResumeId}
                  onChange={(e) => {
                    setSelectedResumeId(e.target.value);
                    setMatchResult(null);
                    setDraftResult(null);
                    setTailoredResumeId(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_default ? '★ (Default)' : ''} {r.is_tailored ? '— [Tailored]' : '— [Master]'}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Master resume will remain unchanged throughout tailoring</span>
                </div>
              </div>
            )}

            {/* Match Analysis Action Button */}
            {resumes.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleAnalyzeMatch}
                  disabled={isAnalyzingMatch || !selectedResumeId || !jobDescription.trim()}
                  className="w-full py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {isAnalyzingMatch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing Alignment (Module 5)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analyze Job Match</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* --- SECTION 4: JOB MATCH SCORE CARD (MODULE 5) --- */}
          {matchResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Job Match Analysis
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  v{matchResult.algorithm_version}
                </span>
              </div>

              {/* Score Display Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Match Assessment
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{matchResult.match_level}</span>
                  </div>
                </div>

                <div
                  className={`px-3.5 py-1.5 rounded-xl border text-lg font-black font-mono shadow-xs ${getScoreColorClass(
                    matchResult.overall_score
                  )}`}
                >
                  {matchResult.overall_score}%
                </div>
              </div>

              {/* Category Breakdown Bars */}
              <div className="space-y-2 pt-1">
                {Object.entries(matchResult.category_scores).map(([key, cat]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="capitalize text-slate-600 dark:text-slate-400 font-medium">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cat.score}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Matched vs Missing Skills Preview */}
              <div className="space-y-2 pt-1">
                {matchResult.matched_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Matched Skills ({matchResult.matched_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {matchResult.matched_skills.slice(0, 6).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                        >
                          ✓ {s.canonical}
                        </span>
                      ))}
                      {matchResult.matched_skills.length > 6 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-400 font-medium">
                          +{matchResult.matched_skills.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {matchResult.missing_skills.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Key Missing Skills ({matchResult.missing_skills.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {matchResult.missing_skills.slice(0, 5).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                        >
                          ! {s.canonical}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tailoring CTA Form */}
              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tailoring Strategy</span>
                  </span>
                  <select
                    value={tailoringMode}
                    onChange={(e) => setTailoringMode(e.target.value as TailoringMode)}
                    className="text-xs font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 focus:outline-none"
                  >
                    <option value="balanced">Balanced (Recommended)</option>
                    <option value="conservative">Conservative</option>
                    <option value="strong">Strong Alignment</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleTailorResume}
                  disabled={isTailoring}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {isTailoring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{tailorStep || 'Tailoring Resume (Module 6)...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Tailored Resume</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* --- SECTION 5: TAILORED RESUME READY (MODULE 6 + 7 + 8) --- */}
          {tailoredResumeId && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-purple-500/5 to-blue-500/10 rounded-2xl border border-emerald-300 dark:border-emerald-800 p-4 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Tailored Resume Ready
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {tailoredResumeName}
                    </h4>
                  </div>
                </div>

                {draftResult && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Score Boost</span>
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {draftResult.original_match_score}% → {draftResult.tailored_match_score}%
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Preview & Export */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  disabled={isLoadingPreview}
                  className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {isLoadingPreview ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>Open Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={isExportingPdf || isExportingDocx}
                  className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('docx')}
                  disabled={isExportingPdf || isExportingDocx}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isExportingDocx ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                  )}
                  <span>Download Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={runTabDetection}
                  title="Tailor another job"
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- MODAL: FULL RESUME PREVIEW (MODULE 7) --- */}
      {isPreviewOpen && previewResume && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[94vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Resume Preview & Templates
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Preview Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950">
              <ResumePreview
                resume={previewResume}
                onUpdateResume={(updated) => setPreviewResume(updated)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
