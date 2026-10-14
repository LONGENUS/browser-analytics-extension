/**
 * TailorResume — Site-Specific Job Extraction Adapters
 * Provides deterministic extraction adapters for LinkedIn, Naukri, Indeed,
 * and company career platforms (Greenhouse, Lever, Ashby, Workday).
 */

import { JobSource } from '../../types/job';
import { cleanJobText, domNodeToStructuredText, removeNoiseElements } from './cleaner';

export interface SiteExtractedJob {
  title: string;
  company_name: string | null;
  company_url: string | null;
  location: string | null;
  employment_type: string | null;
  description: string;
  salary_text: string | null;
  job_posted_at: string | null;
}

/**
 * Detects the job source platform from URL and document metadata.
 */
export function detectJobSource(rawUrl: string, doc?: Document): JobSource {
  const url = (rawUrl || '').toLowerCase();

  if (url.includes('linkedin.com')) {
    return 'linkedin';
  }
  if (url.includes('naukri.com')) {
    return 'naukri';
  }
  if (url.includes('indeed.com')) {
    return 'indeed';
  }
  if (
    url.includes('greenhouse.io') ||
    url.includes('lever.co') ||
    url.includes('ashbyhq.com') ||
    url.includes('myworkdayjobs.com') ||
    url.includes('smartrecruiters.com') ||
    url.includes('workable.com') ||
    url.includes('/careers') ||
    url.includes('/career') ||
    url.includes('/jobs')
  ) {
    return 'company_site';
  }
  if (
    url.includes('monster.com') ||
    url.includes('dice.com') ||
    url.includes('ziprecruiter.com') ||
    url.includes('glassdoor.com') ||
    url.includes('wellfound.com')
  ) {
    return 'job_board';
  }

  // Check document domain or canonical tag if provided
  if (doc) {
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.toLowerCase() || '';
    if (canonical.includes('linkedin.com')) return 'linkedin';
    if (canonical.includes('naukri.com')) return 'naukri';
    if (canonical.includes('indeed.com')) return 'indeed';
  }

  return 'other';
}

/**
 * Executes the appropriate site adapter based on detected source.
 */
export function extractSiteSpecificJob(source: JobSource, doc: Document): SiteExtractedJob | null {
  switch (source) {
    case 'linkedin':
      return extractLinkedIn(doc);
    case 'naukri':
      return extractNaukri(doc);
    case 'indeed':
      return extractIndeed(doc);
    case 'company_site':
      return extractCompanyPlatform(doc);
    default:
      return null;
  }
}

/**
 * LinkedIn Job Page Adapter.
 */
function extractLinkedIn(doc: Document): SiteExtractedJob | null {
  // Prioritize job details container on split-pane search view or full job page
  const detailsContainer = (doc.querySelector(
    '.jobs-search__job-details--container, .jobs-search__job-details, .jobs-details__main-content, .job-view-layout, .jobs-details, main.jobs-search__job-details, div[class*="job-details"]'
  ) || doc) as Document | HTMLElement;

  const titleSelectors = [
    'h1.job-details-jobs-unified-top-card__job-title',
    'h2.job-details-jobs-unified-top-card__job-title',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    '.jobs-details__main-content h1',
    '.jobs-search__job-details--container h1',
    '.jobs-search__job-details--container h2',
    'h1.t-24',
    'h2.t-24',
    'h1.top-card-layout__title',
    'h1.topcard__title',
    'a[href*="/jobs/view/"]',
  ];

  const companySelectors = [
    'div.job-details-jobs-unified-top-card__company-name a',
    'div.job-details-jobs-unified-top-card__company-name',
    '.job-details-jobs-unified-top-card__company-name',
    '.job-details-jobs-unified-top-card__primary-description a[href*="/company/"]',
    '.job-details-jobs-unified-top-card__primary-description a',
    '.job-details-jobs-unified-top-card__primary-description',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    'a.topcard__org-name-link',
    '.topcard__flavor--black-link',
    'a[href*="/company/"]',
  ];

  const locationSelectors = [
    '.job-details-jobs-unified-top-card__bullet',
    '.job-details-jobs-unified-top-card__primary-description-container span',
    '.jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet',
    '.job-details-jobs-unified-top-card__primary-description-container',
  ];

  const descSelectors = [
    '#job-details',
    '.jobs-description__content',
    '.jobs-box__html-content',
    'article.jobs-description__container',
    '.jobs-description-content__text',
    'div[class*="jobs-description"]',
    '.jobs-description',
    '.show-more-less-html__markup',
    '.description__text',
    'article',
  ];

  let title = getFirstText(detailsContainer as Document, titleSelectors);
  if (!title && detailsContainer !== doc) {
    title = getFirstText(detailsContainer as Document, ['h1', 'h2']);
  }
  if (!title) {
    title = getFirstText(doc, [
      'h1.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.top-card-layout__title',
      'h1.topcard__title',
    ]);
  }

  const company = getFirstText(detailsContainer as Document, companySelectors) || getFirstText(doc, companySelectors);
  const location = getFirstText(detailsContainer as Document, locationSelectors) || getFirstText(doc, locationSelectors);
  const description = extractElementText(detailsContainer as Document, descSelectors) || extractElementText(doc, descSelectors);

  if (!title && !description) {
    return null;
  }

  return {
    title: cleanJobText(title || (doc.title ? doc.title.replace(/\s*[|\-–—].*$/, '') : 'Job Opportunity')),
    company_name: company ? cleanJobText(company) : null,
    company_url: null,
    location: location ? cleanJobText(location) : null,
    employment_type: null,
    description: cleanJobText(description),
    salary_text: null,
    job_posted_at: null,
  };
}

/**
 * Naukri Job Page Adapter.
 */
function extractNaukri(doc: Document): SiteExtractedJob | null {
  const titleSelectors = [
    'h1[class*="jd-header-title"]',
    'h1.styles_jd-header-title__',
    'h1.jd-header-title',
    'h1.job-title',
    'h1',
  ];

  const companySelectors = [
    'a[class*="jd-header-comp-name"]',
    '.styles_jd-header-comp-name__',
    '.jd-header-comp-name',
    '.company-name',
  ];

  const locationSelectors = [
    'span[class*="jdn-header-loc"]',
    '.styles_jdn-header-loc__',
    '.location',
    '.loc',
  ];

  const descSelectors = [
    'section[class*="job-desc-container"]',
    '.styles_job-desc-container__',
    '.job-desc-section',
    '.dang-inner-html',
    '.job-description',
  ];

  const salarySelectors = [
    'span[class*="jdn-header-sal"]',
    '.salary',
  ];

  const title = getFirstText(doc, titleSelectors);
  const company = getFirstText(doc, companySelectors);
  const location = getFirstText(doc, locationSelectors);
  const description = extractElementText(doc, descSelectors);
  const salary = getFirstText(doc, salarySelectors);

  if (!title && !description) {
    return null;
  }

  return {
    title: cleanJobText(title),
    company_name: company ? cleanJobText(company) : null,
    company_url: null,
    location: location ? cleanJobText(location) : null,
    employment_type: null,
    description: cleanJobText(description),
    salary_text: salary ? cleanJobText(salary) : null,
    job_posted_at: null,
  };
}

/**
 * Indeed Job Page Adapter.
 */
function extractIndeed(doc: Document): SiteExtractedJob | null {
  const titleSelectors = [
    'h1.jobsearch-JobInfoHeader-title',
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    'h1',
  ];

  const companySelectors = [
    'div[data-company-name="true"]',
    'div.jobsearch-CompanyInfoContainer a',
    'div[data-testid="inlineHeader-companyName"]',
  ];

  const locationSelectors = [
    'div[data-testid="inlineHeader-companyLocation"]',
    'div[data-testid="job-location"]',
    '.jobsearch-JobInfoHeader-companyLocation',
  ];

  const descSelectors = [
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    'div[data-testid="jobDescriptionText"]',
  ];

  const title = getFirstText(doc, titleSelectors);
  const company = getFirstText(doc, companySelectors);
  const location = getFirstText(doc, locationSelectors);
  const description = extractElementText(doc, descSelectors);

  if (!title && !description) {
    return null;
  }

  return {
    title: cleanJobText(title),
    company_name: company ? cleanJobText(company) : null,
    company_url: null,
    location: location ? cleanJobText(location) : null,
    employment_type: null,
    description: cleanJobText(description),
    salary_text: null,
    job_posted_at: null,
  };
}

/**
 * Company Platforms (Greenhouse, Lever, Ashby, Workday).
 */
function extractCompanyPlatform(doc: Document): SiteExtractedJob | null {
  // 1. Greenhouse
  const ghTitle = getFirstText(doc, ['.app-title', '#header h1', 'h1.app-title']);
  const ghDesc = extractElementText(doc, ['#content', '#main', '.content']);
  if (ghTitle && ghDesc) {
    const ghCompany = getFirstText(doc, ['.company-name', '#header .company-name']);
    const ghLoc = getFirstText(doc, ['.location', '.app-location']);
    return {
      title: cleanJobText(ghTitle),
      company_name: ghCompany ? cleanJobText(ghCompany) : null,
      company_url: null,
      location: ghLoc ? cleanJobText(ghLoc) : null,
      employment_type: null,
      description: cleanJobText(ghDesc),
      salary_text: null,
      job_posted_at: null,
    };
  }

  // 2. Lever
  const leverTitle = getFirstText(doc, ['.posting-headline h2', '.posting-headline h1']);
  const leverDesc = extractElementText(doc, ['.content-wrapper .section-wrapper', '.section.page-centered']);
  if (leverTitle && leverDesc) {
    const leverLoc = getFirstText(doc, ['.posting-categories .location', '.sort-by-time.posting-category']);
    return {
      title: cleanJobText(leverTitle),
      company_name: null,
      company_url: null,
      location: leverLoc ? cleanJobText(leverLoc) : null,
      employment_type: null,
      description: cleanJobText(leverDesc),
      salary_text: null,
      job_posted_at: null,
    };
  }

  // 3. Workday
  const wdTitle = getFirstText(doc, ['h2[data-automation-id="jobPostingHeader"]', 'h1']);
  const wdDesc = extractElementText(doc, ['[data-automation-id="jobPostingDescription"]']);
  if (wdTitle && wdDesc) {
    const wdLoc = getFirstText(doc, ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]']);
    return {
      title: cleanJobText(wdTitle),
      company_name: null,
      company_url: null,
      location: wdLoc ? cleanJobText(wdLoc) : null,
      employment_type: null,
      description: cleanJobText(wdDesc),
      salary_text: null,
      job_posted_at: null,
    };
  }

  return null;
}

// --- Helper Functions ---

function getFirstText(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    try {
      const el = doc.querySelector(selector);
      if (el && el.textContent?.trim()) {
        return el.textContent.trim();
      }
    } catch (_) {}
  }
  return '';
}

function extractElementText(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    try {
      const el = doc.querySelector(selector);
      if (el) {
        const clone = el.cloneNode(true) as Element;
        removeNoiseElements(clone);
        const text = domNodeToStructuredText(clone);
        if (text && text.trim().length > 30) {
          return text;
        }
      }
    } catch (_) {}
  }
  return '';
}
