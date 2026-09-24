import { BrowserTrafficData, CountryTraffic, TrafficChannel, Referrer } from '../../types';

export interface RawStatsData {
  pageviews?: { value: number; prev?: number } | number;
  visitors?: { value: number; prev?: number } | number;
  visits?: { value: number; prev?: number } | number;
  bounces?: { value: number; prev?: number } | number;
  totaltime?: { value: number; prev?: number } | number;
}

export interface RawMetricItem {
  x: string;
  y: number;
}

export interface RawMetricsData {
  countries?: RawMetricItem[];
  channels?: RawMetricItem[];
  referrers?: RawMetricItem[];
}

/**
 * Helper to extract numeric value from either a primitive number or an upstream stats object { value, prev }
 */
function extractValue(field: { value: number; prev?: number } | number | undefined): number {
  if (typeof field === 'number') return field;
  if (field && typeof field.value === 'number') return field.value;
  return 0;
}

/**
 * Maps raw traffic metrics from the upstream API client into a standardized BrowserTrafficData object.
 * Returns null if the data represents an unmetered or empty dataset.
 */
export function mapRawTrafficData(
  stats: RawStatsData | null | undefined,
  metrics: RawMetricsData | null | undefined,
  domain: string
): BrowserTrafficData | null {
  if (!stats) return null;

  const visits = extractValue(stats.visits);
  const pageviews = extractValue(stats.pageviews);
  const bounces = extractValue(stats.bounces);
  const totaltime = extractValue(stats.totaltime);
  const visitors = extractValue(stats.visitors);

  // If there are zero visits, visitors, and pageviews, this domain is unmetered
  if (visits === 0 && pageviews === 0 && visitors === 0) {
    return null;
  }

  // Monthly visits (use visits or visitors)
  const monthlyVisits = visits > 0 ? visits : visitors > 0 ? visitors : null;

  // Average visit duration in seconds
  const avgVisitDuration =
    visits > 0 && totaltime > 0
      ? Math.round(totaltime / visits)
      : null;

  // Pages per visit
  const pagesPerVisit =
    visits > 0 && pageviews > 0
      ? Number((pageviews / visits).toFixed(1))
      : null;

  // Bounce rate as a clean percentage (0 - 100)
  const bounceRate =
    visits > 0 && bounces >= 0
      ? Number(Math.min(100, Math.max(0, (bounces / visits) * 100)).toFixed(1))
      : null;

  // Top Countries mapping with percentage shares
  const rawCountries = Array.isArray(metrics?.countries) ? metrics.countries : [];
  const totalCountryVisits = rawCountries.reduce((sum, item) => sum + (item.y || 0), 0);
  const topCountries: CountryTraffic[] = rawCountries
    .slice(0, 5)
    .map((item) => ({
      country: item.x || 'Unknown',
      visits: item.y || 0,
      share: totalCountryVisits > 0 ? Number(((item.y / totalCountryVisits) * 100).toFixed(1)) : 0,
    }));

  // Traffic Channels mapping
  const rawChannels = Array.isArray(metrics?.channels) ? metrics.channels : [];
  const totalChannelVisits = rawChannels.reduce((sum, item) => sum + (item.y || 0), 0);
  const trafficChannels: TrafficChannel[] = rawChannels
    .slice(0, 5)
    .map((item) => ({
      channel: item.x || 'Other',
      share: totalChannelVisits > 0 ? Number(((item.y / totalChannelVisits) * 100).toFixed(1)) : 0,
    }));

  // Top Referrers mapping
  const rawReferrers = Array.isArray(metrics?.referrers) ? metrics.referrers : [];
  const topReferrers: Referrer[] = rawReferrers
    .slice(0, 5)
    .map((item) => ({
      referrer: item.x || 'Direct / None',
      visits: item.y || 0,
    }));

  return {
    monthlyVisits,
    avgVisitDuration,
    pagesPerVisit,
    bounceRate,
    topCountries,
    trafficChannels,
    topReferrers,
    source: 'browser-traffic',
    lastUpdated: new Date().toISOString(),
  };
}
