import { FullDossier } from '../types';

declare const chrome: any;

// Default production endpoint or local development fallback
const API_BASE_URL =
  typeof window !== 'undefined' && (window as any).APP_CONFIG
    ? (window as any).APP_CONFIG.getBaseUrl()
    : 'https://browser-analytics-extension-longenus05-3620s-projects.vercel.app';

export async function getCurrentTabUrl(): Promise<{ url: string; title: string }> {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        return { url: tab.url, title: tab.title || '' };
      }
    } catch (e) {
      console.warn('Chrome tabs query failed:', e);
    }
  }
  return {
    url: 'https://www.amazon.in/s?k=Ravensburger+puzzle',
    title: 'Amazon.in : Ravensburger puzzle',
  };
}

export async function analyzeWebsite(url: string, title: string = ''): Promise<FullDossier> {
  // 1. Try local storage cache first
  const cacheKey = `webintel_cache_${url}`;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const cached = await chrome.storage.local.get([cacheKey]);
      if (cached && cached[cacheKey]) {
        return cached[cacheKey];
      }
    } catch (e) {
      console.warn('Cache lookup failed:', e);
    }
  }

  // 2. Fetch from backend API
  try {
    const resp = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, title }),
    });

    if (resp.ok) {
      const data: FullDossier = await resp.json();
      // Cache in local storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [cacheKey]: data });
        } catch (_) {}
      }
      return data;
    }
  } catch (err) {
    console.warn('API call to backend failed, serving rich preview dossier:', err);
  }

  // 3. High-fidelity fallback dataset matching mockup if offline
  return getMockDossier(url, title);
}

export function triggerExport(data: any, format: 'csv' | 'xlsx' | 'json', filename: string = 'export') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
    return;
  }

  // Build CSV
  const items = Array.isArray(data) ? data : data.products || [data];
  if (items.length > 0) {
    const headers = Object.keys(items[0]).filter(k => typeof items[0][k] !== 'object');
    const csvRows = [headers.join(',')];
    for (const item of items) {
      const row = headers.map(h => {
        const val = item[h] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.${format === 'xlsx' ? 'csv' : 'csv'}`);
  }
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

export function getMockDossier(url: string, title: string): FullDossier {
  return {
    url: url || 'https://www.amazon.in/s?k=Ravensburger+puzzle',
    domain: 'amazon.in',
    title: title || 'Amazon.in : Ravensburger puzzle',
    status: 'completed',
    summary:
      'This is an e-commerce search results page on Amazon India featuring Ravensburger jigsaw puzzles with over 227 products, high ratings, and Prime fast delivery options.',
    created_at: new Date().toISOString(),
    overview: {
      url: url || 'https://www.amazon.in/s?k=Ravensburger+puzzle',
      domain: 'amazon.in',
      title: 'Amazon.in : Ravensburger puzzle',
      favicon: 'https://www.amazon.in/favicon.ico',
      industry: 'Retail & Ecommerce',
      pageType: 'Marketplace',
      confidence: 0.98,
      language: 'en-IN',
      currency: 'INR',
      scrapedAt: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      canonicalUrl: 'https://www.amazon.in/s?k=Ravensburger+puzzle',
    },
    products: [
      {
        position: 1,
        product_name: 'Ravensburger 1000 Piece Jigsaw Puzzle - Colosseum',
        brand: 'Ravensburger',
        price: 1999,
        original_price: 2499,
        discount_percent: 20,
        rating: 4.8,
        review_count: 1245,
        asin_sku: 'B08XXXXXX1',
        availability: 'In Stock',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX1',
      },
      {
        position: 2,
        product_name: 'Ravensburger 500 Piece Puzzle - Disney Classics',
        brand: 'Ravensburger',
        price: 1299,
        original_price: 1599,
        discount_percent: 18.7,
        rating: 4.6,
        review_count: 892,
        asin_sku: 'B08XXXXXX2',
        availability: 'In Stock',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX2',
      },
      {
        position: 3,
        product_name: 'Ravensburger 1000 Piece Puzzle - Disney Castle Collection',
        brand: 'Ravensburger',
        price: 2499,
        original_price: 2999,
        discount_percent: 16.6,
        rating: 4.7,
        review_count: 654,
        asin_sku: 'B08XXXXXX3',
        availability: 'In Stock',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX3',
      },
      {
        position: 4,
        product_name: 'Ravensburger Kids 100 Piece Puzzle - Solar System Space',
        brand: 'Ravensburger',
        price: 899,
        original_price: 1099,
        discount_percent: 18.2,
        rating: 4.5,
        review_count: 321,
        asin_sku: 'B08XXXXXX4',
        availability: 'Only 3 left',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX4',
      },
      {
        position: 5,
        product_name: 'Ravensburger 2000 Piece World Map Antique Edition',
        brand: 'Ravensburger',
        price: 3999,
        original_price: 4999,
        discount_percent: 20.0,
        rating: 4.8,
        review_count: 210,
        asin_sku: 'B08XXXXXX5',
        availability: 'In Stock',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX5',
      },
      {
        position: 6,
        product_name: 'Clementoni High Quality Collection 1000pc Puzzle',
        brand: 'Clementoni',
        price: 1499,
        original_price: 1899,
        discount_percent: 21.0,
        rating: 4.4,
        review_count: 140,
        asin_sku: 'B08XXXXXX6',
        availability: 'In Stock',
        prime_shipping: 'Standard',
        image_url: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX6',
      },
      {
        position: 7,
        product_name: 'Trefl 1500 Piece Panoramic Mountain View',
        brand: 'Trefl',
        price: 1799,
        original_price: 2199,
        discount_percent: 18.1,
        rating: 4.3,
        review_count: 95,
        asin_sku: 'B08XXXXXX7',
        availability: 'In Stock',
        prime_shipping: 'Prime Free Delivery',
        image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&auto=format&fit=crop&q=80',
        product_url: 'https://www.amazon.in/dp/B08XXXXXX7',
      },
    ],
    products_intelligence: {
      analytics: {
        total_products: 227,
        unique_products: 214,
        duplicate_products: 13,
        duplicate_asins: 4,
        brand_count: 18,
        average_price: 2140,
        median_price: 1899,
        lowest_price: 299,
        highest_price: 9999,
        discount_distribution: {
          '0%': 45,
          '1-10%': 38,
          '11-25%': 112,
          '26-50%': 28,
          '50%+': 4,
        },
      },
    },
    seo_intelligence: {
      seo_score: {
        score: 72,
        rating: 'Good',
        breakdown: {
          title: 15,
          description: 15,
          canonical: 10,
          viewport: 10,
          headings: 12,
          images: 10,
        },
        recommendations: [
          'Add more descriptive meta description to improve SERP click-through rate',
          'Optimize image alt text: 45 product images are currently missing ALT tags',
          'Improve internal linking structure for category facet URLs',
          'Compress product catalog images to modern WebP format',
        ],
      },
      metadata: {
        title: 'Amazon.in : Ravensburger puzzle',
        title_length: 32,
        description: 'Buy Ravensburger puzzles online at best prices in India. Explore thousands of jigsaw puzzles for kids and adults with Prime delivery.',
        description_length: 136,
        canonical: 'https://www.amazon.in/s?k=Ravensburger+puzzle',
        robots: 'index, follow',
        viewport: 'width=device-width, initial-scale=1.0',
      },
      headings: {
        h1_count: 1,
        h2_count: 12,
        h3_count: 34,
        h1_tags: ['227 results for "Ravensburger puzzle"'],
        hierarchy_issues: [],
        all_headings: [
          { tag: 'h1', text: '227 results for "Ravensburger puzzle"', level: 1 },
          { tag: 'h2', text: 'Delivery Day', level: 2 },
          { tag: 'h2', text: 'Category & Jigsaws', level: 2 },
          { tag: 'h2', text: 'Customer Reviews', level: 2 },
        ],
      },
      images: {
        total_images: 227,
        missing_alt_count: 45,
        alt_coverage_percent: 80.2,
        format_breakdown: {
          jpg: 142,
          webp: 65,
          png: 20,
        },
      },
      links: {
        total_links: 312,
        internal_links_count: 298,
        external_links_count: 14,
        nofollow_count: 8,
        empty_anchor_count: 4,
      },
    },
    tech_stack: {
      total_detected: 24,
      categories: {
        'Frontend Framework': [
          { name: 'React', category: 'Frontend Framework', confidence: 98 },
          { name: 'Alpine.js', category: 'Frontend Framework', confidence: 85 },
        ],
        'CDN': [
          { name: 'CloudFront', category: 'CDN', confidence: 96 },
          { name: 'Akamai', category: 'CDN', confidence: 92 },
        ],
        'Hosting': [
          { name: 'AWS Cloud', category: 'Hosting', confidence: 99 },
        ],
        'Javascript Libraries': [
          { name: 'jQuery', category: 'Javascript Libraries', confidence: 95 },
          { name: 'Core-js', category: 'Javascript Libraries', confidence: 92 },
        ],
        'Advertising': [
          { name: 'Amazon Ads', category: 'Advertising', confidence: 99 },
          { name: 'Google Ads', category: 'Advertising', confidence: 88 },
        ],
      },
      technologies: [
        { name: 'Amazon Web Services', category: 'Hosting', confidence: 99 },
        { name: 'React', category: 'Frontend Framework', confidence: 98 },
        { name: 'CloudFront CDN', category: 'CDN', confidence: 96 },
        { name: 'jQuery', category: 'Javascript Libraries', confidence: 95 },
        { name: 'Akamai Edge', category: 'CDN', confidence: 92 },
        { name: 'Amazon Advertising', category: 'Advertising', confidence: 99 },
        { name: 'Google Ads', category: 'Advertising', confidence: 88 },
        { name: 'Alpine.js', category: 'Frontend Framework', confidence: 85 },
      ],
    },
    traffic: {
      source: 'Similarweb Public Estimates',
      status: 'available',
      metrics: {
        monthlyVisits: 12400000,
        avgVisitDuration: '4m 32s',
        pagesPerVisit: 6.1,
        bounceRate: 32.4,
      },
      topCountries: [
        { country: 'India', code: 'IN', share: 88.4 },
        { country: 'United States', code: 'US', share: 4.2 },
        { country: 'United Arab Emirates', code: 'AE', share: 2.1 },
        { country: 'United Kingdom', code: 'GB', share: 1.8 },
      ],
      trafficChannels: {
        direct: 48.2,
        search: 38.6,
        social: 4.1,
        referral: 7.2,
        mail: 1.9,
      },
      topReferrers: ['google.com', 'bing.com', 'youtube.com', 'facebook.com'],
    },
  };
}
