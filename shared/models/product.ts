/**
 * WebIntel — Shared TypeScript Definitions
 * Module 2: Product Intelligence
 */

export interface ProductItem {
  productName: string;
  brand: string;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number;
  rating: number | null;
  reviewCount: number;
  asinSku: string;
  availability: string;
  primeShipping: string;
  imageUrl: string;
  productUrl: string;
  position: number;

  // Legacy aliases for backward compatibility with UI
  title?: string;
  asin?: string;
  image?: string;
  url?: string;
  link?: string;
  reviews?: string;
  shipping?: string;
}

export interface DiscountDistribution {
  '0%': number;
  '1-10%': number;
  '11-25%': number;
  '26-50%': number;
  '50%+': number;
}

export interface ProductAnalytics {
  totalProducts: number;
  uniqueProducts: number;
  duplicateProducts: number;
  duplicateAsins: number;
  brandCount: number;
  averagePrice: number | null;
  medianPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  discountDistribution: DiscountDistribution;
  topBrands: Array<{ brand: string; count: number }>;

  // Legacy aliases
  avg_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  unique_brands?: number;
}

export interface PaginatedProducts {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: ProductItem[];
}

export interface ProductIntelligenceResponse {
  url: string;
  domain: string;
  analytics: ProductAnalytics;
  pagination: PaginatedProducts;
  products: ProductItem[];
}

export interface ProductModuleError {
  module: 'products';
  status: 'failed';
  reason: string;
  details?: Record<string, any>;
}

export type ProductResult = ProductIntelligenceResponse | ProductModuleError;

export function isProductSuccess(result: ProductResult): result is ProductIntelligenceResponse {
  return (result as ProductModuleError).status !== 'failed';
}
