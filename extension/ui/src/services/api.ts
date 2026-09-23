import { FullDossier } from '../types';

declare const chrome: any;

const DEFAULT_API_BASE_URL = 'https://browser-analytics-extension-longenus05-3620s-projects.vercel.app';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ActiveTabInfo {
  url: string;
  title: string;
  favIconUrl: string;
  domain: string;
  isValidHttp: boolean;
  tabId?: number;
}

/**
 * Resolves the backend API base URL using window.APP_CONFIG (if present)
 * or falls back to the production Vercel serverless deployment.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG) {
    try {
      const config = (window as any).APP_CONFIG;
      if (typeof config.getBaseUrl === 'function') {
        const url = await config.getBaseUrl();
        if (url) return url.replace(/\/$/, '');
      } else if (config.API_BASE_URL) {
        return config.API_BASE_URL.replace(/\/$/, '');
      }
    } catch (e) {
      console.warn('Error reading APP_CONFIG base URL:', e);
    }
  }
  return DEFAULT_API_BASE_URL;
}

/**
 * Extracts and normalizes hostname domain from a URL.
 */
export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'website';
  }
}

/**
 * Detects the currently active browser tab via Chrome Extension APIs.
 */
export async function getActiveTab(): Promise<ActiveTabInfo> {
  // Check URL query param for standalone testing/preview environments
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const testUrl = params.get('url');
      if (testUrl && (testUrl.startsWith('http://') || testUrl.startsWith('https://'))) {
        const domain = extractDomain(testUrl);
        return {
          url: testUrl,
          title: params.get('title') || domain,
          favIconUrl: `https://${domain}/favicon.ico`,
          domain,
          isValidHttp: true,
        };
      }
    } catch (_) {}
  }

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const isValid = tab.url.startsWith('http://') || tab.url.startsWith('https://');
        return {
          url: tab.url,
          title: tab.title || '',
          favIconUrl: tab.favIconUrl || '',
          domain: extractDomain(tab.url),
          isValidHttp: isValid,
          tabId: tab.id,
        };
      }
    } catch (e) {
      console.warn('Chrome tabs query failed:', e);
    }
  }

  // Fallback for standalone/sandbox environment
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isValid = currentUrl.startsWith('http://') || currentUrl.startsWith('https://');
  return {
    url: currentUrl,
    title: typeof document !== 'undefined' ? document.title : '',
    favIconUrl: '',
    domain: extractDomain(currentUrl),
    isValidHttp: isValid,
  };
}

/**
 * Executes a real-time website analysis by calling the backend API.
 * Never returns demo or mock data. Throws on network/server failures.
 */
export async function analyzeWebsite(
  url: string,
  title: string = '',
  forceRefresh: boolean = false,
  externalSignal?: AbortSignal
): Promise<FullDossier> {
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    throw new Error('Please navigate to an active website (HTTP/HTTPS) to analyze.');
  }

  const cacheKey = `webintel_analysis_${cleanUrl}`;

  // 1. Check local storage cache if not forcing refresh
  if (!forceRefresh && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get([cacheKey]);
      if (stored && stored[cacheKey]) {
        const { data, timestamp } = stored[cacheKey];
        if (data && timestamp && Date.now() - timestamp < CACHE_TTL_MS) {
          return data as FullDossier;
        }
      }
    } catch (e) {
      console.warn('Cache lookup failed:', e);
    }
  }

  // 2. Query the live backend API
  const baseUrl = await getApiBaseUrl();
  const endpoint = `${baseUrl}/analyze`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 60000); // 60s timeout

  const onAbort = () => timeoutController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      const abortErr = new Error('Analysis was cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    externalSignal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: cleanUrl, title }),
      signal: timeoutController.signal,
    });

    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onAbort);
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const errorMsg =
        errBody.detail ||
        (Array.isArray(errBody) ? errBody[0]?.msg : null) ||
        `Server returned error HTTP ${resp.status}`;
      throw new Error(errorMsg);
    }

    const data: FullDossier = await resp.json();

    // Ensure status is valid
    if (!data || data.status === 'failed') {
      throw new Error((data as any)?.error || 'Analysis service was unable to parse this website.');
    }

    // 3. Cache the live result in chrome.storage.local per analyzed URL
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({
          [cacheKey]: {
            data,
            timestamp: Date.now(),
          },
        });
      } catch (cacheErr) {
        console.warn('Failed to cache analysis:', cacheErr);
      }
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onAbort);
    }
    if (err.name === 'AbortError' || err.message === 'Aborted') {
      const abortErr = new Error('Analysis was cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  }
}

/**
 * Downloads data in CSV, XLSX, or JSON format.
 */
export function triggerExport(
  data: any,
  format: 'csv' | 'xlsx' | 'json',
  filename: string = 'export'
) {
  if (!data) return;

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  // Build CSV
  const items = Array.isArray(data)
    ? data
    : data.products && Array.isArray(data.products)
    ? data.products
    : [data];

  if (items.length === 0) {
    const emptyBlob = new Blob(['No data available for export\n'], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(emptyBlob, `${filename}.csv`);
    return;
  }

  const headers = Object.keys(items[0]).filter(
    (k) => typeof items[0][k] !== 'object' || items[0][k] === null
  );
  const csvRows = [headers.join(',')];

  for (const item of items) {
    const row = headers.map((h) => {
      const val = item[h] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.${format === 'xlsx' ? 'xlsx' : 'csv'}`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
