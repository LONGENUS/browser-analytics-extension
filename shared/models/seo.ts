/**
 * WebIntel — SEO Intelligence TypeScript Interfaces (Module 3)
 */

export interface SeoMetadata {
  title: string;
  title_length: number;
  description: string;
  description_length: number;
  canonical: string;
  robots: string;
  charset: string;
  viewport: string;
}

export interface HeadingItem {
  tag: string;
  text: string;
  level: number;
}

export interface HeadingsAudit {
  h1_count: number;
  h2_count: number;
  h3_count: number;
  h1_tags: string[];
  hierarchy_issues: string[];
  all_headings: HeadingItem[];
}

export interface ImagesAudit {
  total_images: number;
  missing_alt_count: number;
  alt_coverage_percent: number;
  format_breakdown: Record<string, number>;
  sample_missing_alt: string[];
}

export interface LinksAudit {
  total_links: number;
  internal_links_count: number;
  external_links_count: number;
  nofollow_count: number;
  empty_anchor_count: number;
  internal_sample: string[];
  external_sample: string[];
}

export interface StructuredDataItem {
  schema_type: string;
  context: string;
  name?: string;
  raw_snippet?: Record<string, any>;
}

export interface StructuredDataAudit {
  has_json_ld: bool;
  detected_types: string[];
  has_product_schema: boolean;
  has_breadcrumb_schema: boolean;
  has_faq_schema: boolean;
  items: StructuredDataItem[];
}

export interface SeoScore {
  score: number;
  rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  breakdown: Record<string, number>;
  recommendations: string[];
}

export interface SeoIntelligenceResponse {
  url: string;
  domain: string;
  seo_score: SeoScore;
  metadata: SeoMetadata;
  headings: HeadingsAudit;
  images: ImagesAudit;
  links: LinksAudit;
  structured_data: StructuredDataAudit;
}

export interface SeoError {
  module: 'seo';
  status: 'failed';
  reason: string;
  details?: Record<string, any>;
}
