import React, { useState } from 'react';
import { FullStructuredResume } from '../../types/resume';
import { TemplateId, ZoomLevel } from '../../types/template';
import { getTemplateConfig } from './templates/templateRegistry';
import { TemplateSelector } from './templates/TemplateSelector';
import { ResumeDocumentRenderer } from './renderer/ResumeDocumentRenderer';
import { MasterDocumentPreview } from './MasterDocumentPreview';
import { resumeService } from '../../services/resume.service';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  FileDown,
  ArrowLeft,
  ShieldCheck,
  LayoutTemplate,
} from 'lucide-react';

interface ResumePreviewProps {
  resume: FullStructuredResume;
  onUpdateResume?: (updated: FullStructuredResume) => void;
  onBack?: () => void;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ resume, onUpdateResume, onBack }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>(
    (resume.template_id as TemplateId) || 'ats-classic'
  );
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Original Master Resume Preview states
  const hasOriginalFile = !resume.is_tailored && Boolean(resume.original_file_path || resume.file_sha256 || resume.file_type);
  const [previewMode, setPreviewMode] = useState<'original' | 'structured'>(hasOriginalFile ? 'original' : 'structured');
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState<boolean>(false);

  // Module 8: Export states
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const activeConfig = getTemplateConfig(selectedTemplateId);

  // Check for minimal content
  const hasBasicContent =
    Boolean(resume.personal_info?.full_name?.trim()) ||
    (resume.experiences && resume.experiences.length > 0) ||
    (resume.skills && resume.skills.length > 0);

  const handleTemplateChange = async (newTemplateId: TemplateId) => {
    if (newTemplateId === selectedTemplateId) return;

    setSelectedTemplateId(newTemplateId);
    setIsSavingTemplate(true);
    setSaveStatus(null);

    try {
      if (resume.id) {
        await resumeService.updateTemplate(resume.id, newTemplateId, activeConfig.version);
        setSaveStatus('Template saved');
        setTimeout(() => setSaveStatus(null), 2500);

        if (onUpdateResume) {
          onUpdateResume({
            ...resume,
            template_id: newTemplateId,
            template_version: activeConfig.version,
          });
        }
      }
    } catch (err) {
      console.error('Failed to persist template selection:', err);
      setSaveStatus('Failed to save selection');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!resume.id) return;
    setIsDownloadingOriginal(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const result = await resumeService.downloadOriginalMasterFile(resume.id);
      setExportSuccess(`Downloaded original file: ${result.filename}`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error('Download original master file failed:', err);
      setExportError(err.message || 'Failed to download original master resume.');
    } finally {
      setIsDownloadingOriginal(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!resume.id) return;
    setExportError(null);
    setExportSuccess(null);

    if (format === 'pdf') setIsExportingPdf(true);
    else setIsExportingDocx(true);

    try {
      const result = await resumeService.exportResume(
        resume.id,
        format,
        selectedTemplateId,
        activeConfig.version
      );
      setExportSuccess(`Downloaded ${result.filename}`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error(`Export ${format.toUpperCase()} failed:`, err);
      setExportError(err.message || `Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setIsExportingPdf(false);
      setIsExportingDocx(false);
    }
  };

  const zoomScale = zoom === 'fit' ? 0.9 : zoom / 100;

  return (
    <div className="space-y-6">
      {/* 1. Resume Type Banner & Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {resume.name || 'Untitled Resume'}
              </h2>
              {resume.is_tailored ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-3 h-3" />
                  Tailored Resume
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Master Resume
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {previewMode === 'original' && hasOriginalFile ? (
                <span>Original document format: <strong className="text-slate-700 dark:text-slate-200">{resume.original_filename || (resume.file_type ? resume.file_type.toUpperCase() : 'Master Document')}</strong></span>
              ) : (
                <span>Active format: <strong className="text-slate-700 dark:text-slate-200">{activeConfig.name}</strong> ({activeConfig.version})</span>
              )}
            </p>
          </div>
        </div>

        {/* Right side: Persistence indicator & Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Indicator */}
          {isSavingTemplate && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving format...
            </span>
          )}
          {saveStatus && !isSavingTemplate && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mr-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveStatus}
            </span>
          )}

          {/* Download Original File Action for Master Resumes */}
          {hasOriginalFile && (
            <button
              type="button"
              disabled={isDownloadingOriginal || !resume.id}
              onClick={handleDownloadOriginal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Download the exact original uploaded master file"
              aria-label="Download Original File"
            >
              {isDownloadingOriginal ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading Original...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Original ({resume.file_type?.toUpperCase() || 'FILE'})</span>
                </>
              )}
            </button>
          )}

          {/* Export Buttons */}
          <button
            type="button"
            disabled={isExportingPdf || isExportingDocx || !resume.id}
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Download ATS-compliant vector PDF"
            aria-label="Download PDF"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isExportingPdf || isExportingDocx || !resume.id}
            onClick={() => handleExport('docx')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Download editable Microsoft Word document"
            aria-label="Download DOCX"
          >
            {isExportingDocx ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating DOCX...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Download DOCX</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Feedback Alerts */}
      {exportSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {exportError && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-[11px] underline hover:no-underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Master Resume Preview Mode Switcher (Original Document vs Structured View) */}
      {hasOriginalFile && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewMode('original')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                previewMode === 'original'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Original Uploaded Document ({resume.file_type?.toUpperCase() || 'FILE'})</span>
            </button>

            <button
              type="button"
              onClick={() => setPreviewMode('structured')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                previewMode === 'structured'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Structured Template View</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            {previewMode === 'original' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Displaying exact source document &bull; Zero reformatting
              </span>
            ) : (
              <span>Displaying structured data in ATS template</span>
            )}
          </div>
        </div>
      )}

      {/* 3. Primary Preview Stage */}
      {previewMode === 'original' && hasOriginalFile ? (
        <MasterDocumentPreview
          resumeId={resume.id}
          originalFilename={resume.original_filename}
          fileSha256={resume.file_sha256}
          fileType={resume.file_type}
          isTailored={resume.is_tailored}
          onSwitchToStructured={() => setPreviewMode('structured')}
        />
      ) : (
        <>
          {/* Template Selector */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <TemplateSelector
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleTemplateChange}
              disabled={isSavingTemplate || isExportingPdf || isExportingDocx}
            />
          </div>

          {/* Empty Content Warning if needed */}
          {!hasBasicContent && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Your resume is missing some core sections.</p>
                <p className="mt-0.5">
                  Add your work experience, education, or skills in the editor tab to see a fully populated resume preview.
                </p>
              </div>
            </div>
          )}

          {/* Preview Toolbar & Zoom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium pl-1">
              Simulated Document View (A4 International)
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 p-1">
              <button
                type="button"
                onClick={() => setZoom((prev) => (prev === 'fit' || prev === 75 ? 75 : prev === 100 ? 75 : 100))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoom(75)}
                className={`px-2 py-0.5 text-xs rounded font-medium cursor-pointer ${zoom === 75 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
              >
                75%
              </button>

              <button
                type="button"
                onClick={() => setZoom(100)}
                className={`px-2 py-0.5 text-xs rounded font-medium cursor-pointer ${zoom === 100 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
              >
                100%
              </button>

              <button
                type="button"
                onClick={() => setZoom(125)}
                className={`px-2 py-0.5 text-xs rounded font-medium cursor-pointer ${zoom === 125 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
              >
                125%
              </button>

              <button
                type="button"
                onClick={() => setZoom((prev) => (prev === 'fit' ? 100 : 'fit'))}
                className={`p-1 rounded text-xs flex items-center gap-1 cursor-pointer ${zoom === 'fit' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                title="Fit to width"
                aria-label="Fit to width"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setZoom((prev) => (prev === 'fit' || prev === 125 ? 125 : prev === 100 ? 125 : 100))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Document Stage Container */}
          <div className="relative w-full overflow-x-auto bg-slate-200/80 dark:bg-slate-950/80 p-4 sm:p-8 rounded-xl border border-slate-300 dark:border-slate-800 flex justify-center items-start min-h-[500px]">
            <div
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="w-full max-w-[210mm] shadow-lg rounded-sm overflow-hidden"
            >
              <ResumeDocumentRenderer resume={resume} config={activeConfig} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
