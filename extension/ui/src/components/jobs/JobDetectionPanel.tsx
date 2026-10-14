import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  ExternalLink,
  Clipboard,
  FileText,
  Building,
  MapPin,
  Globe,
  Loader2,
} from 'lucide-react';
import { jobsService } from '../../services/jobs.service';
import { JobExtractionResult, JobCreateInput, Job } from '../../types/job';

interface JobDetectionPanelProps {
  onJobSaved: (job: Job) => void;
  onOpenSavedJob?: (jobId: string) => void;
}

export const JobDetectionPanel: React.FC<JobDetectionPanelProps> = ({
  onJobSaved,
  onOpenSavedJob,
}) => {
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectStep, setDetectStep] = useState<string>('Detecting job page...');
  const [extractedData, setExtractedData] = useState<JobExtractionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Form edit state
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [source, setSource] = useState<string>('other');

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateJob, setDuplicateJob] = useState<Job | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const runDetection = async () => {
    setIsDetecting(true);
    setDetectionError(null);
    setSaveError(null);
    setDuplicateJob(null);
    setSaveSuccess(null);
    setDetectStep('Detecting job page...');

    try {
      setDetectStep('Extracting job description...');
      const response = await jobsService.extractFromActiveTab();

      if (!response.success || !response.result) {
        setDetectionError(response.error || 'Could not detect a job on this page.');
        setIsDetecting(false);
        return;
      }

      const result = response.result;
      setExtractedData(result);

      if (result.is_job_page && result.job_description) {
        setTitle(result.job_title || '');
        setCompany(result.company_name || '');
        setLocation(result.location || '');
        setSourceUrl(result.source_url || '');
        setDescription(result.job_description || '');
        setSource(result.source || 'other');
        setIsManualMode(false);
      } else {
        setDetectionError("This page doesn't appear to be a job posting.");
        setSourceUrl(result.source_url || '');
        setSource(result.source || 'other');
      }
    } catch (err: any) {
      setDetectionError(err.message || 'Detection failed.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualPasteClick = () => {
    setIsManualMode(true);
    setDetectionError(null);
    if (!title) setTitle('');
    if (!company) setCompany('');
  };

  const handleSave = async (updateIfExists: boolean = false) => {
    if (!title.trim()) {
      setSaveError('Job title is required.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setSaveError('Job description must be at least 10 characters.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setDuplicateJob(null);

    const payload: JobCreateInput = {
      job_title: title.trim(),
      company_name: company.trim() || null,
      location: location.trim() || null,
      source: (source as any) || 'other',
      source_url: sourceUrl.trim() || null,
      job_description: description.trim(),
    };

    try {
      const res = await jobsService.saveJob(payload, updateIfExists);

      if (res.duplicate && res.existing_job && !updateIfExists) {
        setDuplicateJob(res.existing_job);
        setIsSaving(false);
        return;
      }

      setSaveSuccess('Job saved successfully!');
      onJobSaved(res.job);

      setTimeout(() => {
        setSaveSuccess(null);
        // Reset form
        setExtractedData(null);
        setIsManualMode(false);
        setTitle('');
        setCompany('');
        setLocation('');
        setDescription('');
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save job.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
      {/* Top Header / Detect Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Job Detection
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Extract job listings from active browser tab
            </p>
          </div>
        </div>

        <button
          onClick={runDetection}
          disabled={isDetecting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
          <span>{isDetecting ? 'Detecting...' : 'Detect Job'}</span>
        </button>
      </div>

      {/* Loading Progress State */}
      {isDetecting && (
        <div className="py-4 text-center space-y-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {detectStep}
          </p>
        </div>
      )}

      {/* Non-Job or Detection Error State */}
      {!isDetecting && detectionError && !isManualMode && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold">{detectionError}</p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                Open a job listing on LinkedIn, Naukri, Indeed, or career sites, or paste manually.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualPasteClick}
            className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste Job Description Manually</span>
          </button>
        </div>
      )}

      {/* Active Form (Either Detected Job or Manual Fallback) */}
      {(extractedData?.is_job_page || isManualMode) && !isDetecting && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Header Badge */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {isManualMode ? 'Manual Job Entry' : 'Job Detected — Review & Save'}
            </span>

            {extractedData && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                {extractedData.source} ({extractedData.confidence})
              </span>
            )}
          </div>

          {/* Title & Company */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Remote / Bengaluru"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Description Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Job Description *
              </label>
              <span className="text-[10px] text-slate-400">
                {description.length} characters
              </span>
            </div>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or review the job description, responsibilities, and requirements here..."
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed resize-y"
            />
          </div>

          {/* Duplicate Notice Banner */}
          {duplicateJob && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>This job is already saved in your library.</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                >
                  Update Saved Job
                </button>
              </div>
            </div>
          )}

          {/* Error / Success Feedback */}
          {saveError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {saveError}
            </p>
          )}

          {saveSuccess && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveSuccess}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setExtractedData(null);
                setIsManualMode(false);
              }}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-soft transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Job</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
