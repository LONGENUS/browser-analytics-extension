import React from 'react';
import { FullStructuredResume } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { ResumeHeader } from './ResumeHeader';
import { ResumeSummary } from './ResumeSummary';
import { ResumeExperience } from './ResumeExperience';
import { ResumeSkills } from './ResumeSkills';
import { ResumeProjects } from './ResumeProjects';
import { ResumeEducation } from './ResumeEducation';
import { ResumeCertifications } from './ResumeCertifications';
import { ResumeLinks } from './ResumeLinks';

export interface ResumeDocumentRendererProps {
  resume: FullStructuredResume;
  config: ResumeTemplateConfig;
  className?: string;
}

/**
 * TailorResume — Unified Resume Document Renderer (Module 7)
 *
 * Core Architectural Mandate:
 * - Same renderer drives BOTH the interactive browser preview and future Module 8 PDF/DOCX generation.
 * - Resume data is strictly read-only and never mutated.
 * - Semantic HTML5 tree guarantees ATS parsability and high accessibility.
 * - Print-aware CSS ensures natural pagination without clipping or truncating bullets.
 */
export const ResumeDocumentRenderer: React.FC<ResumeDocumentRendererProps> = ({
  resume,
  config,
  className = '',
}) => {
  const { typography, spacing, colors } = config;

  return (
    <article
      data-testid="resume-document"
      data-template-id={config.id}
      data-template-version={config.version}
      className={`resume-document bg-white text-slate-900 ${typography.fontFamily} ${spacing.pagePadding} shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 transition-all ${className}`}
      style={{
        // Standard A4 aspect / minimum document frame
        minHeight: '297mm',
        width: '100%',
        maxWidth: '210mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        color: '#0f172a',
      }}
    >
      <div className={spacing.sectionGap}>
        {/* 1. Header (Name, Headline, Contact) */}
        <ResumeHeader personalInfo={resume.personal_info} config={config} />

        {/* 2. Professional Summary */}
        <ResumeSummary summary={resume.summary} config={config} />

        {/* 3. Work Experience */}
        <ResumeExperience experiences={resume.experiences} config={config} />

        {/* 4. Skills */}
        <ResumeSkills skills={resume.skills} config={config} />

        {/* 5. Projects */}
        <ResumeProjects projects={resume.projects} config={config} />

        {/* 6. Education */}
        <ResumeEducation educations={resume.educations} config={config} />

        {/* 7. Certifications */}
        <ResumeCertifications certifications={resume.certifications} config={config} />

        {/* 8. Links & Portfolios */}
        <ResumeLinks links={resume.links} config={config} />
      </div>
    </article>
  );
};
