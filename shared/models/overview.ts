/**
 * WebIntel — Shared TypeScript Definitions
 * Module 1: Website Overview Engine
 */

export type PageType =
  | 'Marketplace'
  | 'Ecommerce'
  | 'SaaS'
  | 'Blog'
  | 'Company'
  | 'News'
  | 'Documentation'
  | 'Portfolio'
  | 'Generic';

export interface PageTypeClassification {
  pageType: PageType;
  confidence: number; // 0.0 to 1.0
}

export interface OverviewData {
  url: string;
  domain: string;
  title: string;
  favicon?: string | null;
  industry: string;
  pageType: PageType;
  confidence: number;
  language: string;
  currency?: string | null;
  scrapedAt: string;
  statusCode: number;
  canonicalUrl?: string | null;
}

export interface OverviewModuleError {
  module: 'overview';
  status: 'failed';
  reason: string;
  details?: Record<string, any>;
}

export type OverviewResult = OverviewData | OverviewModuleError;

/**
 * Type guard for checking if the overview result succeeded.
 */
export function isOverviewSuccess(result: OverviewResult): result is OverviewData {
  return (result as OverviewModuleError).status !== 'failed';
}
