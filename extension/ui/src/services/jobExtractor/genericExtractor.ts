/**
 * TailorResume — Generic Semantic Job Content Extractor
 * Identifies and scores candidate DOM containers when no specialized adapter or JSON-LD is available.
 * Detects role headings, lists, and content density while filtering navigation and noise.
 */

import { cleanJobText, domNodeToStructuredText, removeNoiseElements } from './cleaner';

export interface GenericExtractedJob {
  title: string;
  company_name: string | null;
  location: string | null;
  description: string;
}

const JOB_HEADING_KEYWORDS = [
  'about the role',
  'about the job',
  'responsibilities',
  "what you'll do",
  'what you will do',
  'requirements',
  'qualifications',
  "what you'll need",
  'what you will need',
  'who you are',
  'skills & experience',
  'role overview',
  'job summary',
  'key responsibilities',
  'minimum qualifications',
  'preferred qualifications',
];

/**
 * Extracts job content from generic HTML pages using semantic scoring.
 */
export function extractGenericJob(doc: Document): GenericExtractedJob | null {
  // 1. Identify Candidate Title
  const title = extractGenericTitle(doc);

  // 2. Locate Best Candidate Description Container
  const bestContainer = findBestJobContainer(doc);
  if (!bestContainer) {
    return null;
  }

  // Clone container and strip noise
  const clone = bestContainer.cloneNode(true) as Element;
  removeNoiseElements(clone);
  const rawText = domNodeToStructuredText(clone);
  const description = cleanJobText(rawText);

  // Must have minimum substance
  if (!description || description.length < 50) {
    return null;
  }

  // Extract Company & Location heuristics
  const company = extractGenericCompany(doc, title);
  const location = extractGenericLocation(doc);

  return {
    title: cleanJobText(title || 'Job Opportunity'),
    company_name: company ? cleanJobText(company) : null,
    location: location ? cleanJobText(location) : null,
    description,
  };
}

/**
 * Detects the job title from semantic h1 or metadata.
 */
function extractGenericTitle(doc: Document): string {
  // Check main h1 first
  const h1Elements = Array.from(doc.querySelectorAll('h1'));
  for (const h1 of h1Elements) {
    const text = h1.textContent?.trim() || '';
    if (text.length >= 3 && text.length <= 120 && !isGenericHeader(text)) {
      return text;
    }
  }

  // Check Open Graph Title
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle && ogTitle.trim()) {
    return cleanPageTitle(ogTitle.trim());
  }

  // Fallback to document title
  if (doc.title && doc.title.trim()) {
    return cleanPageTitle(doc.title.trim());
  }

  return '';
}

function isGenericHeader(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower === 'careers' ||
    lower === 'jobs' ||
    lower === 'open positions' ||
    lower === 'work with us' ||
    lower === 'join our team' ||
    lower === 'welcome' ||
    lower === 'home'
  );
}

function cleanPageTitle(title: string): string {
  // Strip trailing " | Company" or " - Careers"
  return title
    .replace(/\s*[|\-–—]\s*(careers|jobs|lever|greenhouse|workday).*$/i, '')
    .replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '') // Strip trailing site brand after delimiter
    .trim();
}

/**
 * Extracts company name from Open Graph or title delimiters.
 */
function extractGenericCompany(doc: Document, title: string): string | null {
  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  if (ogSiteName && ogSiteName.trim()) {
    return ogSiteName.trim();
  }

  // Check title pattern e.g. "Software Engineer at Acme Corp"
  const atMatch = title.match(/\s+at\s+([A-Za-z0-9\s&.,\-]+)$/i);
  if (atMatch && atMatch[1]) {
    return atMatch[1].trim();
  }

  return null;
}

/**
 * Extracts location signals from meta tags or common location badges.
 */
function extractGenericLocation(doc: Document): string | null {
  const locSelectors = [
    '[class*="location"]',
    '[data-testid*="location"]',
    '.job-location',
    '.workplace-type',
  ];

  for (const sel of locSelectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length >= 2 && text.length <= 80 && !text.includes('\n')) {
          return text;
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Evaluates candidate containers on the page and returns the one with highest job score.
 */
function findBestJobContainer(doc: Document): Element | null {
  // Candidate root containers
  const candidates: Element[] = [];

  const mainTags = doc.querySelectorAll('main, article, [role="main"], .job-description, .job-details, #content');
  mainTags.forEach((el) => candidates.push(el));

  // If no semantic container tags, collect section and div elements containing headings
  if (candidates.length === 0) {
    const sections = doc.querySelectorAll('section, div[id*="job"], div[class*="job"], div[class*="posting"]');
    sections.forEach((el) => candidates.push(el));
  }

  // Fallback to doc.body if nothing found
  if (candidates.length === 0 && doc.body) {
    candidates.push(doc.body);
  }

  let bestElement: Element | null = null;
  let bestScore = -1;

  for (const el of candidates) {
    const score = scoreElement(el);
    if (score > bestScore) {
      bestScore = score;
      bestElement = el;
    }
  }

  return bestScore >= 10 ? bestElement : null;
}

/**
 * Computes a heuristic score for whether an element contains a job description.
 */
function scoreElement(el: Element): number {
  let score = 0;
  const text = el.textContent || '';
  const textLen = text.trim().length;

  // Length scoring (sweet spot: 200 - 15000 chars)
  if (textLen >= 200 && textLen <= 15000) {
    score += 15;
  } else if (textLen > 15000) {
    score += 5; // Too huge might be entire website body
  } else {
    return 0; // Too short
  }

  const lowerText = text.toLowerCase();

  // Keyword presence
  for (const kw of JOB_HEADING_KEYWORDS) {
    if (lowerText.includes(kw)) {
      score += 8;
    }
  }

  // Headings bonus
  const headings = el.querySelectorAll('h1, h2, h3, h4');
  score += Math.min(headings.length * 2, 10);

  // Lists bonus (job requirements usually have bulleted lists)
  const listItems = el.querySelectorAll('li');
  score += Math.min(listItems.length * 2, 20);

  // Link density penalty (navbars/menus have high link-to-text ratio)
  const links = el.querySelectorAll('a');
  let linkTextLen = 0;
  links.forEach((a) => {
    linkTextLen += (a.textContent || '').length;
  });
  if (textLen > 0 && linkTextLen / textLen > 0.4) {
    score -= 30; // Heavy penalty for navigation hubs
  }

  return score;
}
