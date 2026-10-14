import React from 'react';
import { Project } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { sanitizeUrl } from '../templates/templateRegistry';

interface ResumeProjectsProps {
  projects?: Project[];
  config: ResumeTemplateConfig;
}

export const ResumeProjects: React.FC<ResumeProjectsProps> = ({ projects, config }) => {
  if (!projects || projects.length === 0) return null;

  const validProjects = projects.filter((p) => p.name?.trim());
  if (validProjects.length === 0) return null;

  const { typography, colors, spacing } = config;

  return (
    <section>
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Projects
      </h2>

      <div className={spacing.itemGap}>
        {validProjects.map((proj, index) => {
          const safeUrl = sanitizeUrl(proj.url);
          const bullets = proj.bullets || [];

          return (
            <article key={proj.id || `proj-${index}`} className="break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div className="min-w-0 flex-1">
                  <span className={`${typography.itemTitleSize} ${colors.textPrimary} break-words`}>
                    {proj.name}
                  </span>
                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      [Link]
                    </a>
                  )}
                </div>

                {proj.technologies && (
                  <span className={`${typography.metaSize} ${colors.textMuted} whitespace-normal text-right`}>
                    {proj.technologies}
                  </span>
                )}
              </div>

              {proj.description && (
                <p className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} mt-1 break-words`}>
                  {proj.description}
                </p>
              )}

              {bullets.length > 0 && (
                <ul className={`list-disc list-outside ml-4 mt-1.5 ${spacing.bulletGap}`}>
                  {bullets.map((bullet, bIndex) => {
                    const bulletText = typeof bullet === 'string' ? bullet : bullet.content;
                    if (!bulletText?.trim()) return null;
                    return (
                      <li
                        key={bullet.id || `pb-${bIndex}`}
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
