import React from 'react';
import { Experience } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { formatDateRange } from '../templates/templateRegistry';

interface ResumeExperienceProps {
  experiences?: Experience[];
  config: ResumeTemplateConfig;
}

export const ResumeExperience: React.FC<ResumeExperienceProps> = ({ experiences, config }) => {
  if (!experiences || experiences.length === 0) return null;

  // Filter out completely empty items
  const validExperiences = experiences.filter(
    (exp) => exp.company?.trim() || exp.job_title?.trim()
  );

  if (validExperiences.length === 0) return null;

  const { typography, colors, spacing } = config;

  return (
    <section>
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Work Experience
      </h2>

      <div className={spacing.itemGap}>
        {validExperiences.map((exp, index) => {
          const dateStr = formatDateRange(exp.start_date, exp.end_date, exp.is_current);
          const bullets = exp.bullets || [];

          return (
            <article key={exp.id || `exp-${index}`} className="break-inside-avoid">
              {/* Header row: Title & Dates */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div className="min-w-0 flex-1">
                  <span className={`${typography.itemTitleSize} ${colors.textPrimary} break-words`}>
                    {exp.job_title}
                  </span>
                  {exp.company && (
                    <span className={`${typography.itemSubtitleSize} ${colors.textSecondary} break-words`}>
                      {' '}• {exp.company}
                    </span>
                  )}
                </div>

                {dateStr && (
                  <span className={`${typography.metaSize} ${colors.textMuted} whitespace-nowrap shrink-0`}>
                    {dateStr}
                  </span>
                )}
              </div>

              {/* Sub-row: Location & Employment type if present */}
              {(exp.location || exp.employment_type) && (
                <div className={`${typography.metaSize} ${colors.textMuted} mt-0.5`}>
                  {[exp.location, exp.employment_type].filter(Boolean).join(' • ')}
                </div>
              )}

              {/* Optional brief paragraph description */}
              {exp.description && (
                <p className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} mt-1 break-words`}>
                  {exp.description}
                </p>
              )}

              {/* Semantic bullet list */}
              {bullets.length > 0 && (
                <ul className={`list-disc list-outside ml-4 mt-1.5 ${spacing.bulletGap}`}>
                  {bullets.map((bullet, bIndex) => {
                    const bulletText = typeof bullet === 'string' ? bullet : bullet.content;
                    if (!bulletText?.trim()) return null;
                    return (
                      <li
                        key={bullet.id || `b-${bIndex}`}
                        className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} break-words`}
                      >
                        {bulletText}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
