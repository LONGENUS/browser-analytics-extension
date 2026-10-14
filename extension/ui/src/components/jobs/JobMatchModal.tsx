import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCw,
  Loader2,
  Briefcase,
  GraduationCap,
  Sparkles,
  Info,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { matchingService } from '../../services/matching.service';
import { resumeService } from '../../services/resume.service';
import { Job } from '../../types/job';
import { ResumeSummaryItem } from '../../types/resume';
import { JobMatchResult, MatchedSkill, MissingSkill, ResponsibilityAnalysis } from '../../types/match';
import { ResumeTailorModal } from '../resume/ResumeTailorModal';

interface JobMatchModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

export const JobMatchModal: React.FC<JobMatchModalProps> = ({ job, isOpen, onClose }) => {
  const [resumes, setResumes] = useState<ResumeSummaryItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isLoadingResumes, setIsLoadingResumes] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [isTailorModalOpen, setIsTailorModalOpen] = useState<boolean>(false);

  // Accordion toggles for details
  const [expandedSection, setExpandedSection] = useState<'skills' | 'responsibilities' | 'experience' | 'qualifications' | 'keywords' | null>('skills');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadUserResumes = async () => {
      setIsLoadingResumes(true);
      setError(null);
      try {
        const list = await resumeService.listResumes();
        if (isMounted) {
          setResumes(list);
          // Auto-select default resume or first resume
          const defaultRes = list.find((r) => r.is_default) || list[0];
          if (defaultRes) {
            setSelectedResumeId(defaultRes.id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load resumes.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingResumes(false);
        }
      }
    };

    loadUserResumes();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async (force: boolean = false) => {
    if (!selectedResumeId) {
      setError('Please select a resume to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const matchResult = await matchingService.analyzeJobMatch(job.id, selectedResumeId, force);
      setResult(matchResult);
    } catch (err: any) {
      setError(err.message || 'Match analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 75) return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
    if (score >= 60) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const requiredMissing = result?.missing_skills?.filter((s) => !s.is_preferred) || [];
  const preferredMissing = result?.missing_skills?.filter((s) => s.is_preferred) || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Job Match Analysis
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Deterministic Engine v1
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                {job.job_title} {job.company_name ? `• ${job.company_name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Resume Selection Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Select Resume to Compare
              </label>
              {resumes.length > 0 && (
                <span className="text-[10px] text-slate-500">
                  {resumes.length} available
                </span>
              )}
            </div>

            {isLoadingResumes ? (
              <div className="flex items-center gap-2 py-2 text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading your resumes...</span>
              </div>
            ) : resumes.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                <p className="font-semibold">No resume available.</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  Create or import a structured resume before analyzing this job.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  disabled={isAnalyzing}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleAnalyze(false)}
                  disabled={isAnalyzing || !selectedResumeId}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : result ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Re-analyze</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analyze Match</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{error}</span>
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {isAnalyzing && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                Analyzing your resume against this job...
              </p>
              <p className="text-[11px] text-slate-500">
                Evaluating skills, responsibilities, and experience requirements deterministically.
              </p>
            </div>
          )}

          {/* Analysis Results View */}
          {result && !isAnalyzing && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Limited Data Warning */}
              {result.limited_data && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold">Limited Match Data</h4>
                    <p className="text-[11px] mt-0.5 leading-relaxed">
                      {result.message || "There isn't enough job information or resume content to calculate a reliable match."}
                    </p>
                  </div>
                </div>
              )}

              {/* Stale Warning */}
              {result.is_stale && (
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">Resume or job was modified since this analysis.</span>
                  </div>
                  <button
                    onClick={() => handleAnalyze(true)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Refresh</span>
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Overall Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Primary Metric
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                      Job Match
                    </h3>
                    <span className={`text-2xl font-black ${getScoreColor(result.overall_score).split(' ')[0]}`}>
                      {result.overall_score}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getScoreColor(result.overall_score)}`}>
                      {result.match_level}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      vs {result.resume_name}
                    </span>
                  </div>
                </div>

                <div className="w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center bg-white dark:bg-slate-900 shadow-sm shrink-0 border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">Score</span>
                  <span className={`text-lg font-black ${getScoreColor(result.overall_score).split(' ')[0]}`}>
                    {result.overall_score}
                  </span>
                </div>
              </div>

              {/* Category Breakdown (5 Weights) */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Transparent Category Breakdown
                  </h4>
                  <span className="text-[10px] text-slate-400">Deterministic Weighted Sum</span>
                </div>

                <div className="space-y-2">
                  {/* Skills (40%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span>Skills & Technical Requirements (40%)</span>
                      <span className="font-bold">{result.category_scores.skills}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(result.category_scores.skills)}`}
                        style={{ width: `${result.category_scores.skills}%` }}
                      />
                    </div>
                  </div>

                  {/* Responsibilities (25%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span>Responsibilities & Demonstrated Impact (25%)</span>
                      <span className="font-bold">{result.category_scores.responsibilities}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(result.category_scores.responsibilities)}`}
                        style={{ width: `${result.category_scores.responsibilities}%` }}
                      />
                    </div>
                  </div>

                  {/* Experience (15%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span>Experience Duration Requirements (15%)</span>
                      <span className="font-bold">{result.category_scores.experience}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(result.category_scores.experience)}`}
                        style={{ width: `${result.category_scores.experience}%` }}
                      />
                    </div>
                  </div>

                  {/* Qualifications (10%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span>Education & Qualifications (10%)</span>
                      <span className="font-bold">{result.category_scores.qualifications}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(result.category_scores.qualifications)}`}
                        style={{ width: `${result.category_scores.qualifications}%` }}
                      />
                    </div>
                  </div>

                  {/* Keywords (10%) */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span>Important Keywords & Term Coverage (10%)</span>
                      <span className="font-bold">{result.category_scores.keywords}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(result.category_scores.keywords)}`}
                        style={{ width: `${result.category_scores.keywords}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Matched Skills Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'skills' ? null : 'skills')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      Matched Skills ({result.matched_skills.length})
                    </span>
                  </div>
                  {expandedSection === 'skills' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {expandedSection === 'skills' && (
                  <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    {result.matched_skills.length === 0 ? (
                      <p className="text-slate-500 py-1">No recognizable skills matched yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        {result.matched_skills.map((s, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  ✓ {s.canonical}
                                </span>
                                {s.alias_matched !== s.canonical && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono">
                                    via {s.alias_matched}
                                  </span>
                                )}
                                {s.is_preferred && (
                                  <span className="text-[9px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                                    Preferred
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {s.category}
                              </span>
                            </div>

                            {s.evidence && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Evidence ({s.location}):
                                </span>{' '}
                                "{s.evidence}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Missing Skills Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'keywords' ? null : 'keywords')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      Missing / Not Found ({result.missing_skills.length})
                    </span>
                  </div>
                  {expandedSection === 'keywords' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {expandedSection === 'keywords' && (
                  <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                    {result.missing_skills.length === 0 ? (
                      <p className="text-emerald-600 dark:text-emerald-400 py-1 font-medium">
                        All recognized requirements are represented!
                      </p>
                    ) : (
                      <div className="space-y-3 pt-2">
                        {/* Required Missing */}
                        {requiredMissing.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block mb-1.5">
                              Required Skills Absent ({requiredMissing.length})
                            </span>
                            <div className="space-y-1">
                              {requiredMissing.map((s, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between"
                                >
                                  <span className="font-semibold text-rose-800 dark:text-rose-300">
                                    • {s.canonical}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {s.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Preferred Missing */}
                        {preferredMissing.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                              Preferred / Bonus Skills Absent ({preferredMissing.length})
                            </span>
                            <div className="space-y-1">
                              {preferredMissing.map((s, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                                >
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    • {s.canonical}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Optional / Preferred
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Responsibilities Analysis */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'responsibilities' ? null : 'responsibilities')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      Responsibilities Analysis ({result.responsibilities_analysis.length})
                    </span>
                  </div>
                  {expandedSection === 'responsibilities' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {expandedSection === 'responsibilities' && (
                  <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/80 space-y-2 pt-2">
                    {result.responsibilities_analysis.length === 0 ? (
                      <p className="text-slate-500 py-1">No explicit responsibility statements found.</p>
                    ) : (
                      result.responsibilities_analysis.map((r, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {r.job_responsibility}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                                r.status === 'matched'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : r.status === 'partial'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>

                          {r.evidence && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Matched Evidence ({r.location}):
                              </span>{' '}
                              "{r.evidence}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Experience Duration Assessment */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'experience' ? null : 'experience')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-500" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      Experience & Qualifications
                    </span>
                  </div>
                  {expandedSection === 'experience' ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {expandedSection === 'experience' && (
                  <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 pt-2">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Experience Duration
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          {result.experience_assessment.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {result.experience_assessment.message}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Education Alignment
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          {result.qualification_assessment.education_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {result.qualification_assessment.education_message}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Score Disclaimer Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  {result.disclaimer}
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div>
            {result && (
              <span className="text-[11px] text-slate-500 font-medium">
                Match score: <strong className="text-slate-800 dark:text-slate-200 font-mono">{result.overall_score}%</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {result && selectedResumeId && (
              <button
                type="button"
                onClick={() => setIsTailorModalOpen(true)}
                className="py-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tailor Resume</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="py-1.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Tailor Resume Modal */}
      {isTailorModalOpen && (
        <ResumeTailorModal
          job={job}
          initialResumeId={selectedResumeId}
          isOpen={isTailorModalOpen}
          onClose={() => setIsTailorModalOpen(false)}
        />
      )}
    </div>
  );
};
