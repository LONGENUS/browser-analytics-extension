/**
 * TailorResume — Job Content Cleaner & HTML to Plain Text Converter
 * Converts DOM elements and raw HTML into cleanly structured plain text
 * while preserving headings, paragraphs, and list bullet points.
 * Enforces XSS protection and strips noisy layout elements.
 */

const NOISE_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header',
  'svg',
  'iframe',
  'button',
  'form',
  'select',
  'input',
  'textarea',
  'canvas',
  'video',
  'audio',
]);

const NOISE_SELECTORS = [
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.cookie-banner',
  '.cookie-notice',
  '#cookie-banner',
  '.advertisement',
  '.ad-container',
  '.ads',
  '.social-share',
  '.share-buttons',
  '.apply-button-container',
  '.sign-in-modal',
  '.login-modal',
];

/**
 * Strips noisy tags, cookie banners, navigation, and script/style elements from a cloned DOM element.
 */
export function removeNoiseElements(container: Element): void {
  for (const selector of NOISE_SELECTORS) {
    try {
      const elements = container.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    } catch (_) {}
  }

  const allElements = container.querySelectorAll('*');
  allElements.forEach((el) => {
    if (NOISE_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
    }
  });
}

/**
 * Converts a DOM node into structured plain text.
 */
export function domNodeToStructuredText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (NOISE_TAGS.has(tag)) {
    return '';
  }

  let text = '';
  for (const child of Array.from(el.childNodes)) {
    text += domNodeToStructuredText(child);
  }

  if (tag === 'br') {
    return '\n';
  }
  if (tag === 'li') {
    return `\n• ${text.trim()}\n`;
  }
  if (/^h[1-6]$/.test(tag)) {
    return `\n\n${text.trim()}\n`;
  }
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
    const trimmed = text.trim();
    return trimmed ? `\n\n${trimmed}\n` : '';
  }

  return text;
}

/**
 * Converts raw HTML string into clean structured plain text using DOMParser if in browser context.
 */
export function htmlToStructuredText(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // Quick fallback if DOMParser is unavailable (e.g., node test without DOM)
  if (typeof DOMParser === 'undefined') {
    return cleanJobText(
      rawHtml
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<[^>]+>/g, ' ')
    );
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    removeNoiseElements(doc.body);
    const structured = domNodeToStructuredText(doc.body);
    return cleanJobText(structured);
  } catch (_) {
    return cleanJobText(rawHtml.replace(/<[^>]+>/g, ' '));
  }
}

/**
 * Cleans extracted plain text:
 * - Normalizes unicode hyphens, quotes, and non-breaking spaces.
 * - Collapses excessive whitespace and blank lines.
 * - Truncates extreme length safely (max 50,000 chars).
 */
export function cleanJobText(text: string, maxLength: number = 50000): string {
  if (!text) return '';

  let cleaned = text
    .replace(/\u00a0/g, ' ') // Non-breaking space
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201c\u201d]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // En-dash & em-dash
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Collapse multiple spaces within lines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');

  // Collapse 3 or more consecutive newlines into 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Safety cap
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + '\n\n... [Content truncated at character limit]';
  }

  return cleaned;
}
