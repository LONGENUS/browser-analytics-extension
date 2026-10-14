/**
 * TailorResume — Resume Template & Presentation Types (Module 7)
 * Defines the contract for template metadata, configuration tokens,
 * typography, spacing, layouts, and ATS compliance.
 *
 * Core rule:
 * THE STRUCTURED RESUME DATA IS THE SOURCE OF TRUTH.
 * THE TEMPLATE IS STRICTLY A PRESENTATION LAYER.
 */

export type TemplateId = 'ats-classic' | 'professional' | 'compact';

export interface TemplateTypographyTokens {
  fontFamily: string;
  nameSize: string;
  headlineSize: string;
  sectionHeadingSize: string;
  itemTitleSize: string;
  itemSubtitleSize: string;
  bodySize: string;
  metaSize: string;
  lineHeight: string;
  letterSpacing?: string;
  headingTransform?: 'uppercase' | 'none' | 'capitalize';
  headingWeight?: string;
}

export interface TemplateSpacingTokens {
  pagePadding: string;
  sectionGap: string;
  headingMarginBottom: string;
  itemGap: string;
  bulletGap: string;
  metaGap: string;
}

export interface TemplateColorTokens {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentBackground?: string;
  border: string;
  headerBorder?: string;
  sectionBorder?: string;
}

export interface TemplateLayoutConfig {
  layoutType: 'single-column' | 'accent-header' | 'compact-grid';
  headerAlignment: 'left' | 'center';
  skillsDisplay: 'inline-categories' | 'badges' | 'compact-tags';
  experienceHeaderLayout: 'split' | 'stacked';
  datesAlignment: 'right' | 'inline';
  showSectionDividers: boolean;
  dividerStyle?: 'solid' | 'subtle' | 'none';
}

export interface ResumeTemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  version: string;
  atsSafe: boolean;
  recommendedFor: string;
  typography: TemplateTypographyTokens;
  spacing: TemplateSpacingTokens;
  colors: TemplateColorTokens;
  layout: TemplateLayoutConfig;
}

export interface ResumeTemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
  version: string;
  atsSafe: boolean;
  recommendedFor: string;
  tagline: string;
}

export type ZoomLevel = 75 | 100 | 125 | 'fit';
