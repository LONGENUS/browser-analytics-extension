import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Star, ExternalLink, ShieldCheck, TrendingDown, Tag } from 'lucide-react';
import { ProductItem } from '../../types';

interface ProductDrawerProps {
  product: ProductItem | null;
  onClose: () => void;
  currencySymbol?: string;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({
  product,
  onClose,
  currencySymbol = '$',
}) => {
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const handleCopyAsin = () => {
    if (product.asin_sku || product.asin) {
      navigator.clipboard.writeText(product.asin_sku || product.asin || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const discount = product.discount_percent || 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Slide-over Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="absolute inset-y-0 right-0 max-w-full flex pl-10 w-full max-w-md"
        >
          <div className="w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Product Intelligence
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Product Large Image */}
              <div className="w-full h-52 bg-slate-100 dark:bg-slate-800/60 rounded-xl overflow-hidden flex items-center justify-center p-3 border border-slate-200/80 dark:border-slate-700/80">
                {product.image_url || product.image ? (
                  <img
                    src={product.image_url || product.image}
                    alt={product.product_name}
                    className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                ) : (
                  <Tag className="w-12 h-12 text-slate-400" />
                )}
              </div>

              {/* Title & Brand */}
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                  {product.brand || 'Brand'}
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                  {product.product_name || product.title}
                </h2>
              </div>

              {/* Pricing & Discount */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {product.price !== null ? `${currencySymbol}${product.price.toLocaleString()}` : 'N/A'}
                  </span>
                  {product.original_price && product.original_price > (product.price || 0) && (
                    <span className="text-xs text-slate-400 line-through">
                      {currencySymbol}{product.original_price.toLocaleString()}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
                      <TrendingDown className="w-2.5 h-2.5" />
                      {discount}% OFF
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    {product.availability || 'In Stock'}
                  </span>
                  <span>•</span>
                  <span>{product.prime_shipping || product.shipping || 'Standard Shipping'}</span>
                </div>
              </div>

              {/* Ratings & Reviews */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-medium">Customer Rating</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {product.rating ?? 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-400">/ 5.0</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-medium">Total Reviews</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {(product.review_count || product.reviews_count || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* ASIN / SKU Identifier */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">ASIN / SKU</span>
                  <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {product.asin_sku || product.asin || 'N/A'}
                  </div>
                </div>
                {(product.asin_sku || product.asin) && (
                  <button
                    onClick={handleCopyAsin}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-soft"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {/* Price History Placeholder */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Price History (30 Days)</span>
                <div className="h-16 flex items-end gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {[60, 65, 60, 55, 58, 62, 50, 48, 48, 52, 45].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500/80 hover:bg-blue-600 rounded-t transition-all"
                      style={{ height: `${h}%` }}
                      title={`Day ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Lowest: {currencySymbol}{(product.price ? product.price * 0.9 : 0).toFixed(0)}</span>
                  <span>Highest: {currencySymbol}{(product.original_price || (product.price || 0) * 1.2).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <a
                href={product.product_url || product.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all"
              >
                <span>Open Product Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
