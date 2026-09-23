import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  Star,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
} from 'lucide-react';
import { ProductItem } from '../../types';
import { ProductDrawer } from './ProductDrawer';
import { triggerExport } from '../../services/api';

interface ProductsTabProps {
  products: ProductItem[];
  currencySymbol?: string;
  domain?: string;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products = [],
  currencySymbol = '$',
  domain = 'website',
}) => {
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [primeOnly, setPrimeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'position' | 'price-asc' | 'price-desc' | 'rating' | 'reviews'>('position');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Unique brands
  const brands = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
    return ['All', ...list];
  }, [products]);

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.product_name || p.title || '').toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.asin_sku.toLowerCase().includes(q)
      );
    }

    // Brand filter
    if (selectedBrand !== 'All') {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // Prime only filter
    if (primeOnly) {
      result = result.filter((p) =>
        (p.prime_shipping || p.shipping || '').toLowerCase().includes('prime')
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
      return (a.position || 0) - (b.position || 0);
    });

    return result;
  }, [products, search, selectedBrand, primeOnly, sortBy]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = (fmt: 'csv' | 'xlsx' | 'json') => {
    triggerExport(filteredProducts, fmt, `products-${domain}`);
  };

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Products
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {filteredProducts.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Search & Filter row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, brand, ASIN..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="position">Sort: Default</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="reviews">Most Reviewed</option>
          </select>
        </div>

        {/* Brand Chips */}
        {brands.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">Brand:</span>
            {brands.slice(0, 6).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setSelectedBrand(b);
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-colors ${
                  selectedBrand === b
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Products Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-2 w-12">Image</th>
                <th className="py-2.5 px-3 min-w-[140px]">Product Name</th>
                <th className="py-2.5 px-2">Price</th>
                <th className="py-2.5 px-2">Rating</th>
                <th className="py-2.5 px-2">Reviews</th>
                <th className="py-2.5 px-2">ASIN</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No products matched your criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((p, idx) => (
                  <tr
                    key={p.asin_sku || idx}
                    onClick={() => setSelectedProduct(p)}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-colors group"
                  >
                    <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>

                    <td className="py-2 px-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex items-center justify-center p-0.5">
                        {p.image_url || p.image ? (
                          <img
                            src={p.image_url || p.image}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400">N/A</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {p.product_name || p.title}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{p.brand}</span>
                        {p.discount_percent > 0 && (
                          <span className="text-emerald-600 font-semibold">
                            • {p.discount_percent}% off
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-2 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {p.price !== null ? `${currencySymbol}${p.price.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {p.rating ?? '—'}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-2 whitespace-nowrap text-slate-500">
                      {(p.review_count || p.reviews_count || 0).toLocaleString()}
                    </td>

                    <td className="py-2 px-2 whitespace-nowrap font-mono text-[10px] text-slate-500">
                      {p.asin_sku || p.asin || '—'}
                    </td>

                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(p);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
            <span className="text-slate-400 text-[11px]">
              Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Product Drawer */}
      <ProductDrawer
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
