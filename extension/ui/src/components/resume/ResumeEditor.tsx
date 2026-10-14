import React, { useState } from 'react';
import {
  FullStructuredResume,
  Experience,
  Education,
  Skill,
  Project,
  Certification,
  ResumeLink,
  Bullet,
} from '../../types/resume';
import { resumeService } from '../../services/resume.service';
import { ResumePreview } from './ResumePreview';
import {
  ArrowLeft,
  Save,
  Eye,
  Edit3,
  Star,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderGit2,
  Award,
  Link as LinkIcon,
  User,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ResumeEditorProps {
  initialResume: FullStructuredResume;
  isImportReview?: boolean;
  initialPreviewMode?: boolean;
  onBack: () => void;
  onSaved: (updated: FullStructuredResume) => void;
}

type EditorSection =
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'links';

const SKILL_CATEGORIES = [
  'Languages',
  'Frameworks',
  'Databases',
  'Cloud & DevOps',
  'Tools & Platforms',
  'Soft Skills',
  'Other',
];

export const ResumeEditor: React.FC<ResumeEditorProps> = ({
  initialResume,
  isImportReview = false,
  initialPreviewMode = false,
  onBack,
  onSaved,
}) => {
  const [resume, setResume] = useState<FullStructuredResume>(initialResume);
  const [activeSection, setActiveSection] = useState<EditorSection>('personal');
  const [previewMode, setPreviewMode] = useState<boolean>(initialPreviewMode);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillCategory, setNewSkillCategory] = useState<string>('Languages');

  const isDraftReview = isImportReview || resume.id.startsWith('draft-');

  // --- Save Handler ---
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage(null);

    try {
      if (isDraftReview) {
        // Step 1: Create new structured resume record in DB preserving original master file metadata
        const created = await resumeService.createResume({
          name: resume.name.trim() || 'Imported Resume',
          is_default: resume.is_default || false,
          file_sha256: resume.file_sha256,
          original_filename: resume.original_filename,
          original_file_path: resume.original_file_path,
          file_type: resume.file_type,
          file_size: resume.file_size,
        });

        // Step 2: Persist all reviewed/edited structured sections
        const updated = await resumeService.updateResume(created.id, {
          name: resume.name.trim() || 'Imported Resume',
          is_default: resume.is_default || false,
          status: 'ready',
          file_sha256: resume.file_sha256,
          original_filename: resume.original_filename,
          original_file_path: resume.original_file_path,
          file_type: resume.file_type,
          file_size: resume.file_size,
          personal_info: resume.personal_info,
          summary: resume.summary,
          experiences: resume.experiences,
          educations: resume.educations,
          skills: resume.skills,
          projects: resume.projects,
          certifications: resume.certifications,
          links: resume.links,
        });

        setResume(updated);
        setSaveStatus('saved');
        onSaved(updated);
        setTimeout(() => setSaveStatus('idle'), 3000);
        return;
      }

      const updated = await resumeService.updateResume(resume.id, {
        name: resume.name,
        is_default: resume.is_default,
        status: resume.status,
        personal_info: resume.personal_info,
        summary: resume.summary,
        experiences: resume.experiences,
        educations: resume.educations,
        skills: resume.skills,
        projects: resume.projects,
        certifications: resume.certifications,
        links: resume.links,
      });
      setResume(updated);
      setSaveStatus('saved');
      onSaved(updated);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save resume.');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Toggle Default / Master ---
  const handleToggleDefault = async () => {
    try {
      if (!resume.is_default) {
        await resumeService.setDefaultResume(resume.id);
        setResume((prev) => ({ ...prev, is_default: true }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to set master resume.');
    }
  };

  // --- Personal Info Handlers ---
  const updatePersonalInfo = (field: string, value: string) => {
    setResume((prev) => ({
      ...prev,
      personal_info: {
        ...(prev.personal_info || {}),
        [field]: value,
      },
    }));
  };

  // --- Summary Handler ---
  const updateSummary = (value: string) => {
    setResume((prev) => ({
      ...prev,
      summary: {
        ...(prev.summary || {}),
        summary: value,
      },
    }));
  };

  // --- Experience Handlers ---
  const addExperience = () => {
    const newExp: Experience = {
      company: '',
      job_title: '',
      location: '',
      employment_type: 'Full-time',
      start_date: '',
      end_date: '',
      is_current: false,
      description: '',
      display_order: resume.experiences.length,
      bullets: [],
    };
    setResume((prev) => ({
      ...prev,
      experiences: [...prev.experiences, newExp],
    }));
  };

  const updateExperience = (index: number, updates: Partial<Experience>) => {
    setResume((prev) => {
      const updated = [...prev.experiences];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, experiences: updated };
    });
  };

  const removeExperience = (index: number) => {
    setResume((prev) => {
      const updated = prev.experiences.filter((_, i) => i !== index);
      return { ...prev, experiences: updated };
    });
  };

  const moveExperience = (index: number, direction: 'up' | 'down') => {
    setResume((prev) => {
      const updated = [...prev.experiences];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      updated.forEach((exp, idx) => (exp.display_order = idx));
      return { ...prev, experiences: updated };
    });
  };

  // Bullets for Experience
  const addExperienceBullet = (expIndex: number) => {
    setResume((prev) => {
      const updated = [...prev.experiences];
      const exp = updated[expIndex];
      const newBullet: Bullet = {
        content: '',
        display_order: exp.bullets.length,
      };
      exp.bullets = [...exp.bullets, newBullet];
      return { ...prev, experiences: updated };
    });
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, content: string) => {
    setResume((prev) => {
      const updated = [...prev.experiences];
      updated[expIndex].bullets[bulletIndex].content = content;
      return { ...prev, experiences: updated };
    });
  };

  const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
    setResume((prev) => {
      const updated = [...prev.experiences];
      updated[expIndex].bullets = updated[expIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...prev, experiences: updated };
    });
  };

  // --- Education Handlers ---
  const addEducation = () => {
    const newEdu: Education = {
      institution: '',
      degree: '',
      field_of_study: '',
      location: '',
      start_date: '',
      end_date: '',
      description: '',
      display_order: resume.educations.length,
    };
    setResume((prev) => ({
      ...prev,
      educations: [...prev.educations, newEdu],
    }));
  };

  const updateEducation = (index: number, updates: Partial<Education>) => {
    setResume((prev) => {
      const updated = [...prev.educations];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, educations: updated };
    });
  };

  const removeEducation = (index: number) => {
    setResume((prev) => ({
      ...prev,
      educations: prev.educations.filter((_, i) => i !== index),
    }));
  };

  // --- Skill Handlers ---
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSkillName.trim();
    if (!clean) return;

    const newSkill: Skill = {
      skill_name: clean,
      category: newSkillCategory,
      display_order: resume.skills.length,
    };

    setResume((prev) => ({
      ...prev,
      skills: [...prev.skills, newSkill],
    }));
    setNewSkillName('');
  };

  const removeSkill = (index: number) => {
    setResume((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  // --- Project Handlers ---
  const addProject = () => {
    const newProj: Project = {
      name: '',
      description: '',
      url: '',
      technologies: '',
      display_order: resume.projects.length,
      bullets: [],
    };
    setResume((prev) => ({
      ...prev,
      projects: [...prev.projects, newProj],
    }));
  };

  const updateProject = (index: number, updates: Partial<Project>) => {
    setResume((prev) => {
      const updated = [...prev.projects];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, projects: updated };
    });
  };

  const removeProject = (index: number) => {
    setResume((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const addProjectBullet = (projIndex: number) => {
    setResume((prev) => {
      const updated = [...prev.projects];
      const proj = updated[projIndex];
      proj.bullets = [...proj.bullets, { content: '', display_order: proj.bullets.length }];
      return { ...prev, projects: updated };
    });
  };

  const updateProjectBullet = (projIndex: number, bulletIndex: number, content: string) => {
    setResume((prev) => {
      const updated = [...prev.projects];
      updated[projIndex].bullets[bulletIndex].content = content;
      return { ...prev, projects: updated };
    });
  };

  const removeProjectBullet = (projIndex: number, bulletIndex: number) => {
    setResume((prev) => {
      const updated = [...prev.projects];
      updated[projIndex].bullets = updated[projIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...prev, projects: updated };
    });
  };

  // --- Certification Handlers ---
  const addCertification = () => {
    const newCert: Certification = {
      name: '',
      issuer: '',
      issue_date: '',
      expiration_date: '',
      credential_id: '',
      credential_url: '',
      display_order: resume.certifications.length,
    };
    setResume((prev) => ({
      ...prev,
      certifications: [...prev.certifications, newCert],
    }));
  };

  const updateCertification = (index: number, updates: Partial<Certification>) => {
    setResume((prev) => {
      const updated = [...prev.certifications];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, certifications: updated };
    });
  };

  const removeCertification = (index: number) => {
    setResume((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  // --- Link Handlers ---
  const addLink = () => {
    const newLink: ResumeLink = {
      label: 'LinkedIn',
      url: '',
      display_order: resume.links.length,
    };
    setResume((prev) => ({
      ...prev,
      links: [...prev.links, newLink],
    }));
  };

  const updateLink = (index: number, updates: Partial<ResumeLink>) => {
    setResume((prev) => {
      const updated = [...prev.links];
      updated[index] = { ...updated[index], ...updates };
      return { ...prev, links: updated };
    });
  };

  const removeLink = (index: number) => {
    setResume((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  };

  const sections: { key: EditorSection; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'personal', label: 'Personal Info', icon: <User className="w-3.5 h-3.5" /> },
    { key: 'summary', label: 'Summary', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'experience', label: 'Experience', icon: <Briefcase className="w-3.5 h-3.5" />, count: resume.experiences.length },
    { key: 'education', label: 'Education', icon: <GraduationCap className="w-3.5 h-3.5" />, count: resume.educations.length },
    { key: 'skills', label: 'Skills', icon: <Wrench className="w-3.5 h-3.5" />, count: resume.skills.length },
    { key: 'projects', label: 'Projects', icon: <FolderGit2 className="w-3.5 h-3.5" />, count: resume.projects.length },
    { key: 'certifications', label: 'Certifications', icon: <Award className="w-3.5 h-3.5" />, count: resume.certifications.length },
    { key: 'links', label: 'Links', icon: <LinkIcon className="w-3.5 h-3.5" />, count: resume.links.length },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* 1. Header Toolbar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to Resumes"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={resume.name}
            onChange={(e) => setResume((prev) => ({ ...prev, name: e.target.value }))}
            className="font-semibold text-sm sm:text-base bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-hidden px-1 py-0.5 transition-colors text-slate-900 dark:text-white max-w-[200px] sm:max-w-xs"
            placeholder="Resume Name"
          />
          {resume.is_default ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              Master
            </span>
          ) : (
            <button
              onClick={handleToggleDefault}
              className="text-xs text-slate-400 hover:text-amber-500 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
              title="Set as Master Resume"
            >
              <Star className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Set as Master</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Preview Toggle */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              previewMode
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                Saved
              </>
            ) : isDraftReview ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save as Resume
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Draft Review Header Banner */}
      {isDraftReview && (
        <div className="bg-blue-50/90 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Review Extracted Resume:</strong> We organized your uploaded resume into structured sections. Please review and make any corrections before saving.
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 font-semibold text-blue-700 dark:text-blue-300 self-start sm:self-auto shrink-0">
            Import Review Draft
          </span>
        </div>
      )}

      {/* Unsupported Sections Notice (Section 26) */}
      {resume.unsupported_sections && resume.unsupported_sections.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">
                Additional Sections Detected ({resume.unsupported_sections.map((s) => s.title).join(', ')}):
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                The original document contained sections that do not yet have separate tables. You can manually copy this text into your Summary or Experience entries:
              </p>
              <div className="mt-1 space-y-1 bg-amber-100/60 dark:bg-amber-900/40 p-2 rounded text-[11px]">
                {resume.unsupported_sections.map((sec, idx) => (
                  <div key={idx}>
                    <span className="font-semibold">{sec.title}:</span> {sec.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      {previewMode ? (
        <div className="p-4 sm:p-6 overflow-y-auto">
          <ResumePreview resume={resume} onUpdateResume={setResume} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-3 sm:p-6 gap-6">
          {/* Section Navigation Sidebar */}
          <aside className="w-full md:w-56 shrink-0">
            <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0">
              {sections.map((sec) => (
                <button
                  key={sec.key}
                  onClick={() => setActiveSection(sec.key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeSection === sec.key
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200/60 dark:border-blue-800/40'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {sec.icon}
                    {sec.label}
                  </span>
                  {sec.count !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {sec.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Active Section Form */}
          <main className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-xs">
            {/* 1. Personal Information */}
            {activeSection === 'personal' && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={resume.personal_info?.full_name || ''}
                      onChange={(e) => updatePersonalInfo('full_name', e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Headline / Title
                    </label>
                    <input
                      type="text"
                      value={resume.personal_info?.headline || ''}
                      onChange={(e) => updatePersonalInfo('headline', e.target.value)}
                      placeholder="e.g. Senior Full-Stack Engineer"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={resume.personal_info?.email || ''}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                      placeholder="e.g. jane@example.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={resume.personal_info?.phone || ''}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      placeholder="e.g. +1 (555) 000-0000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={resume.personal_info?.location || ''}
                      onChange={(e) => updatePersonalInfo('location', e.target.value)}
                      placeholder="e.g. San Francisco, CA / Remote"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Personal Website
                    </label>
                    <input
                      type="url"
                      value={resume.personal_info?.website || ''}
                      onChange={(e) => updatePersonalInfo('website', e.target.value)}
                      placeholder="https://janedoe.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={resume.personal_info?.linkedin_url || ''}
                      onChange={(e) => updatePersonalInfo('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/janedoe"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      GitHub URL
                    </label>
                    <input
                      type="url"
                      value={resume.personal_info?.github_url || ''}
                      onChange={(e) => updatePersonalInfo('github_url', e.target.value)}
                      placeholder="https://github.com/janedoe"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Professional Summary */}
            {activeSection === 'summary' && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                  Professional Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Concise 2–4 sentence summary highlighting your strengths, core domain expertise, and career focus.
                </p>
                <textarea
                  rows={6}
                  value={resume.summary?.summary || ''}
                  onChange={(e) => updateSummary(e.target.value)}
                  placeholder="Experienced Software Engineer specializing in distributed backend systems and frontend architecture..."
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-hidden focus:border-blue-500"
                />
                <div className="text-right text-[11px] text-slate-400">
                  {(resume.summary?.summary || '').length} characters
                </div>
              </div>
            )}

            {/* 3. Experience */}
            {activeSection === 'experience' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Work Experience
                  </h2>
                  <button
                    onClick={addExperience}
                    className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Position
                  </button>
                </div>

                {resume.experiences.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No work experience entries yet. Click &quot;Add Position&quot; to begin.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {resume.experiences.map((exp, expIdx) => (
                      <div
                        key={exp.id || expIdx}
                        className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Position #{expIdx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveExperience(expIdx, 'up')}
                              disabled={expIdx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveExperience(expIdx, 'down')}
                              disabled={expIdx === resume.experiences.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeExperience(expIdx)}
                              className="p-1 text-red-500 hover:text-red-700 ml-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              Company *
                            </label>
                            <input
                              type="text"
                              value={exp.company}
                              onChange={(e) => updateExperience(expIdx, { company: e.target.value })}
                              placeholder="e.g. Acme Corp"
                              className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              Job Title *
                            </label>
                            <input
                              type="text"
                              value={exp.job_title}
                              onChange={(e) => updateExperience(expIdx, { job_title: e.target.value })}
                              placeholder="e.g. Software Engineer"
                              className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              Location
                            </label>
                            <input
                              type="text"
                              value={exp.location || ''}
                              onChange={(e) => updateExperience(expIdx, { location: e.target.value })}
                              placeholder="e.g. New York, NY / Remote"
                              className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                              Dates
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={exp.start_date || ''}
                                onChange={(e) => updateExperience(expIdx, { start_date: e.target.value })}
                                placeholder="Start (e.g. 2021)"
                                className="w-1/2 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                              />
                              <input
                                type="text"
                                value={exp.is_current ? '' : exp.end_date || ''}
                                disabled={exp.is_current}
                                onChange={(e) => updateExperience(expIdx, { end_date: e.target.value })}
                                placeholder={exp.is_current ? 'Present' : 'End (e.g. 2023)'}
                                className="w-1/2 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-40"
                              />
                            </div>
                            <label className="inline-flex items-center gap-1.5 mt-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exp.is_current}
                                onChange={(e) =>
                                  updateExperience(expIdx, {
                                    is_current: e.target.checked,
                                    end_date: e.target.checked ? null : exp.end_date,
                                  })
                                }
                                className="rounded"
                              />
                              I currently work here
                            </label>
                          </div>
                        </div>

                        {/* Bullets Sub-editor */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              Achievement Bullets
                            </span>
                            <button
                              onClick={() => addExperienceBullet(expIdx)}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" /> Add Bullet
                            </button>
                          </div>

                          {exp.bullets.map((b, bIdx) => (
                            <div key={b.id || bIdx} className="flex items-center gap-1.5">
                              <span className="text-slate-400 text-xs">•</span>
                              <input
                                type="text"
                                value={b.content}
                                onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                                placeholder="Describe a quantifiable achievement, technical impact, or result..."
                                className="flex-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                              />
                              <button
                                onClick={() => removeExperienceBullet(expIdx, bIdx)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Skills */}
            {activeSection === 'skills' && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                  Skills & Technologies
                </h2>

                {/* Add Skill Form */}
                <form onSubmit={handleAddSkill} className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Enter skill (e.g. Python, Docker)"
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                  />
                  <select
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs"
                  >
                    {SKILL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Skill
                  </button>
                </form>

                {/* Chips Grid */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {resume.skills.map((skill, sIdx) => (
                    <div
                      key={skill.id || sIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200"
                    >
                      <span>{skill.skill_name}</span>
                      {skill.category && (
                        <span className="text-[10px] text-slate-400">({skill.category})</span>
                      )}
                      <button
                        onClick={() => removeSkill(sIdx)}
                        className="text-slate-400 hover:text-red-500 ml-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {resume.skills.length === 0 && (
                    <div className="text-xs text-slate-400 py-4">
                      No skills added yet. Add programming languages, frameworks, or tools above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Education */}
            {activeSection === 'education' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Education
                  </h2>
                  <button
                    onClick={addEducation}
                    className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Education
                  </button>
                </div>

                {resume.educations.map((edu, eduIdx) => (
                  <div
                    key={edu.id || eduIdx}
                    className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Education #{eduIdx + 1}
                      </span>
                      <button
                        onClick={() => removeEducation(eduIdx)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Institution *
                        </label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => updateEducation(eduIdx, { institution: e.target.value })}
                          placeholder="e.g. Stanford University"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Degree & Field of Study
                        </label>
                        <input
                          type="text"
                          value={edu.degree || ''}
                          onChange={(e) => updateEducation(eduIdx, { degree: e.target.value })}
                          placeholder="e.g. B.S. in Computer Science"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Graduation Year / Dates
                        </label>
                        <input
                          type="text"
                          value={edu.end_date || ''}
                          onChange={(e) => updateEducation(eduIdx, { end_date: e.target.value })}
                          placeholder="e.g. 2019 – 2023"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. Projects */}
            {activeSection === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Projects
                  </h2>
                  <button
                    onClick={addProject}
                    className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Project
                  </button>
                </div>

                {resume.projects.map((proj, pIdx) => (
                  <div
                    key={proj.id || pIdx}
                    className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Project #{pIdx + 1}
                      </span>
                      <button
                        onClick={() => removeProject(pIdx)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Project Name *
                        </label>
                        <input
                          type="text"
                          value={proj.name}
                          onChange={(e) => updateProject(pIdx, { name: e.target.value })}
                          placeholder="e.g. Distributed Crawler Engine"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Project URL
                        </label>
                        <input
                          type="url"
                          value={proj.url || ''}
                          onChange={(e) => updateProject(pIdx, { url: e.target.value })}
                          placeholder="https://github.com/..."
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                        Technologies Used
                      </label>
                      <input
                        type="text"
                        value={proj.technologies || ''}
                        onChange={(e) => updateProject(pIdx, { technologies: e.target.value })}
                        placeholder="e.g. Python, FastAPI, Docker, Redis"
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={proj.description || ''}
                        onChange={(e) => updateProject(pIdx, { description: e.target.value })}
                        placeholder="Brief summary of what the project achieves..."
                        className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    {/* Project Bullets */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Highlights & Bullets
                        </span>
                        <button
                          onClick={() => addProjectBullet(pIdx)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Add Highlight
                        </button>
                      </div>
                      {proj.bullets.map((b, bIdx) => (
                        <div key={b.id || bIdx} className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs">•</span>
                          <input
                            type="text"
                            value={b.content}
                            onChange={(e) => updateProjectBullet(pIdx, bIdx, e.target.value)}
                            placeholder="Key accomplishment or performance improvement..."
                            className="flex-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                          <button
                            onClick={() => removeProjectBullet(pIdx, bIdx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 7. Certifications */}
            {activeSection === 'certifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Certifications
                  </h2>
                  <button
                    onClick={addCertification}
                    className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Certification
                  </button>
                </div>

                {resume.certifications.map((cert, cIdx) => (
                  <div
                    key={cert.id || cIdx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Certification #{cIdx + 1}
                      </span>
                      <button
                        onClick={() => removeCertification(cIdx)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Certificate Name *
                        </label>
                        <input
                          type="text"
                          value={cert.name}
                          onChange={(e) => updateCertification(cIdx, { name: e.target.value })}
                          placeholder="e.g. AWS Certified Solutions Architect"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                          Issuing Organization
                        </label>
                        <input
                          type="text"
                          value={cert.issuer || ''}
                          onChange={(e) => updateCertification(cIdx, { issuer: e.target.value })}
                          placeholder="e.g. Amazon Web Services"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 8. Links */}
            {activeSection === 'links' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Additional Links
                  </h2>
                  <button
                    onClick={addLink}
                    className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Link
                  </button>
                </div>

                {resume.links.map((lnk, lIdx) => (
                  <div key={lnk.id || lIdx} className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={lnk.label}
                      onChange={(e) => updateLink(lIdx, { label: e.target.value })}
                      placeholder="Label (e.g. Portfolio)"
                      className="w-1/3 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                    <input
                      type="url"
                      value={lnk.url}
                      onChange={(e) => updateLink(lIdx, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    />
                    <button
                      onClick={() => removeLink(lIdx)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
