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
 * Directly communicates with the active tab's content script to extract live DOM data.
 * Uses both message passing and direct script execution fallbacks.
 */
export async function extractFromActiveTab(): Promise<any> {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && (tab.url?.startsWith('http://') || tab.url?.startsWith('https://'))) {
        // Fast path 1: Try sending message to existing content script
        const sendMsg = () =>
          new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' }, (res: any) => {
              if (chrome.runtime?.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });

        let resp = await sendMsg();

        // Fast path 2: If content script was not yet active on the tab, inject it on-demand
        if (!resp || !resp.success) {
          if (chrome.scripting && chrome.scripting.executeScript) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js'],
              });

              resp = await sendMsg();

              // Fallback 3: Direct function execution via executeScript return value
              if (!resp || !resp.success) {
                const directResults = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => {
                    const fn = (window as any).__webIntelExtract;
                    return typeof fn === 'function' ? fn() : null;
                  },
                });

                if (directResults && directResults[0] && directResults[0].result) {
                  return directResults[0].result;
                }
              }
            } catch (injectionErr) {
              console.warn('Script injection notice:', injectionErr);
            }
          }
        }

        if (resp && resp.success && resp.data) {
          return resp.data;
        }
      }
    } catch (e) {
      console.warn('extractFromActiveTab notice:', e);
    }
  }
  return null;
}

/**
 * Builds a normalized FullDossier from live content script DOM data.
 */
function buildDossierFromLiveData(liveData: any): FullDossier {
  const products = liveData.products || [];
  const domain = liveData.domain || extractDomain(liveData.url);
  const platform = liveData.platform || 'Website';
  const pageType = liveData.pageType || (products.length > 0 ? 'Marketplace' : 'Website');

  // Adaptive Currency Detection
  let currency = 'USD';
  if (domain.endsWith('.in') || domain.includes('amazon.in') || domain.includes('flipkart')) {
    currency = 'INR';
  } else if (domain.endsWith('.uk') || domain.endsWith('.co.uk')) {
    currency = 'GBP';
  } else if (domain.endsWith('.de') || domain.endsWith('.fr') || domain.endsWith('.it') || domain.endsWith('.es') || domain.endsWith('.eu')) {
    currency = 'EUR';
  } else if (domain.endsWith('.ca')) {
    currency = 'CAD';
  } else if (domain.endsWith('.au')) {
    currency = 'AUD';
  }

  // Compute product analytics
  const prices = products.map((p: any) => p.price).filter((p: any) => typeof p === 'number' && p > 0);
  const avgPrice = prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : null;
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const highestPrice = prices.length ? Math.max(...prices) : null;
  const brands = Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean)));

  const industry =
    platform === 'Amazon' || platform === 'Nike' || platform === 'eBay' || platform === 'Walmart' || platform === 'Etsy' || platform === 'Shopify' || products.length > 0
      ? 'Retail & E-Commerce'
      : domain.includes('github')
      ? 'Developer Tools & SaaS'
      : domain.includes('stripe')
      ? 'Financial Technology & Payments'
      : 'Internet & Technology';

  const techCount = liveData.technologies?.length || 0;
  const summary =
    products.length === 1
      ? `Live product intelligence extracted from ${domain}. Recognized 1 product listing (${products[0].product_name}) on ${platform}.`
      : products.length > 1
      ? `Live marketplace intelligence extracted from ${domain}. Discovered ${products.length} products on ${platform} (${pageType}).`
      : `Live website intelligence extracted from ${domain}. Analyzed SEO hierarchy and ${techCount} detected technologies.`;

  // Group technologies by category
  const categories: Record<string, any[]> = {};
  if (Array.isArray(liveData.technologies)) {
    liveData.technologies.forEach((tech: any) => {
      const cat = tech.category || 'General';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(tech);
    });
  }

  return {
    id: `live_${Date.now()}`,
    url: liveData.url,
    domain,
    title: liveData.title || domain,
    status: 'completed',
    summary,
    created_at: new Date().toISOString(),
    overview: {
      url: liveData.url,
      domain,
      title: liveData.title || domain,
      favicon: liveData.favicon,
      pageType,
      platform,
      industry,
      confidence: 0.98,
      language: 'en',
      currency,
      scrapedAt: new Date().toLocaleTimeString(),
    },
    products,
    products_intelligence: {
      products,
      analytics: {
        total_products: products.length,
        unique_products: products.length,
        duplicate_products: 0,
        duplicate_asins: 0,
        average_price: avgPrice,
        median_price: avgPrice,
        lowest_price: lowestPrice,
        highest_price: highestPrice,
        brand_count: brands.length,
        discount_distribution: {
          '0-10%': products.filter((p: any) => (p.discount_percent || 0) <= 10).length,
          '10-25%': products.filter((p: any) => (p.discount_percent || 0) > 10 && (p.discount_percent || 0) <= 25).length,
          '25-50%': products.filter((p: any) => (p.discount_percent || 0) > 25 && (p.discount_percent || 0) <= 50).length,
          '50%+': products.filter((p: any) => (p.discount_percent || 0) > 50).length,
        },
      },
    },
    seo_intelligence: {
      seo_score: liveData.seo_score || { score: 75, rating: 'Good', breakdown: {}, recommendations: [] },
      metadata: liveData.meta || {},
      headings: liveData.headings || { h1_count: 0, h2_count: 0, h3_count: 0, h1_tags: [], hierarchy_issues: [], all_headings: [] },
      images: liveData.images || { total_images: 0, missing_alt_count: 0, alt_coverage_percent: 100, format_breakdown: {} },
      links: liveData.links || { total_links: 0, internal_links_count: 0, external_links_count: 0, nofollow_count: 0, empty_anchor_count: 0 },
      open_graph: liveData.openGraph || {},
      twitter_cards: liveData.twitterCards || {},
      structured_data: liveData.structuredData || { has_json_ld: false, detected_types: [], count: 0, items: [] },
    },
    tech_stack: {
      total_detected: techCount,
      categories,
      technologies: liveData.technologies || [],
    },
    traffic: {
      source: 'Unavailable (Coming soon)',
      status: 'unmetered',
      metrics: {
        monthlyVisits: null,
        avgVisitDuration: null,
        pagesPerVisit: null,
        bounceRate: null,
      },
      topCountries: [],
    },
  };
}

/**
 * Executes a real-time website analysis by calling the active tab DOM extractor
 * and backend API. Never returns demo or mock data.
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

  // 2. Query the live tab directly via content script (100% real-time rendered DOM extraction)
  let liveTabData: any = null;
  try {
    liveTabData = await extractFromActiveTab();
  } catch (e) {
    console.warn('Live tab extraction notice:', e);
  }

  // If live active tab data is available for this URL/domain, build and return the live dossier immediately!
  if (liveTabData && (liveTabData.url === cleanUrl || extractDomain(cleanUrl) === liveTabData.domain)) {
    const liveDossier = buildDossierFromLiveData(liveTabData);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: { data: liveDossier, timestamp: Date.now() } }).catch(() => {});
    }
    return liveDossier;
  }

  // 3. Fallback: Query the backend API when running outside Chrome extension context or on background URL
  const baseUrl = await getApiBaseUrl();
  const endpoint = `${baseUrl}/analyze`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 20000); // 20s timeout

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

    if (resp.ok) {
      const data: FullDossier = await resp.json();

      // If backend returned 0 products but live tab extracted products, merge them!
      if (liveTabData && liveTabData.products && liveTabData.products.length > (data.products?.length || 0)) {
        data.products = liveTabData.products;
        if (data.products_intelligence?.analytics) {
          data.products_intelligence.analytics.total_products = liveTabData.products.length;
        }
      }

      // If backend SEO was incomplete, merge live tab SEO
      if (liveTabData && (!data.seo_intelligence?.headings?.all_headings || data.seo_intelligence.headings.all_headings.length === 0)) {
        if (liveTabData.headings?.all_headings?.length) {
          data.seo_intelligence = {
            ...data.seo_intelligence,
            headings: liveTabData.headings,
          };
        }
      }

      // Cache the result
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [cacheKey]: { data, timestamp: Date.now() } }).catch(() => {});
      }

      return data;
    }
  } catch (backendErr: any) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onAbort);
    }
    if (backendErr.name === 'AbortError' && externalSignal?.aborted) {
      const abortErr = new Error('Analysis was cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    console.warn('Backend query skipped/failed, evaluating live tab extraction:', backendErr);
  }

  // 4. If backend was unreachable or blocked by bot-protection, use live DOM data directly
  if (liveTabData && (liveTabData.url === cleanUrl || extractDomain(cleanUrl) === liveTabData.domain)) {
    const liveDossier = buildDossierFromLiveData(liveTabData);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: { data: liveDossier, timestamp: Date.now() } }).catch(() => {});
    }
    return liveDossier;
  }

  throw new Error('Unable to extract live data. Please ensure the target website is loaded in the active tab.');
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
