/**
 * TailorResume — Module 7: Resume Templates Registry
 * Central registry of declarative template configurations.
 * Guarantees:
 * - Deterministic styling and layout tokens.
 * - Source resume data is never altered by template selection.
 * - Safe URL sanitization to prevent XSS / malicious schemes.
 * - Graceful fallback to ATS Classic if unknown template ID is requested.
 */

import { ResumeTemplateConfig, TemplateId } from '../../../types/template';

export const ATS_CLASSIC_CONFIG: ResumeTemplateConfig = {
  id: 'ats-classic',
  name: 'ATS Classic',
  description: 'Single-column traditional layout engineered for maximum ATS parser compatibility and readability.',
  version: 'v1.0.0',
  atsSafe: true,
  recommendedFor: 'Traditional corporate roles, government, defense, banking, and standard online job portals.',
  typography: {
    fontFamily: 'font-sans',
    nameSize: 'text-2xl sm:text-3xl font-bold tracking-tight',
    headlineSize: 'text-base font-medium',
    sectionHeadingSize: 'text-xs font-bold uppercase tracking-wider',
    itemTitleSize: 'text-sm font-semibold',
    itemSubtitleSize: 'text-sm font-medium',
    bodySize: 'text-xs sm:text-sm',
    metaSize: 'text-xs',
    lineHeight: 'leading-relaxed',
    headingTransform: 'uppercase',
    headingWeight: 'font-bold',
  },
  spacing: {
    pagePadding: 'p-8 sm:p-10',
    sectionGap: 'space-y-5',
    headingMarginBottom: 'mb-2 pb-1',
    itemGap: 'space-y-3',
    bulletGap: 'space-y-1',
    metaGap: 'gap-x-4 gap-y-1',
  },
  colors: {
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    accent: 'text-slate-800',
    border: 'border-slate-300',
    headerBorder: 'border-b border-slate-300',
    sectionBorder: 'border-b border-slate-300',
  },
  layout: {
    layoutType: 'single-column',
    headerAlignment: 'left',
    skillsDisplay: 'inline-categories',
    experienceHeaderLayout: 'split',
    datesAlignment: 'right',
    showSectionDividers: true,
    dividerStyle: 'solid',
  },
};

export const PROFESSIONAL_CONFIG: ResumeTemplateConfig = {
  id: 'professional',
  name: 'Professional',
  description: 'Modern executive presentation with refined typography hierarchy, subtle visual accents, and elegant badges.',
  version: 'v1.0.0',
  atsSafe: true,
  recommendedFor: 'Tech, engineering, product management, design, and forward-looking startup environments.',
  typography: {
    fontFamily: 'font-sans',
    nameSize: 'text-2xl sm:text-3xl font-extrabold tracking-tight',
    headlineSize: 'text-base font-semibold',
    sectionHeadingSize: 'text-xs font-bold uppercase tracking-widest',
    itemTitleSize: 'text-sm font-bold',
    itemSubtitleSize: 'text-sm font-semibold',
    bodySize: 'text-xs sm:text-sm',
    metaSize: 'text-xs',
    lineHeight: 'leading-relaxed',
    headingTransform: 'uppercase',
    headingWeight: 'font-bold',
  },
  spacing: {
    pagePadding: 'p-8 sm:p-10',
    sectionGap: 'space-y-6',
    headingMarginBottom: 'mb-2.5 pb-1.5',
    itemGap: 'space-y-3.5',
    bulletGap: 'space-y-1.5',
    metaGap: 'gap-x-4 gap-y-1.5',
  },
  colors: {
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    accent: 'text-blue-600',
    accentBackground: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-slate-200',
    headerBorder: 'border-b-2 border-blue-600',
    sectionBorder: 'border-b border-slate-200',
  },
  layout: {
    layoutType: 'accent-header',
    headerAlignment: 'left',
    skillsDisplay: 'badges',
    experienceHeaderLayout: 'split',
    datesAlignment: 'right',
    showSectionDividers: true,
    dividerStyle: 'subtle',
  },
};

export const COMPACT_CONFIG: ResumeTemplateConfig = {
  id: 'compact',
  name: 'Compact',
  description: 'Space-efficient layout with tighter margins, condensed line heights, and compact skill tags to fit more experience naturally.',
  version: 'v1.0.0',
  atsSafe: true,
  recommendedFor: 'Experienced candidates with extensive history, multi-role careers, or dense technical portfolios.',
  typography: {
    fontFamily: 'font-sans',
    nameSize: 'text-xl sm:text-2xl font-bold tracking-tight',
    headlineSize: 'text-xs sm:text-sm font-medium',
    sectionHeadingSize: 'text-[11px] font-bold uppercase tracking-wider',
    itemTitleSize: 'text-xs font-bold',
    itemSubtitleSize: 'text-xs font-semibold',
    bodySize: 'text-xs',
    metaSize: 'text-[11px]',
    lineHeight: 'leading-snug',
    headingTransform: 'uppercase',
    headingWeight: 'font-bold',
  },
  spacing: {
    pagePadding: 'p-6 sm:p-7',
    sectionGap: 'space-y-3.5',
    headingMarginBottom: 'mb-1.5 pb-0.5',
    itemGap: 'space-y-2',
    bulletGap: 'space-y-0.5',
    metaGap: 'gap-x-3 gap-y-0.5',
  },
  colors: {
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    accent: 'text-slate-900',
    accentBackground: 'bg-slate-100 text-slate-800 border-slate-200',
    border: 'border-slate-200',
    headerBorder: 'border-b border-slate-300',
    sectionBorder: 'border-b border-slate-200',
  },
  layout: {
    layoutType: 'compact-grid',
    headerAlignment: 'left',
    skillsDisplay: 'compact-tags',
    experienceHeaderLayout: 'split',
    datesAlignment: 'right',
    showSectionDividers: true,
    dividerStyle: 'subtle',
  },
};

export const TEMPLATE_REGISTRY: Record<TemplateId, ResumeTemplateConfig> = {
  'ats-classic': ATS_CLASSIC_CONFIG,
  'professional': PROFESSIONAL_CONFIG,
  'compact': COMPACT_CONFIG,
};

export const AVAILABLE_TEMPLATES: ResumeTemplateConfig[] = [
  ATS_CLASSIC_CONFIG,
  PROFESSIONAL_CONFIG,
  COMPACT_CONFIG,
];

/**
 * Returns configuration for a given template ID.
 * Gracefully falls back to ATS Classic if template ID is null, undefined, or unrecognized.
 */
export function getTemplateConfig(templateId?: string | null): ResumeTemplateConfig {
  if (!templateId) return ATS_CLASSIC_CONFIG;
  const normalized = templateId.toLowerCase().trim() as TemplateId;
  return TEMPLATE_REGISTRY[normalized] || ATS_CLASSIC_CONFIG;
}

/**
 * Validates and sanitizes URLs to prevent malicious scripts, data URIs, or vbscripts.
 * Permits strictly http, https, mailto, and tel.
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Block dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  // Ensure safe protocol or auto-prefix standard web url
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return trimmed;
  }

  // Default to https:// for bare domains (e.g. 'linkedin.com/in/...')
  return `https://${trimmed}`;
}

/**
 * Formats date range consistently: "Jan 2022 – Present" or "2020 – 2024".
 */
export function formatDateRange(
  startDate?: string | null,
  endDate?: string | null,
  isCurrent?: boolean
): string | null {
  if (!startDate && !endDate && !isCurrent) return null;
  const start = startDate?.trim() || '';
  let end = '';
  if (isCurrent) {
    end = 'Present';
  } else if (endDate?.trim()) {
    end = endDate.trim();
  }

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return null;
}
