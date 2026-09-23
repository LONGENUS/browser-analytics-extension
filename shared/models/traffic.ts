/**
 * WebIntel — Website Traffic Analytics TypeScript Interfaces (Module 5)
 */

export interface CountryShare {
  country: string;
  code?: string;
  share: number;
}

export interface TrafficChannels {
  direct: number;
  search: number;
  social: number;
  referral: number;
  mail: number;
}

export interface TrafficMetrics {
  monthlyVisits: number | null;
  avgVisitDuration: string | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;
}

export interface TrafficResponse {
  url: string;
  domain: string;
  source: string;
  status: 'available' | 'unmetered';
  metrics: TrafficMetrics;
  topCountries: CountryShare[];
  trafficChannels?: TrafficChannels;
  topReferrers: string[];
  note?: string;
}

export interface TrafficError {
  module: 'traffic';
  status: 'failed';
  reason: string;
  details?: Record<string, any>;
}
