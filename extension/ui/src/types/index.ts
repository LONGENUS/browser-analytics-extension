/**
 * TailorResume — Core TypeScript Definitions
 * Central export for domain resume and job models and application interfaces.
 */

export * from './resume';
export * from './job';
export * from './match';
export * from './tailoring';
export * from './template';
export * from './dashboard';

export type AppTabKey = 'dashboard' | 'resumes' | 'tailored' | 'jobs' | 'tailor' | 'profile';
