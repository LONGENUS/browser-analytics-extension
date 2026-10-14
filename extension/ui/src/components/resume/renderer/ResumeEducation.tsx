import React from 'react';
import { Education } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { formatDateRange } from '../templates/templateRegistry';

interface ResumeEducationProps {
  educations?: Education[];
  config: ResumeTemplateConfig;
}

export const ResumeEducation: React.FC<ResumeEducationProps> = ({ educations, config }) => {
  if (!educations || educations.length === 0) return null;

  const validEducations = educations.filter((edu) => edu.institution?.trim());
  if (validEducations.length === 0) return null;

  const { typography, colors, spacing } = config;

  return (
    <section>
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Education
      </h2>

      <div className={spacing.itemGap}>
        {validEducations.map((edu, index) => {
          const dateStr = formatDateRange(edu.start_date, edu.end_date, false);

          // Degree + Field of study formatting without awkward punctuation
          const degreeParts = [edu.degree?.trim(), edu.field_of_study?.trim()].filter(Boolean);
          const degreeLine = degreeParts.length > 0 ? degreeParts.join(' in ') : null;

          return (
            <article key={edu.id || `edu-${index}`} className="break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div className="min-w-0 flex-1">
                  <span className={`${typography.itemTitleSize} ${colors.textPrimary} break-words`}>
                    {edu.institution}
                  </span>
                  {edu.location && (
                    <span className={`${typography.metaSize} ${colors.textMuted}`}>
                      {' '}• {edu.location}
                    </span>
                  )}
                </div>

                {dateStr && (
                  <span className={`${typography.metaSize} ${colors.textMuted} whitespace-nowrap shrink-0`}>
                    {dateStr}
                  </span>
                )}
              </div>

              {degreeLine && (
                <div className={`${typography.itemSubtitleSize} ${colors.textSecondary} mt-0.5 break-words`}>
                  {degreeLine}
                </div>
              )}

              {edu.description && (
                <p className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} mt-1 break-words`}>
                  {edu.description}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
