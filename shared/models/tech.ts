/**
 * WebIntel — Technology Stack Detection TypeScript Interfaces (Module 4)
 */

export type TechCategory =
  | 'Frontend Framework'
  | 'Backend'
  | 'CMS'
  | 'Analytics'
  | 'CDN'
  | 'Hosting'
  | 'Payment'
  | 'Advertising'
  | 'Tag Manager'
  | 'Javascript Libraries'
  | 'UI Libraries';

export interface TechItem {
  name: string;
  category: string;
  confidence: number;
  version?: string;
  icon?: string;
}

export interface TechStackResponse {
  url: string;
  domain: string;
  total_detected: number;
  categories: Record<string, TechItem[]>;
  technologies: TechItem[];
}

export interface TechError {
  module: 'techstack';
  status: 'failed';
  reason: string;
  details?: Record<string, any>;
}
