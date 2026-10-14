import React from 'react';
import { ResumeSummary as ResumeSummaryType } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';

interface ResumeSummaryProps {
  summary?: ResumeSummaryType | null;
  config: ResumeTemplateConfig;
}

export const ResumeSummary: React.FC<ResumeSummaryProps> = ({ summary, config }) => {
  const content = summary?.summary?.trim();
  if (!content) return null;

  const { typography, colors, spacing } = config;

  return (
    <section className="break-inside-avoid">
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Professional Summary
      </h2>
      <p className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} whitespace-pre-line break-words`}>
        {content}
      </p>
    </section>
  );
};
