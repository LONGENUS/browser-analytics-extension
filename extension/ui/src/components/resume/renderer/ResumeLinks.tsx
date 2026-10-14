import React from 'react';
import { ResumeLink } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { sanitizeUrl } from '../templates/templateRegistry';

interface ResumeLinksProps {
  links?: ResumeLink[];
  config: ResumeTemplateConfig;
}

export const ResumeLinks: React.FC<ResumeLinksProps> = ({ links, config }) => {
  if (!links || links.length === 0) return null;

  // Filter links with valid sanitized URL and non-empty label
  const validLinks = links.filter((l) => l.label?.trim() && sanitizeUrl(l.url));
  if (validLinks.length === 0) return null;

  const { typography, colors, spacing } = config;

  return (
    <section className="break-inside-avoid">
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Links & Portfolios
      </h2>

      <div className={`flex flex-wrap items-center ${spacing.metaGap} ${typography.bodySize}`}>
        {validLinks.map((link, index) => {
          const safeUrl = sanitizeUrl(link.url)!;
          return (
            <a
              key={link.id || `link-${index}`}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {link.label}
            </a>
          );
        })}
      </div>
    </section>
  );
};
