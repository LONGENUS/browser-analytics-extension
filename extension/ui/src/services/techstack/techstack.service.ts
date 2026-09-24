import { TechStackData, TechItem } from '../../types';
import { DetectionContext } from './fingerprints';
import { detectTechnologiesFromContext } from './detector';
import { mapTechStackData } from './mapper';

declare const chrome: any;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = 'tech_stack_cache_';

interface CacheEntry {
  data: TechStackData;
  timestamp: number;
}

export class TechStackService {
  private memCache: Map<string, CacheEntry> = new Map();

  private getCacheKey(domain: string): string {
    const clean = (domain || '').toLowerCase().replace(/^www\./, '').trim();
    return `${CACHE_PREFIX}${clean}`;
  }

  /**
   * Retrieves tech stack data for a domain.
   * If cached and not forced to refresh, returns cached data instantly.
   * Otherwise evaluates context and caches the result.
   */
  async getTechStack(
    domain: string,
    context?: DetectionContext,
    forceRefresh: boolean = false
  ): Promise<TechStackData> {
    const cleanDomain = (domain || '').toLowerCase().replace(/^www\./, '').trim();
    const key = this.getCacheKey(cleanDomain);

    // 1. Check in-memory cache
    if (!forceRefresh) {
      const memEntry = this.memCache.get(key);
      if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
        return memEntry.data;
      }

      // Check chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          const stored = await chrome.storage.local.get([key]);
          if (stored && stored[key]) {
            const entry = stored[key] as CacheEntry;
            if (entry && entry.data && Date.now() - entry.timestamp < CACHE_TTL_MS) {
              this.memCache.set(key, entry);
              return entry.data;
            }
          }
        } catch (_) {}
      }
    }

    // 2. If detection context provided, run detector
    let detected: TechItem[] = [];
    if (context) {
      detected = detectTechnologiesFromContext(context);
    }

    const techStackData = mapTechStackData(detected);

    // 3. Cache results if technologies were detected
    if (cleanDomain && detected.length > 0) {
      const entry: CacheEntry = {
        data: techStackData,
        timestamp: Date.now(),
      };
      this.memCache.set(key, entry);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: entry }).catch(() => {});
      }
    }

    return techStackData;
  }

  /**
   * Invalidates cached tech stack data for a specific domain.
   */
  async invalidate(domain: string): Promise<void> {
    const key = this.getCacheKey(domain);
    this.memCache.delete(key);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([key]).catch(() => {});
    }
  }

  /**
   * Clears all tech stack cache entries.
   */
  async clearCache(): Promise<void> {
    this.memCache.clear();
  }
}

export const techStackService = new TechStackService();
