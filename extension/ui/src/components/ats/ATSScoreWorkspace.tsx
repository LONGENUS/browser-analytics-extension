import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  FileCheck,
  X,
} from 'lucide-react';
import { resumeService } from '../../services/resume.service';
import { matchingService, ATSScoreResult } from '../../services/matching.service';
import { tailoringService } from '../../services/tailoring.service';
import { ResumeSummaryItem } from '../../types/resume';
import { AuthUser } from '../../services/auth';
import { TailoredResumeReviewModal } from '../resume/TailoredResumeReviewModal';

interface ATSScoreWorkspaceProps {
  currentUser: AuthUser | null;
  onOpenAuth: (view?: 'login' | 'register', prompt?: string) => void;
  onNavigateToResumes: () => void;
  initialMasterResumeId?: string | null;
}

export const ATSScoreWorkspace: React.FC<ATSScoreWorkspaceProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateToResumes,
  initialMasterResumeId,
}) => {
  // Master Resumes state
  const [masterResumes, setMasterResumes] = useState<ResumeSummaryItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isLoadingResumes, setIsLoadingResumes] = useState<boolean>(true);

  // Review Modal state for AI change tracking
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Job Description state (persisted across tab switches via localStorage)
  const [jobDescription, setJobDescription] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('resumeai_pasted_job_description') || '';
    }
    return '';
  });
  const [jobTitle, setJobTitle] = useState<string>('');

  // Analysis State
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<ATSScoreResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Tailored Resume Generation State
  const [isTailoring, setIsTailoring] = useState<boolean>(false);
  const [tailorSuccess, setTailorSuccess] = useState<{
    tailored_resume_id: string;
    name: string;
    source_resume_name?: string;
    job_title: string;
    download_pdf_url: string;
    download_docx_url: string;
    preview_url: string;
  } | null>(null);
  const [tailorError, setTailorError] = useState<string | null>(null);

  // Preview Modal State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Sync job description to localStorage
  const handleJobDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJobDescription(val);
    try {
      localStorage.setItem('resumeai_pasted_job_description', val);
    } catch (_) {}
  };

  // Load user master resumes
  const loadMasterResumes = async () => {
    if (!currentUser) {
      setIsLoadingResumes(false);
      return;
    }
    setIsLoadingResumes(true);
    try {
      const data = await resumeService.listResumes();
      // Filter strictly master resumes (never tailored resumes)
      const masters = data.filter((r) => !r.is_tailored);
      setMasterResumes(masters);

      if (initialMasterResumeId && masters.some((m) => m.id === initialMasterMasterId(initialMasterResumeId))) {
        setSelectedResumeId(initialMasterMasterId(initialMasterResumeId));
      } else if (!selectedResumeId && masters.length > 0) {
        // Default to the user's default resume or first resume
        const def = masters.find((m) => m.is_default) || masters[0];
        setSelectedResumeId(def.id);
      }
    } catch (err: any) {
      console.error('Failed to load master resumes:', err);
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const initialMasterMasterId = (id: string) => id.replace('draft-', '');

  useEffect(() => {
    loadMasterResumes();
  }, [currentUser]);

  useEffect(() => {
    if (initialMasterResumeId && masterResumes.length > 0) {
      const clean = initialMasterResumeId.replace('draft-', '');
      const match = masterResumes.find((m) => m.id === clean || m.id === initialMasterResumeId);
      if (match) {
        setSelectedResumeId(match.id);
      }
    }
  }, [initialMasterResumeId, masterResumes]);

  // Handle Calculate ATS Score
  const handleCalculateScore = async () => {
    if (!currentUser) {
      onOpenAuth('login', 'Please sign in to calculate your ATS score and tailor your resume.');
      return;
    }

    setAnalysisError(null);
    setTailorSuccess(null);
    setTailorError(null);

    // 1. Validate Job Description
    const trimmedDesc = jobDescription.trim();
    if (!trimmedDesc || trimmedDesc.length < 20) {
      setAnalysisError('Please paste a complete job description before calculating the ATS score.');
      return;
    }

    // 2. Validate Selected Master Resume
    if (!selectedResumeId) {
      setAnalysisError('Please select a master resume from the dropdown above. If you haven\'t uploaded one yet, visit the Resumes tab.');
      return;
    }

    setIsCalculating(true);
    try {
      const result = await matchingService.calculateATSScore(
        selectedResumeId,
        trimmedDesc,
        jobTitle.trim() || undefined
      );
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to calculate ATS score. Please check your inputs and try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle Generate Tailored Resume
  const handleGenerateTailoredResume = async () => {
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }
    if (!analysisResult) return;

    setIsTailoring(true);
    setTailorError(null);

    try {
      const res = await tailoringService.directTailorResume(
        analysisResult.resume_id,
        analysisResult.job_id
      );
      setTailorSuccess({
        tailored_resume_id: res.tailored_resume_id,
        name: res.name,
        source_resume_name: res.source_resume_name,
        job_title: res.target_job_title || 'Tailored Position',
        download_pdf_url: `/api/resumes/${res.tailored_resume_id}/export?format=pdf`,
        download_docx_url: `/api/resumes/${res.tailored_resume_id}/export?format=docx`,
        preview_url: `/api/resumes/${res.tailored_resume_id}/export?format=pdf&inline=true`,
      });
      setIsReviewModalOpen(true);
    } catch (err: any) {
      setTailorError(err.message || 'Failed to generate tailored resume. Please try again.');
    } finally {
      setIsTailoring(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!tailorSuccess) return;
    try {
      await resumeService.exportResume(tailorSuccess.tailored_resume_id, format);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ATS Score & Tailor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare your master resume against any job description for an explainable ATS score, then generate a tailored version.
          </p>
        </div>
      </div>

      {/* Step 1: Inputs Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-5">
        {/* A. Master Resume Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Select Master Resume:
            </label>
            <button
              type="button"
              onClick={onNavigateToResumes}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Manage / Upload Documents
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoadingResumes ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Loading master resumes...
            </div>
          ) : masterResumes.length === 0 ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <span>No master resumes found. Please upload a PDF or DOCX resume to begin.</span>
              <button
                type="button"
                onClick={onNavigateToResumes}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs transition-colors shrink-0 ml-2"
              >
                Upload Resume
              </button>
            </div>
          ) : (
            <select
              value={selectedResumeId}
              onChange={(e) => {
                setSelectedResumeId(e.target.value);
                setAnalysisResult(null);
                setTailorSuccess(null);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              {masterResumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.original_filename ? `(${r.original_filename})` : ''} {r.is_default ? '★ Default' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* B. Manual Job Description Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
              Paste Complete Job Description:
            </label>
            <span className="text-[11px] text-slate-400">
              {jobDescription.trim().length} characters
            </span>
          </div>

          <textarea
            value={jobDescription}
            onChange={handleJobDescriptionChange}
            placeholder="Paste the full job description copied from LinkedIn, Indeed, or company career page here... Include responsibilities, required qualifications, and technical skills for the most accurate ATS score."
            rows={8}
            className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans transition-all resize-y leading-relaxed"
          />
        </div>

        {/* Action Error Banner */}
        {analysisError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Analysis Failed</p>
              <p className="mt-0.5">{analysisError}</p>
            </div>
          </div>
        )}

        {/* C. Calculate ATS Score Button */}
        <div>
          <button
            type="button"
            onClick={handleCalculateScore}
            disabled={isCalculating || masterResumes.length === 0}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Job Match & Evidenced Skills...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Calculate ATS Score
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: ATS Score Results (Shown only after calculation succeeds) */}
      {analysisResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
            {/* Prominent Single ATS Score out of 100 */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Overall ATS Readiness Score
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${
                    analysisResult.overall_score >= 75
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : analysisResult.overall_score >= 50
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {analysisResult.overall_score}
                </span>
                <span className="text-lg font-medium text-slate-400">/ 100</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Calculated from verifiable evidence in <span className="font-semibold text-slate-700 dark:text-slate-300">{analysisResult.resume_name}</span>.
              </p>
            </div>

            {/* Prominent Generate Tailored Resume Action */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleGenerateTailoredResume}
                disabled={isTailoring}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isTailoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Tailored Resume...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Tailored Resume
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Missing Requirements List */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Missing or Insufficiently Evidenced Requirements ({analysisResult.missing_requirements.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              These items from the job posting are missing or lack evidence in your resume. Addressing these will improve your ATS readiness.
            </p>

            {analysisResult.missing_requirements.length === 0 ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                All major qualifications, skills, and experience items identified in the job description appear supported by your resume!
              </div>
            ) : (
              <ul className="space-y-2">
                {analysisResult.missing_requirements.map((req, idx) => (
                  <li
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tailoring Error Banner */}
          {tailorError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tailorError}</span>
            </div>
          )}

          {/* Step 3: Generated Tailored Resume Result */}
          {tailorSuccess && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">{tailorSuccess.name}</h4>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      Tailored for {tailorSuccess.job_title} • Preserved original master structure & factual integrity.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(true)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Inspect AI change tracking highlights, diffs, and review changes"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Review AI Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(tailorSuccess.preview_url)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('pdf')}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('docx')}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    DOCX
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Saved to your library as an independent tailored resume version.</span>
                <button
                  type="button"
                  onClick={onNavigateToResumes}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  View in Resumes Tab →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-purple-600" />
                Tailored Resume Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
              <iframe
                src={previewUrl}
                title="Tailored Resume Preview"
                className="w-full h-full rounded-lg border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Change Tracking & Review Modal */}
      {isReviewModalOpen && tailorSuccess && (
        <TailoredResumeReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          tailoredResumeId={tailorSuccess.tailored_resume_id}
          tailoredResumeName={tailorSuccess.name}
          sourceResumeName={tailorSuccess.source_resume_name}
          targetJobTitle={tailorSuccess.job_title}
        />
      )}
    </div>
  );
};
