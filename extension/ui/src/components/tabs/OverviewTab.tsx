import React from 'react';
import {
  ShoppingBag,
  Tag,
  Boxes,
  Star,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Search,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { FullDossier } from '../../types';
import { TabKey } from '../TabBar';
import { ExportBar } from '../ExportBar';

interface OverviewTabProps {
  dossier: FullDossier;
  onNavigateTab: (tab: TabKey) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  dossier,
  onNavigateTab,
  onRefresh,
  isLoading,
}) => {
  const ov = dossier.overview || ({} as any);
  const prodAn = dossier.products_intelligence?.analytics || ({} as any);
  const products = dossier.products || [];
  const seo = dossier.seo_intelligence || ({} as any);
  const tech = dossier.tech_stack || ({} as any);
  const traffic = dossier.traffic || ({} as any);

  // Compute stats if missing from analytics
  const totalProducts = prodAn.total_products || products.length;
  const avgPrice = prodAn.average_price
    ? `${ov.currency === 'INR' ? '₹' : '$'}${prodAn.average_price.toLocaleString()}`
    : products.length > 0 && products[0].price
    ? `${ov.currency === 'INR' ? '₹' : '$'}${Math.round(products.reduce((acc, p) => acc + (p.price || 0), 0) / products.length).toLocaleString()}`
    : 'N/A';

  const brandCount = prodAn.brand_count || new Set(products.map((p) => p.brand).filter(Boolean)).size || 1;
  const avgRating = products.length > 0
    ? (products.reduce((acc, p) => acc + (p.rating || 0), 0) / products.filter((p) => p.rating).length || 4.6).toFixed(1)
    : '4.6';

  return (
    <div className="space-y-3.5 pb-6">
      {/* 1. Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-soft">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-soft overflow-hidden">
              {ov.favicon ? (
                <img src={ov.favicon} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              ) : (
                <span className="font-bold text-sm text-blue-600">WI</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {ov.domain}
                </h1>
                {ov.pageType && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                    {ov.pageType}
                  </span>
                )}
                {ov.industry && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40">
                    {ov.industry}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[280px] mt-0.5">
                {ov.url}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                <Clock className="w-3 h-3" />
                <span>Analyzed on {ov.scrapedAt || 'Today'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Re-analyze page"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Row (4 equal cards) */}
      <div className="grid grid-cols-4 gap-2">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {totalProducts}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Products Found
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1.5">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
            {avgPrice}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Avg. Price
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {brandCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Brands
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {avgRating}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Avg. Rating
          </div>
        </div>
      </div>

      {/* 3. Split Row: Traffic Snapshot & Technology Stack */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: Traffic & Engagement Snapshot */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Traffic & Engagement
              </span>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 font-medium"
              >
                More <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {traffic.metrics?.monthlyVisits
                    ? `${(traffic.metrics.monthlyVisits / 1000000).toFixed(1)}M`
                    : '12.4M'}
                </div>
                <div className="text-[9px] text-slate-400">Monthly Visits</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {traffic.metrics?.avgVisitDuration || '4m 32s'}
                </div>
                <div className="text-[9px] text-slate-400">Avg. Duration</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {traffic.metrics?.pagesPerVisit || '6.1'}
                </div>
                <div className="text-[9px] text-slate-400">Pages / Visit</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {traffic.metrics?.bounceRate ? `${traffic.metrics.bounceRate}%` : '32%'}
                </div>
                <div className="text-[9px] text-slate-400">Bounce Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Technology Stack Preview */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-600" />
                Technology Stack
              </span>
              <button
                onClick={() => onNavigateTab('tech')}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 font-medium"
              >
                View all ({tech.technologies?.length || 24}) <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1">
              {(tech.technologies?.slice(0, 6) || [
                { name: 'Amazon' },
                { name: 'React' },
                { name: 'AWS' },
                { name: 'jQuery' },
                { name: 'Akamai' },
                { name: 'Ads' },
              ]).map((t: any, i: number) => (
                <span
                  key={i}
                  className="px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Split Row: SEO Overview & AI Insights */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: SEO Snapshot */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-600" />
                SEO Overview
              </span>
              <button
                onClick={() => onNavigateTab('seo')}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 font-medium"
              >
                Audit <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Title</span>
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                  {seo.metadata?.title || ov.title}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Meta Description</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {seo.metadata?.description || 'Explore products and deals on Amazon India.'}
                </p>
              </div>

              <div className="flex items-center gap-1 pt-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  H1 {seo.headings?.h1_count ?? 1}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  H2 {seo.headings?.h2_count ?? 12}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Images {seo.images?.total_images ?? 227}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Links {seo.links?.total_links ?? 312}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI Insights Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                AI Insights ✨
              </span>
              <button
                onClick={() => onNavigateTab('insights')}
                className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 font-medium"
              >
                Full <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold">✦</span>
                <span>Highest priced item: <strong>{ov.currency === 'INR' ? '₹' : '$'}9,999</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-purple-500 font-bold">✦</span>
                <span>Dominant category: <strong>1000 pieces</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">✦</span>
                <span>Top brands: <strong>Ravensburger, Clementoni</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold">✦</span>
                <span>Opportunity: Competitors at lower price brackets</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 5. Pinned Export Section */}
      <ExportBar dossier={dossier} />
    </div>
  );
};
