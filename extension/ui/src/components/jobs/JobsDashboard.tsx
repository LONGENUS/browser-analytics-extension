import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building,
  MapPin,
  ExternalLink,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  Clock,
  Loader2,
  X,
  CheckCircle2,
  Sparkles,
  Search,
} from 'lucide-react';
import { jobsService } from '../../services/jobs.service';
import { Job, JobUpdateInput } from '../../types/job';
import { JobDetectionPanel } from './JobDetectionPanel';
import { JobMatchModal } from './JobMatchModal';
import { ResumeTailorModal } from '../resume/ResumeTailorModal';
import { sanitizeUrl } from '../resume/templates/templateRegistry';

export const JobsDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent_saved' | 'recent_updated' | 'title'>('recent_saved');

  // Job Match Modal
  const [matchJobModal, setMatchJobModal] = useState<Job | null>(null);
  // Resume Tailor Modal
  const [tailorJobModal, setTailorJobModal] = useState<Job | null>(null);

  // Active Job Detail / Edit Modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCompany, setEditCompany] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete confirmation
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await jobsService.listJobs();
      setJobs(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleJobSaved = (newJob: Job) => {
    setJobs((prev) => {
      const exists = prev.some((j) => j.id === newJob.id);
      if (exists) {
        return prev.map((j) => (j.id === newJob.id ? newJob : j));
      }
      return [newJob, ...prev];
    });
    showNotification(`Job "${newJob.job_title}" saved successfully!`);
  };

  const handleOpenDetail = (job: Job) => {
    setSelectedJob(job);
    setEditTitle(job.job_title);
    setEditCompany(job.company_name || '');
    setEditLocation(job.location || '');
    setEditDescription(job.job_description);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedJob) return;
    if (!editTitle.trim()) {
      showNotification('Job title cannot be empty.');
      return;
    }
    if (!editDescription.trim() || editDescription.trim().length < 10) {
      showNotification('Job description must be at least 10 characters.');
      return;
    }

    setIsUpdating(true);
    try {
      const payload: JobUpdateInput = {
        job_title: editTitle.trim(),
        company_name: editCompany.trim() || null,
        location: editLocation.trim() || null,
        job_description: editDescription.trim(),
      };
      const updated = await jobsService.updateJob(selectedJob.id, payload);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setSelectedJob(updated);
      setIsEditing(false);
      showNotification('Job updated successfully!');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update job.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await jobsService.deleteJob(jobToDelete.id);
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      if (selectedJob?.id === jobToDelete.id) {
        setSelectedJob(null);
      }
      setJobToDelete(null);
      showNotification('Job deleted successfully.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete job.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSavedDate = (isoStr: string) => {
    if (!isoStr) return 'Recently';
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Detection & Manual Ingestion Panel */}
      <JobDetectionPanel onJobSaved={handleJobSaved} />

      {/* Saved Jobs Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Saved Jobs Library
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {jobs.length}
          </span>
        </div>
      </div>

      {/* Search and Filter Controls */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs, companies, locations..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <span className="text-[10px] text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="recent_saved">Recently Saved</option>
                <option value="recent_updated">Recently Updated</option>
                <option value="title">Job Title A-Z</option>
              </select>
            </div>
          </div>

          {/* Source Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'All Sources' },
              { id: 'linkedin', label: 'LinkedIn' },
              { id: 'indeed', label: 'Indeed' },
              { id: 'naukri', label: 'Naukri' },
              { id: 'company_site', label: 'Company' },
              { id: 'other', label: 'Other' },
            ].map((src) => {
              const isSelected = selectedSource === src.id;
              return (
                <button
                  key={src.id}
                  onClick={() => setSelectedSource(src.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wider uppercase transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {src.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Job List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
          <p>Loading saved jobs...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 text-center space-y-2">
          <AlertCircle className="w-5 h-5 mx-auto" />
          <p>{error}</p>
          <button
            onClick={loadJobs}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold text-xs"
          >
            Retry
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2.5 bg-white/50 dark:bg-slate-900/50">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            No saved jobs yet
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Open a job listing in another tab and click <strong>Detect Job</strong>, or paste one manually above.
          </p>
        </div>
      ) : (() => {
        const filteredJobs = jobs
          .filter((job) => {
            const q = searchQuery.toLowerCase().trim();
            const matchSearch =
              !q ||
              job.job_title.toLowerCase().includes(q) ||
              (job.company_name || '').toLowerCase().includes(q) ||
              (job.location || '').toLowerCase().includes(q);

            const matchSource =
              selectedSource === 'all' ||
              job.source.toLowerCase() === selectedSource.toLowerCase();

            return matchSearch && matchSource;
          })
          .sort((a, b) => {
            if (sortBy === 'recent_saved') {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'recent_updated') {
              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
            if (sortBy === 'title') {
              return a.job_title.localeCompare(b.job_title);
            }
            return 0;
          });

        if (filteredJobs.length === 0) {
          return (
            <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-2 bg-white dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No saved jobs match your current search and filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSource('all');
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline"
              >
                Clear Filters
              </button>
            </div>
          );
        }

        return (
          <div className="space-y-2">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition-colors shadow-xs space-y-2"
              >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {job.job_title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {job.company_name && (
                      <span className="flex items-center gap-1 truncate font-medium">
                        <Building className="w-3 h-3 shrink-0" />
                        {job.company_name}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {job.location}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                  {job.source}
                </span>
              </div>

              {/* Description Preview */}
              <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {job.job_description}
              </p>

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                  <Clock className="w-3 h-3" />
                  Saved {formatSavedDate(job.created_at)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMatchJobModal(job)}
                    className="py-1 px-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1 text-[11px] transition-colors"
                    title="Analyze Job Match"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Job Match</span>
                  </button>

                  {sanitizeUrl(job.source_url) && (
                    <a
                      href={sanitizeUrl(job.source_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="Open Original Job Listing"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenDetail(job)}
                    className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="View & Edit Job Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setJobToDelete(job)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Job"
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

      {/* Job Detail & Edit Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-[440px] max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {isEditing ? 'Edit Saved Job' : 'Job Details'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Company
                      </label>
                      <input
                        type="text"
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Job Description *
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {editDescription.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={12}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px] leading-relaxed resize-y"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedJob.job_title}
                    </h2>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-1">
                      {selectedJob.company_name && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Building className="w-3.5 h-3.5" />
                          {selectedJob.company_name}
                        </span>
                      )}
                      {selectedJob.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedJob.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {sanitizeUrl(selectedJob.source_url) && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 truncate max-w-[280px]">
                        {selectedJob.source_url}
                      </span>
                      <a
                        href={sanitizeUrl(selectedJob.source_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 shrink-0 text-[11px] hover:underline"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Job Description
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
                      {selectedJob.job_description}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isUpdating}
                    className="py-1.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setJobToDelete(selectedJob)}
                    className="py-1.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMatchJobModal(selectedJob)}
                      className="py-1.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analyze Match</span>
                    </button>

                    <button
                      onClick={() => {
                        const j = selectedJob;
                        setSelectedJob(null);
                        setTailorJobModal(j);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tailor</span>
                    </button>

                    <button
                      onClick={() => setIsEditing(true)}
                      className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-2xl">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Delete Saved Job?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete <strong>"{jobToDelete.job_title}"</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setJobToDelete(null)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module 5 Job Match Modal */}
      {matchJobModal && (
        <JobMatchModal
          job={matchJobModal}
          isOpen={!!matchJobModal}
          onClose={() => setMatchJobModal(null)}
        />
      )}

      {/* Module 6 Resume Tailor Modal */}
      {tailorJobModal && (
        <ResumeTailorModal
          job={tailorJobModal}
          isOpen={!!tailorJobModal}
          onClose={() => setTailorJobModal(null)}
          onSaved={() => {
            showNotification('Tailored resume saved successfully as a new version!');
            loadJobs();
          }}
        />
      )}
    </div>
  );
};
