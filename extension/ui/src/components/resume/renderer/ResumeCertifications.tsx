import React from 'react';
import { Certification } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';
import { sanitizeUrl, formatDateRange } from '../templates/templateRegistry';

interface ResumeCertificationsProps {
  certifications?: Certification[];
  config: ResumeTemplateConfig;
}

export const ResumeCertifications: React.FC<ResumeCertificationsProps> = ({ certifications, config }) => {
  if (!certifications || certifications.length === 0) return null;

  const validCerts = certifications.filter((c) => c.name?.trim());
  if (validCerts.length === 0) return null;

  const { typography, colors, spacing } = config;

  return (
    <section>
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Certifications
      </h2>

      <div className={spacing.itemGap}>
        {validCerts.map((cert, index) => {
          const safeUrl = sanitizeUrl(cert.credential_url);
          const dateStr = formatDateRange(cert.issue_date, cert.expiration_date, false);

          return (
            <article key={cert.id || `cert-${index}`} className="break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div className="min-w-0 flex-1">
                  <span className={`${typography.itemTitleSize} ${colors.textPrimary} break-words`}>
                    {cert.name}
                  </span>
                  {cert.issuer && (
                    <span className={`${typography.itemSubtitleSize} ${colors.textSecondary} break-words`}>
                      {' '}• {cert.issuer}
                    </span>
                  )}
                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      [Verify]
                    </a>
                  )}
                </div>

                {dateStr && (
                  <span className={`${typography.metaSize} ${colors.textMuted} whitespace-nowrap shrink-0`}>
                    {dateStr}
                  </span>
                )}
              </div>

              {cert.credential_id && (
                <div className={`${typography.metaSize} ${colors.textMuted} mt-0.5`}>
                  Credential ID: {cert.credential_id}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
