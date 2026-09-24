/**
 * Browser Traffic Provider
 *
 * Portions adapted from upstream telemetry API client
 * Copyright (c) Umami Software, Inc.
 * Licensed under the MIT License.
 *
 * All user-facing interfaces and telemetry consumers strictly use the Browser Traffic brand.
 */

import { BrowserTrafficData, BrowserTrafficProvider } from '../../types';
import { mapRawTrafficData, RawStatsData, RawMetricsData, RawMetricItem } from './mapper';

interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  token?: string;
}

export class StandardBrowserTrafficProvider implements BrowserTrafficProvider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  /**
   * Resolves the configured API base URL for Browser Traffic.
   */
  private getBaseUrl(): string | null {
    if (this.config.baseUrl) {
      return this.config.baseUrl.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined') {
      const appConfig = (window as any).APP_CONFIG;
      if (appConfig?.BROWSER_TRAFFIC_URL) {
        return appConfig.BROWSER_TRAFFIC_URL.replace(/\/$/, '');
      }
      const storedUrl = localStorage.getItem('browser_traffic_api_url');
      if (storedUrl) {
        return storedUrl.replace(/\/$/, '');
      }
    }

    return null;
  }

  /**
   * Resolves authentication headers (bearer token or API key).
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const token =
      this.config.token ||
      (typeof window !== 'undefined' ? localStorage.getItem('browser_traffic_token') : null);

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiKey =
      this.config.apiKey ||
      (typeof window !== 'undefined' ? localStorage.getItem('browser_traffic_api_key') : null);

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  /**
   * Retrieves live Browser Traffic data for the given domain.
   * If the domain has no recorded telemetry, returns null.
   */
  async getTraffic(domain: string): Promise<BrowserTrafficData | null> {
    if (!domain) return null;

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
    const baseUrl = this.getBaseUrl();

    // If no provider URL is configured, return null (triggers honest Unavailable state)
    if (!baseUrl) {
      return null;
    }

    try {
      const headers = this.getHeaders();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      // 1. Search for website by domain
      const searchRes = await fetch(
        `${baseUrl}/api/websites?search=${encodeURIComponent(cleanDomain)}`,
        {
          headers,
          signal: controller.signal,
        }
      );

      if (!searchRes.ok) {
        clearTimeout(timeoutId);
        return null;
      }

      const searchJson = await searchRes.json();
      const websites = Array.isArray(searchJson) ? searchJson : searchJson?.data || [];
      const match = websites.find(
        (w: any) =>
          w.domain?.toLowerCase() === cleanDomain ||
          w.domain?.toLowerCase() === `www.${cleanDomain}` ||
          cleanDomain.includes(w.domain?.toLowerCase())
      );

      if (!match || !match.id) {
        clearTimeout(timeoutId);
        return null;
      }

      const websiteId = match.id;
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      // 2. Fetch stats and metrics in parallel
      const [statsRes, countriesRes, channelsRes, referrersRes] = await Promise.all([
        fetch(
          `${baseUrl}/api/websites/${websiteId}/stats?startAt=${thirtyDaysAgo}&endAt=${now}`,
          { headers, signal: controller.signal }
        ),
        fetch(
          `${baseUrl}/api/websites/${websiteId}/metrics?startAt=${thirtyDaysAgo}&endAt=${now}&type=country`,
          { headers, signal: controller.signal }
        ),
        fetch(
          `${baseUrl}/api/websites/${websiteId}/metrics?startAt=${thirtyDaysAgo}&endAt=${now}&type=channel`,
          { headers, signal: controller.signal }
        ).catch(() => null),
        fetch(
          `${baseUrl}/api/websites/${websiteId}/metrics?startAt=${thirtyDaysAgo}&endAt=${now}&type=referrer`,
          { headers, signal: controller.signal }
        ).catch(() => null),
      ]);

      clearTimeout(timeoutId);

      if (!statsRes.ok) {
        return null;
      }

      const rawStats: RawStatsData = await statsRes.json();
      const rawCountries: RawMetricItem[] = countriesRes.ok ? await countriesRes.json() : [];
      const rawChannels: RawMetricItem[] =
        channelsRes && channelsRes.ok ? await channelsRes.json() : [];
      const rawReferrers: RawMetricItem[] =
        referrersRes && referrersRes.ok ? await referrersRes.json() : [];

      const rawMetrics: RawMetricsData = {
        countries: Array.isArray(rawCountries) ? rawCountries : [],
        channels: Array.isArray(rawChannels) ? rawChannels : [],
        referrers: Array.isArray(rawReferrers) ? rawReferrers : [],
      };

      return mapRawTrafficData(rawStats, rawMetrics, cleanDomain);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Browser Traffic provider query notice:', err);
      }
      return null;
    }
  }
}

export const defaultBrowserTrafficProvider = new StandardBrowserTrafficProvider();
