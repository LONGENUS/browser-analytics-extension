import React, { useState, useEffect } from 'react';
import {
  ResumeSummaryItem,
  FullStructuredResume,
} from '../../types/resume';
import { resumeService } from '../../services/resume.service';
import { ResumeEditor } from './ResumeEditor';
import {
  FileText,
  Plus,
  Star,
  Copy,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  X,
  Upload,
  FileUp,
  Loader2,
  Eye,
  Search,
  Download,
  ArrowRight,
} from 'lucide-react';

import { AuthState } from '../../services/auth';
import { MasterDocumentPreview } from './MasterDocumentPreview';
import { tailoringService } from '../../services/tailoring.service';
import { TailoredResumeMetadata } from '../../types/tailoring';
import { TailoredResumeReviewModal } from './TailoredResumeReviewModal';

interface ResumeDashboardProps {
  initialOpenCreate?: boolean;
  initialOpenImport?: boolean;
  initialResumeIdToEdit?: string | null;
  initialResumeIdToPreview?: string | null;
  authState?: AuthState;
  onOpenAuth?: (view?: 'login' | 'register') => void;
  onSelectMasterForATS?: (resumeId: string) => void;
}

export const ResumeDashboard: React.FC<ResumeDashboardProps> = ({
  initialOpenCreate = false,
  initialOpenImport = false,
  initialResumeIdToEdit = null,
  initialResumeIdToPreview = null,
  authState,
  onOpenAuth,
  onSelectMasterForATS,
}) => {
  const [resumes, setResumes] = useState<ResumeSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Sort (Master Resumes)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent_updated' | 'recent_created' | 'name'>('recent_updated');

  // Active resume being edited / previewed
  const [activeResume, setActiveResume] = useState<FullStructuredResume | null>(null);
  const [startInPreviewMode, setStartInPreviewMode] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(initialOpenCreate);
  const [newResumeName, setNewResumeName] = useState<string>('My Master Resume');
  const [newResumeIsDefault, setNewResumeIsDefault] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Delete Modal State
  const [resumeToDelete, setResumeToDelete] = useState<ResumeSummaryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Import Modal State (Module 3)
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(initialOpenImport);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusStep, setImportStatusStep] = useState<string>('Uploading resume...');
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Original Document Preview Modal State
  const [masterPreviewItem, setMasterPreviewItem] = useState<ResumeSummaryItem | null>(null);

  // Rename Resume Modal State
  const [resumeToRename, setResumeToRename] = useState<ResumeSummaryItem | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // Tailored Resumes State (Document Library Section 2)
  const [tailoredResumes, setTailoredResumes] = useState<TailoredResumeMetadata[]>([]);
  const [isLoadingTailored, setIsLoadingTailored] = useState<boolean>(false);
  const [previewTailoredUrl, setPreviewTailoredUrl] = useState<string | null>(null);
  const [reviewTailoredItem, setReviewTailoredItem] = useState<TailoredResumeMetadata | null>(null);

  // Notification / Success Feedback
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadResumes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await resumeService.listResumes();
      setResumes(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load resumes.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTailoredResumes = async () => {
    setIsLoadingTailored(true);
    try {
      const data = await tailoringService.listTailoredResumes();
      setTailoredResumes(data);
    } catch (err: any) {
      console.error('Failed to load tailored resumes:', err);
    } finally {
      setIsLoadingTailored(false);
    }
  };

  useEffect(() => {
    loadResumes();
    loadTailoredResumes();
  }, []);

  const handleDownloadOriginal = async (item: ResumeSummaryItem) => {
    try {
      const { blob, filename } = await resumeService.fetchOriginalMasterBlob(item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || item.original_filename || `${item.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(`Downloaded original: ${filename || item.original_filename || item.name}`);
    } catch (err: any) {
      showNotification(`Download failed: ${err.message}`);
    }
  };

  const handleOpenRename = (item: ResumeSummaryItem) => {
    setResumeToRename(item);
    setRenameInput(item.name);
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeToRename || !renameInput.trim()) return;
    setIsRenaming(true);
    try {
      await resumeService.updateResume(resumeToRename.id, { name: renameInput.trim() });
      setResumeToRename(null);
      await loadResumes();
      showNotification('Resume name updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to rename resume.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDownloadTailored = async (item: TailoredResumeMetadata, format: 'pdf' | 'docx') => {
    const targetId = item.tailored_resume_id || item.resume_id || item.id;
    try {
      await resumeService.exportResume(targetId, format);
      showNotification(`Downloaded ${format.toUpperCase()}`);
    } catch (err: any) {
      showNotification(`Download failed: ${err.message}`);
    }
  };

  const handleDeleteTailored = async (id: string) => {
    try {
      await tailoringService.deleteTailoredResume(id);
      await loadTailoredResumes();
      showNotification('Tailored resume deleted.');
    } catch (err: any) {
      showNotification(`Failed to delete: ${err.message}`);
    }
  };

  useEffect(() => {
    if (initialResumeIdToEdit) {
      handleOpenResume(initialResumeIdToEdit, false);
    } else if (initialResumeIdToPreview) {
      handleOpenResume(initialResumeIdToPreview, true);
    }
  }, [initialResumeIdToEdit, initialResumeIdToPreview]);

  // --- Open Editor / Preview ---
  const handleOpenResume = async (id: string, preview: boolean = false) => {
    setIsLoadingDetail(true);
    setError(null);
    try {
      const full = await resumeService.getResume(id);
      setStartInPreviewMode(preview);
      setActiveResume(full);
    } catch (err: any) {
      setError(err.message || 'Failed to open resume.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // --- Create Resume ---
  const handleCreateResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResumeName.trim()) return;

    setIsCreating(true);
    try {
      const created = await resumeService.createResume({
        name: newResumeName.trim(),
        is_default: newResumeIsDefault,
      });
      setIsCreateModalOpen(false);
      setNewResumeName('My Master Resume');
      setNewResumeIsDefault(false);
      await loadResumes();
      setActiveResume(created);
      showNotification('Resume created successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to create resume.');
    } finally {
      setIsCreating(false);
    }
  };

  // --- Set As Default ---
  const handleSetDefault = async (id: string) => {
    try {
      await resumeService.setDefaultResume(id);
      await loadResumes();
      showNotification('Default Master Resume updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to set default resume.');
    }
  };

  // --- Duplicate Resume ---
  const handleDuplicate = async (id: string) => {
    try {
      const cloned = await resumeService.duplicateResume(id);
      await loadResumes();
      showNotification(`Duplicated as "${cloned.name}".`);
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate resume.');
    }
  };

  // --- Delete Resume ---
  const confirmDelete = async () => {
    if (!resumeToDelete) return;
    setIsDeleting(true);
    try {
      await resumeService.deleteResume(resumeToDelete.id);
      setResumeToDelete(null);
      await loadResumes();
      showNotification('Resume deleted permanently.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete resume.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Import Handlers (Module 3) ---
  const handleFileSelection = (file: File) => {
    setImportError(null);
    const validExtensions = ['.pdf', '.docx'];
    const nameLower = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => nameLower.endsWith(ext));

    if (!isValidExt) {
      setImportError("This file type isn't supported. Please upload a PDF or DOCX resume.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImportError('Your resume is too large. Please upload a file smaller than 10 MB.');
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setImportError('The selected file is empty. Please select a valid document.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleImportResume = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportError(null);
    setImportStatusStep('Uploading resume...');

    const stepTimer1 = setTimeout(() => setImportStatusStep('Reading resume...'), 500);
    const stepTimer2 = setTimeout(() => setImportStatusStep('Extracting resume content...'), 1000);
    const stepTimer3 = setTimeout(() => setImportStatusStep('Organizing your resume...'), 1600);

    try {
      const result = await resumeService.uploadAndParseResume(selectedFile);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setIsImportModalOpen(false);
      setSelectedFile(null);

      // Reload resumes from backend to ensure the list and selectors update immediately
      await loadResumes();

      // Set active resume to the real, persisted resume returned by the backend
      const persistedResume = result.parsed_resume;
      setActiveResume(persistedResume);
      showNotification('Resume parsed and saved successfully! Your original document is ready for preview and tailoring.');
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setImportError(err.message || "We couldn't import this resume. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  // If currently editing a resume, render the ResumeEditor
  if (activeResume) {
    const isImportReview = activeResume.id.startsWith('draft-');
    return (
      <ResumeEditor
        initialResume={activeResume}
        isImportReview={isImportReview}
        initialPreviewMode={startInPreviewMode}
        onBack={() => {
          setActiveResume(null);
          loadResumes();
        }}
        onSaved={(updated) => {
          setActiveResume(updated);
          loadResumes();
          showNotification('Resume saved successfully!');
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* 1. Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Resume Foundation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your master resume and job-specific profiles as structured application data.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setSelectedFile(null);
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Import Resume
          </button>

          <button
            onClick={() => {
              setNewResumeName(resumes.length === 0 ? 'My Master Resume' : 'New Resume');
              setNewResumeIsDefault(resumes.length === 0);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Resume
          </button>
        </div>
      </div>

      {/* 2. Feedback Banners */}
      {authState !== 'logged_in' && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>You are viewing resumes in guest mode. Sign in to sync your profile across devices.</span>
          </div>
          <button
            onClick={() => onOpenAuth?.('login')}
            className="self-start sm:self-auto px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      {notification && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {error && authState === 'logged_in' && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadResumes}
            className="text-[11px] font-semibold underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search master resumes..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
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
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="recent_updated">Recently Updated</option>
            <option value="recent_created">Recently Created</option>
            <option value="name">Resume Title A-Z</option>
          </select>
        </div>
      </div>

      {/* 4. Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse p-4"
            />
          ))}
        </div>
      ) : (() => {
        const masterResumes = resumes.filter((item) => !item.is_tailored);
        const filteredMasters = masterResumes
          .filter((item) => {
            const q = searchQuery.toLowerCase().trim();
            if (!q) return true;
            return item.name.toLowerCase().includes(q);
          })
          .sort((a, b) => {
            if (sortBy === 'recent_updated') {
              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
            if (sortBy === 'recent_created') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'name') {
              return a.name.localeCompare(b.name);
            }
            return 0;
          });

        if (masterResumes.length === 0) {
          return (
            /* Empty State */
            <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  You don&apos;t have a master resume yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Create your master resume to establish your profile data foundation.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setNewResumeName('My Master Resume');
                    setNewResumeIsDefault(true);
                    setIsCreateModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Master Resume
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setImportError(null);
                    setIsImportModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  Import Existing
                </button>
              </div>
            </div>
          );
        }

        if (filteredMasters.length === 0) {
          return (
            <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2 bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No master resumes match &quot;{searchQuery}&quot;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline"
              >
                Clear Search
              </button>
            </div>
          );
        }

        return (
          /* Resume Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMasters.map((item) => (
              <div
                key={item.id}
                className={`group relative rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between hover:shadow-md ${
                  item.is_default
                    ? 'border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-300/50 dark:ring-amber-800/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Top: Badges */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {item.is_default ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          Master Resume
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(item.id)}
                          className="text-[11px] text-slate-400 hover:text-amber-500 flex items-center gap-1 transition-colors"
                          title="Set as Default Master"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Set as Master</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      {item.status}
                    </span>
                  </div>

                  {/* Resume Name */}
                  <h3
                    onClick={() => handleOpenResume(item.id)}
                    className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 cursor-pointer transition-colors line-clamp-1"
                  >
                    {item.name}
                  </h3>

                  {/* Template and Updated Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                    <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {(item.template_id || 'ats-classic').replace('-', ' ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Updated {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Card Bottom: Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setMasterPreviewItem(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Preview Original Master File"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview Original
                    </button>

                    <button
                      onClick={() => handleDownloadOriginal(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Download Unmodified Original File"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>

                    {onSelectMasterForATS && (
                      <button
                        onClick={() => onSelectMasterForATS(item.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Calculate ATS Score with this master resume"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        ATS Score
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenRename(item)}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Rename Resume"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(item.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Duplicate Resume"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setResumeToDelete(item)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                      title="Delete Resume"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 5. Tailored Resumes Section (Saved Tailored Versions Separated From Master Resumes) */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Tailored Resumes ({tailoredResumes.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Job-tailored versions generated from your master resumes. Saved separately and kept immutable.
          </p>
        </div>

        {isLoadingTailored ? (
          <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            Loading saved tailored resumes...
          </div>
        ) : tailoredResumes.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No tailored resumes generated yet. Use the ATS Score tab to match against a job description and generate one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tailoredResumes.map((tr) => (
              <div
                key={tr.id}
                className="rounded-xl border border-purple-200/80 dark:border-purple-900/40 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/40">
                      Tailored Resume
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(tr.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                    {tr.name}
                  </h3>

                  <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <p className="line-clamp-1">
                      <span className="font-medium text-slate-500 dark:text-slate-500">Target Role:</span>{' '}
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{tr.target_job_title || 'Target Job'}</span>
                    </p>
                    {tr.source_resume_name && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        Source Master: {tr.source_resume_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setReviewTailoredItem(tr)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Inspect AI change tracking highlights, diffs, and review changes"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Review AI Changes
                    </button>
                    <button
                      onClick={() => setPreviewTailoredUrl(`/api/resumes/${tr.tailored_resume_id || tr.id}/export?format=pdf&inline=true`)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownloadTailored(tr, 'pdf')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={() => handleDownloadTailored(tr, 'docx')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      DOCX
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteTailored(tr.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Delete Tailored Resume"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Create Resume Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Create New Resume
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateResume} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Resume Title
                </label>
                <input
                  type="text"
                  required
                  value={newResumeName}
                  onChange={(e) => setNewResumeName(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newResumeIsDefault}
                  onChange={(e) => setNewResumeIsDefault(e.target.checked)}
                  className="rounded"
                />
                Set as Master Resume
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {resumeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Delete &quot;{resumeToDelete.name}&quot;?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This will remove the selected master resume and its structured sections. Any historical tailored resumes created from it will remain safely preserved.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResumeToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Import Resume Modal (Module 3) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Import Resume
                </h3>
              </div>
              {!isImporting && (
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFile(null);
                    setImportError(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {importError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {isImporting ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {importStatusStep}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extracting structured information without external AI dependencies...
                </p>
              </div>
            ) : !selectedFile ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload your existing resume to create an editable structured resume.
                </p>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelection(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                  onClick={() => document.getElementById('resume-file-input')?.click()}
                >
                  <input
                    id="resume-file-input"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelection(e.target.files[0]);
                      }
                    }}
                  />
                  <FileUp className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Choose PDF or DOCX, or drag and drop here
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Supported formats: PDF, DOCX (Max 10 MB)
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                  >
                    Change file
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We will parse your resume into editable sections. You will review and confirm all details before anything is saved.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setIsImportModalOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportResume}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
                  >
                    Import Resume
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. Master Document Original Preview Modal */}
      {masterPreviewItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Original Master Document: {masterPreviewItem.original_filename || masterPreviewItem.name}
              </span>
              <button
                type="button"
                onClick={() => setMasterPreviewItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <MasterDocumentPreview
                resumeId={masterPreviewItem.id}
                originalFilename={masterPreviewItem.original_filename}
                fileSha256={masterPreviewItem.file_sha256}
                fileType={masterPreviewItem.file_type}
              />
            </div>
          </div>
        </div>
      )}

      {/* 10. Rename Master Resume Modal */}
      {resumeToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Rename Resume Record
              </h3>
              <button
                type="button"
                onClick={() => setResumeToRename(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRename} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Resume Title
                </label>
                <input
                  type="text"
                  required
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Updates the record title. The underlying uploaded document file remains untouched.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResumeToRename(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isRenaming ? 'Saving...' : 'Save Title'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. Tailored Resume Preview Modal */}
      {previewTailoredUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Tailored Resume Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewTailoredUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2 bg-slate-100 dark:bg-slate-950">
              <iframe
                src={previewTailoredUrl}
                title="Tailored Resume Preview"
                className="w-full h-full rounded-lg border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* 12. AI Change Tracking & Review Modal */}
      {reviewTailoredItem && (
        <TailoredResumeReviewModal
          isOpen={Boolean(reviewTailoredItem)}
          onClose={() => setReviewTailoredItem(null)}
          tailoredResumeId={reviewTailoredItem.tailored_resume_id || reviewTailoredItem.id}
          tailoredResumeName={reviewTailoredItem.name || reviewTailoredItem.tailored_resume_name}
          sourceResumeName={reviewTailoredItem.source_resume_name}
          targetJobTitle={reviewTailoredItem.target_job_title}
          onRefresh={loadTailoredResumes}
        />
      )}
    </div>
  );
};
