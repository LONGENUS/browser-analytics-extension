import React from 'react';
import { PersonalInfo } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { sanitizeUrl } from '../templates/templateRegistry';

interface ResumeHeaderProps {
  personalInfo?: PersonalInfo | null;
  config: ResumeTemplateConfig;
}

export const ResumeHeader: React.FC<ResumeHeaderProps> = ({ personalInfo, config }) => {
  if (!personalInfo) return null;

  const { full_name, headline, email, phone, location, website, linkedin_url, github_url, portfolio_url } = personalInfo;

  // If no personal info at all, omit header
  const hasContactInfo = email || phone || location || website || linkedin_url || github_url || portfolio_url;
  if (!full_name && !headline && !hasContactInfo) return null;

  const { typography, colors, spacing, layout } = config;
  const isCentered = layout.headerAlignment === 'center';

  return (
    <header className={`${colors.headerBorder} ${spacing.headingMarginBottom} ${isCentered ? 'text-center' : 'text-left'}`}>
      {full_name && (
        <h1 className={`${typography.nameSize} ${colors.textPrimary} break-words`}>
          {full_name}
        </h1>
      )}

      {headline && (
        <p className={`${typography.headlineSize} ${colors.accent} mt-0.5 break-words font-medium`}>
          {headline}
        </p>
      )}

      {hasContactInfo && (
        <div
          className={`flex flex-wrap items-center ${isCentered ? 'justify-center' : 'justify-start'} ${spacing.metaGap} mt-2 ${typography.metaSize} ${colors.textMuted}`}
        >
          {email && (
            <a
              href={`mailto:${email}`}
              className="hover:underline text-inherit break-all"
              aria-label={`Email: ${email}`}
            >
              {email}
            </a>
          )}

          {phone && (
            <span className="break-normal">
              {phone}
            </span>
          )}

          {location && (
            <span className="break-words">
              {location}
            </span>
          )}

          {website && sanitizeUrl(website) && (
            <a
              href={sanitizeUrl(website)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              Website
            </a>
          )}

          {linkedin_url && sanitizeUrl(linkedin_url) && (
            <a
              href={sanitizeUrl(linkedin_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              LinkedIn
            </a>
          )}

          {github_url && sanitizeUrl(github_url) && (
            <a
              href={sanitizeUrl(github_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              GitHub
            </a>
          )}

          {portfolio_url && sanitizeUrl(portfolio_url) && (
            <a
              href={sanitizeUrl(portfolio_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              Portfolio
            </a>
          )}
        </div>
      )}
    </header>
  );
};
