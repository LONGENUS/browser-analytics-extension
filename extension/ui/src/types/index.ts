export interface ProductItem {
  product_name: string;
  title?: string;
  brand: string;
  price: number | null;
  original_price: number | null;
  discount_percent: number;
  rating: number | null;
  review_count: number;
  reviews_count?: number;
  asin_sku: string;
  asin?: string;
  availability: string;
  prime_shipping: string;
  shipping?: string;
  image_url: string;
  image?: string;
  product_url: string;
  url?: string;
  position: number;
}

export interface OverviewData {
  url: string;
  domain: string;
  title: string;
  favicon?: string;
  industry?: string;
  pageType?: string;
  platform?: string;
  confidence?: number;
  language?: string;
  currency?: string;
  scrapedAt?: string;
  statusCode?: number;
  canonicalUrl?: string;
}

export interface SeoMetadata {
  title: string;
  title_length: number;
  description: string;
  description_length: number;
  canonical: string;
  robots: string;
  viewport?: string;
  charset?: string;
  keywords?: string;
  author?: string;
}

export interface HeadingItem {
  tag: string;
  text: string;
  level: number;
}

export interface HeadingsAudit {
  h1_count: number;
  h2_count: number;
  h3_count: number;
  h1_tags: string[];
  hierarchy_issues: string[];
  all_headings: HeadingItem[];
}

export interface ImagesAudit {
  total_images: number;
  missing_alt_count: number;
  alt_coverage_percent: number;
  format_breakdown: Record<string, number>;
}

export interface LinksAudit {
  total_links: number;
  internal_links_count: number;
  external_links_count: number;
  nofollow_count: number;
  empty_anchor_count: number;
}

export interface SeoScore {
  score: number;
  rating: string;
  breakdown: Record<string, number>;
  recommendations: string[];
}

export interface SeoIntelligence {
  seo_score: SeoScore;
  metadata: SeoMetadata;
  headings: HeadingsAudit;
  images: ImagesAudit;
  links: LinksAudit;
  open_graph?: Record<string, string>;
  twitter_cards?: Record<string, string>;
  structured_data?: {
    has_json_ld: boolean;
    detected_types: string[];
    count?: number;
    items?: Array<{ schema_type: string; context: string; name?: string | null }>;
  };
}

export interface TechItem {
  name: string;
  category: string;
  confidence: number;
  version?: string;
  icon?: string;
  detectedBy?: string[];
  website?: string;
  description?: string;
}

export interface TechStackData {
  total_detected: number;
  categories: Record<string, TechItem[]>;
  technologies: TechItem[];
}

export interface CountryTraffic {
  country: string;
  share: number;
  visits?: number;
}

export interface TrafficChannel {
  channel: string;
  share: number;
}

export interface Referrer {
  referrer: string;
  visits: number;
}

export interface BrowserTrafficData {
  monthlyVisits: number | null;
  avgVisitDuration: number | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;

  topCountries: CountryTraffic[];
  trafficChannels: TrafficChannel[];
  topReferrers: Referrer[];
  globalRank?: number | null;

  source: "browser-traffic";
  lastUpdated: string;
}

export interface BrowserTrafficProvider {
  getTraffic(domain: string): Promise<BrowserTrafficData | null>;
}

export interface TrafficMetrics {
  monthlyVisits: number | null;
  avgVisitDuration: string | number | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;
}

export interface CountryShare {
  country: string;
  code?: string;
  share: number;
  visits?: number;
}

export interface TrafficChannels {
  direct?: number;
  search?: number;
  social?: number;
  referral?: number;
  mail?: number;
  [key: string]: number | undefined;
}

export interface TrafficData {
  source: string;
  status: string;
  metrics: TrafficMetrics;
  topCountries?: CountryShare[];
  trafficChannels?: TrafficChannels | TrafficChannel[];
  channels?: TrafficChannels;
  topReferrers?: Referrer[] | string[];
  lastUpdated?: string;
}

export interface ProductAnalytics {
  total_products: number;
  unique_products: number;
  duplicate_products: number;
  duplicate_asins: number;
  brand_count: number;
  average_price: number | null;
  median_price: number | null;
  lowest_price: number | null;
  highest_price: number | null;
  discount_distribution: Record<string, number>;
}

export interface FullDossier {
  id?: string;
  url: string;
  domain: string;
  title: string;
  status: string;
  summary: string;
  overview: OverviewData;
  products_intelligence?: {
    analytics?: ProductAnalytics;
    pagination?: any;
    products?: ProductItem[];
  };
  seo_intelligence?: SeoIntelligence;
  tech_stack?: TechStackData;
  traffic?: TrafficData;
  analytics?: Record<string, any>;
  products: ProductItem[];
  created_at: string;
}
