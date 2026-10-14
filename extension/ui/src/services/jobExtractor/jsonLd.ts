/**
 * TailorResume — JSON-LD JobPosting Parser
 * Deterministically extracts structured job postings from schema.org JSON-LD scripts.
 * Handles @graph arrays, top-level arrays, and nested structures with full error resilience.
 */

import { htmlToStructuredText, cleanJobText } from './cleaner';

export interface ExtractedJsonLdJob {
  title: string;
  company_name: string | null;
  company_url: string | null;
  location: string | null;
  employment_type: string | null;
  description: string;
  salary_text: string | null;
  date_posted: string | null;
  responsibilities: string | null;
  qualifications: string | null;
}

/**
 * Searches and parses all JSON-LD blocks in the document for JobPosting schema.
 */
export function extractJsonLdJobPosting(doc: Document): ExtractedJsonLdJob | null {
  const scriptTags = doc.querySelectorAll('script[type="application/ld+json"]');
  if (!scriptTags || scriptTags.length === 0) {
    return null;
  }

  for (const script of Array.from(scriptTags)) {
    const rawContent = script.textContent?.trim();
    if (!rawContent) continue;

    try {
      const parsed = JSON.parse(rawContent);
      const jobObject = findJobPostingObject(parsed);
      if (jobObject) {
        return normalizeJobPostingSchema(jobObject);
      }
    } catch (_) {
      // Ignore invalid JSON-LD blocks and continue searching
    }
  }

  return null;
}

/**
 * Recursively locates an object with @type === 'JobPosting' in single object, array, or @graph.
 */
function findJobPostingObject(data: any): any | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Check current object
  const type = data['@type'];
  if (
    type === 'JobPosting' ||
    (Array.isArray(type) && type.includes('JobPosting'))
  ) {
    return data;
  }

  // Check @graph array
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      const found = findJobPostingObject(item);
      if (found) return found;
    }
  }

  // Check top-level array
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPostingObject(item);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Normalizes a raw schema.org JobPosting object into structured fields.
 */
function normalizeJobPostingSchema(raw: any): ExtractedJsonLdJob | null {
  const title = (raw.title || raw.name || '').trim();
  const rawDescription = raw.description || '';

  // Clean description HTML
  const description = htmlToStructuredText(rawDescription);

  if (!title && !description) {
    return null;
  }

  // Company Name & URL
  let companyName: string | null = null;
  let companyUrl: string | null = null;
  const hiringOrg = raw.hiringOrganization;
  if (hiringOrg && typeof hiringOrg === 'object') {
    companyName = (hiringOrg.name || hiringOrg.legalName || '').trim() || null;
    companyUrl = (hiringOrg.url || hiringOrg.sameAs || '').trim() || null;
  } else if (typeof hiringOrg === 'string') {
    companyName = hiringOrg.trim();
  }

  // Location
  let location: string | null = null;
  const jobLoc = raw.jobLocation;
  if (jobLoc) {
    if (Array.isArray(jobLoc)) {
      location = jobLoc.map(formatLocationItem).filter(Boolean).join('; ') || null;
    } else {
      location = formatLocationItem(jobLoc);
    }
  } else if (raw.applicantLocationRequirements) {
    location = 'Remote (' + (raw.applicantLocationRequirements.name || 'Worldwide') + ')';
  }

  // Employment Type
  let employmentType: string | null = null;
  if (raw.employmentType) {
    const rawType = Array.isArray(raw.employmentType)
      ? raw.employmentType.join(', ')
      : String(raw.employmentType);
    employmentType = cleanJobText(rawType.replace(/_/g, ' '));
  }

  // Salary
  let salaryText: string | null = null;
  if (raw.baseSalary) {
    const sal = raw.baseSalary;
    const value = sal.value?.value || sal.value?.minValue || sal.value || '';
    const currency = sal.currency || '';
    const unit = sal.value?.unitText || sal.unitText || '';
    if (value) {
      salaryText = `${currency} ${value} ${unit ? '/' + unit : ''}`.trim();
    }
  }

  // Responsibilities / Qualifications
  const responsibilities = Array.isArray(raw.responsibilities)
    ? raw.responsibilities.map((r: string) => `• ${r}`).join('\n')
    : typeof raw.responsibilities === 'string'
    ? raw.responsibilities.trim()
    : null;

  const qualifications = Array.isArray(raw.qualifications)
    ? raw.qualifications.map((q: string) => `• ${q}`).join('\n')
    : typeof raw.qualifications === 'string'
    ? raw.qualifications.trim()
    : null;

  return {
    title: cleanJobText(title),
    company_name: companyName ? cleanJobText(companyName) : null,
    company_url: companyUrl,
    location: location ? cleanJobText(location) : null,
    employment_type: employmentType,
    description,
    salary_text: salaryText,
    date_posted: raw.datePosted ? String(raw.datePosted).trim() : null,
    responsibilities,
    qualifications,
  };
}

function formatLocationItem(locItem: any): string | null {
  if (typeof locItem === 'string') return locItem.trim();
  if (!locItem || typeof locItem !== 'object') return null;

  const addr = locItem.address;
  if (typeof addr === 'string') return addr.trim();
  if (addr && typeof addr === 'object') {
    const parts = [
      addr.streetAddress,
      addr.addressLocality,
      addr.addressRegion,
      addr.postalCode,
      addr.addressCountry,
    ].filter(Boolean);
    return parts.join(', ');
  }

  if (locItem.name) return String(locItem.name).trim();
  return null;
}
