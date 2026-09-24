import { BrowserTrafficData } from '../../types';

declare const chrome: any;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL
const CACHE_PREFIX = 'browser_traffic_cache_';

interface CacheEntry {
  data: BrowserTrafficData;
  timestamp: number;
}

export class BrowserTrafficCache {
  private memCache: Map<string, CacheEntry> = new Map();

  private getCacheKey(domain: string): string {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
    return `${CACHE_PREFIX}${cleanDomain}`;
  }

  /**
   * Retrieves cached traffic data for a domain if it exists and has not expired.
   */
  async get(domain: string): Promise<BrowserTrafficData | null> {
    if (!domain) return null;
    const key = this.getCacheKey(domain);

    // 1. Check in-memory cache first for instant synchronous return
    const memEntry = this.memCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
        return memEntry.data;
      }
      this.memCache.delete(key);
    }

    // 2. Check chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get([key]);
        if (stored && stored[key]) {
          const entry = stored[key] as CacheEntry;
          if (entry && entry.data && entry.timestamp && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            // Populate memory cache for subsequent checks
            this.memCache.set(key, entry);
            return entry.data;
          }
          // Expired: clean up
          chrome.storage.local.remove([key]).catch(() => {});
        }
      } catch (err) {
        console.warn('Browser Traffic storage get error:', err);
      }
    }

    return null;
  }

  /**
   * Stores traffic data for a domain with current timestamp.
   */
  async set(domain: string, data: BrowserTrafficData): Promise<void> {
    if (!domain || !data) return;
    const key = this.getCacheKey(domain);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };

    // Store in memory
    this.memCache.set(key, entry);

    // Persist in chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [key]: entry });
      } catch (err) {
        console.warn('Browser Traffic storage set error:', err);
      }
    }
  }

  /**
   * Invalidates cached traffic data for a specific domain (used during Re-analyze).
   */
  async invalidate(domain: string): Promise<void> {
    if (!domain) return;
    const key = this.getCacheKey(domain);

    this.memCache.delete(key);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.remove([key]);
      } catch (err) {
        console.warn('Browser Traffic storage invalidate error:', err);
      }
    }
  }

  /**
   * Clears all Browser Traffic cached entries.
   */
  async clear(): Promise<void> {
    this.memCache.clear();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const all = await chrome.storage.local.get(null);
        const keysToRemove = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
      } catch (err) {
        console.warn('Browser Traffic storage clear error:', err);
      }
    }
  }
}

export const browserTrafficCache = new BrowserTrafficCache();
