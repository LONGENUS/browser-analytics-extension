import { BrowserTrafficData, BrowserTrafficProvider } from '../../types';
import { defaultBrowserTrafficProvider } from './provider';
import { browserTrafficCache, BrowserTrafficCache } from './cache';

export class BrowserTrafficService {
  private provider: BrowserTrafficProvider;
  private cache: BrowserTrafficCache;
  private activeFetches: Map<string, Promise<BrowserTrafficData | null>> = new Map();

  constructor(
    provider: BrowserTrafficProvider = defaultBrowserTrafficProvider,
    cache: BrowserTrafficCache = browserTrafficCache
  ) {
    this.provider = provider;
    this.cache = cache;
  }

  /**
   * Sets or swaps the active traffic provider implementation.
   */
  setProvider(provider: BrowserTrafficProvider) {
    this.provider = provider;
  }

  /**
   * Normalizes domain names (e.g. "https://www.example.com/path" -> "example.com")
   */
  private normalizeDomain(domainOrUrl: string): string {
    if (!domainOrUrl) return '';
    try {
      if (domainOrUrl.includes('://')) {
        const parsed = new URL(domainOrUrl);
        return parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
      }
      return domainOrUrl.split('/')[0].toLowerCase().replace(/^www\./, '').trim();
    } catch {
      return domainOrUrl.toLowerCase().replace(/^www\./, '').trim();
    }
  }

  /**
   * Retrieves Browser Traffic metrics for the domain.
   * If cached and not forced to refresh, returns cached metrics instantly.
   * Otherwise fetches live telemetry and caches for 30 minutes.
   */
  async getTraffic(domainOrUrl: string, forceRefresh: boolean = false): Promise<BrowserTrafficData | null> {
    const domain = this.normalizeDomain(domainOrUrl);
    if (!domain) return null;

    // 1. Invalidate cache if re-analysis requested
    if (forceRefresh) {
      await this.cache.invalidate(domain);
    } else {
      // 2. Check 30-minute cache
      const cached = await this.cache.get(domain);
      if (cached) {
        return cached;
      }
    }

    // 3. Prevent duplicate concurrent fetches for the same domain
    if (this.activeFetches.has(domain)) {
      return this.activeFetches.get(domain)!;
    }

    const fetchPromise = (async () => {
      try {
        const trafficData = await this.provider.getTraffic(domain);
        if (trafficData) {
          await this.cache.set(domain, trafficData);
        }
        return trafficData;
      } catch (err) {
        console.warn('Browser Traffic service retrieval error:', err);
        return null;
      } finally {
        this.activeFetches.delete(domain);
      }
    })();

    this.activeFetches.set(domain, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate cached data for a specific domain.
   */
  async invalidate(domainOrUrl: string): Promise<void> {
    const domain = this.normalizeDomain(domainOrUrl);
    if (domain) {
      await this.cache.invalidate(domain);
    }
  }

  /**
   * Clear all Browser Traffic cache entries.
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

export const browserTrafficService = new BrowserTrafficService();
