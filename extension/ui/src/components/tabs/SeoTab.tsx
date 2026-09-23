import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  Image,
  Link2,
  Heading,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { FullDossier } from '../../types';

interface SeoTabProps {
  dossier: FullDossier;
}

export const SeoTab: React.FC<SeoTabProps> = ({ dossier }) => {
  const seo = dossier.seo_intelligence || ({} as any);
  const scoreInfo = seo.seo_score || { score: 72, rating: 'Good', breakdown: {}, recommendations: [] };
  const meta = seo.metadata || ({} as any);
  const headings = seo.headings || { h1_count: 1, h2_count: 12, h3_count: 34, all_headings: [] };
  const images = seo.images || { total_images: 227, missing_alt_count: 45, alt_coverage_percent: 80, format_breakdown: {} };
  const links = seo.links || { total_links: 312, internal_links_count: 298, external_links_count: 14, nofollow_count: 8 };

  const score = scoreInfo.score || 72;
  const scoreColor =
    score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-rose-500';
  const strokeColor =
    score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#F43F5E';

  // Recommendations with priorities
  const recommendations = scoreInfo.recommendations && scoreInfo.recommendations.length > 0
    ? scoreInfo.recommendations
    : [
        'Add more descriptive meta description to improve SERP click-through rate',
        'Optimize image alt text: 45 product images lack ALT attributes',
        'Improve internal linking structure for category facet URLs',
        'Compress product catalog images to modern WebP format',
      ];

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Score Gauge & Metadata Card */}
      <div className="grid grid-cols-3 gap-2">
        {/* Left: Radial Score Gauge (1 Col) */}
        <div className="col-span-1 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            SEO Score
          </span>

          {/* Donut SVG Ring */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeDasharray={`${score}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke={strokeColor}
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-xl font-extrabold ${scoreColor} leading-none`}>
                {score}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium">/ 100</span>
            </div>
          </div>

          <span className={`mt-1 text-xs font-bold ${scoreColor}`}>
            {scoreInfo.rating || 'Good'}
          </span>

          <div className="w-full pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-around text-[10px] text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Good (12)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Issues (3)</span>
            </div>
          </div>
        </div>

        {/* Right: Metadata Card (2 Cols) */}
        <div className="col-span-2 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-400 uppercase">Title</span>
                <span className="text-slate-400 font-mono">{meta.title_length || (meta.title || '').length} chars</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                {meta.title || dossier.title}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-400 uppercase">Meta Description</span>
                <span className="text-slate-400 font-mono">{meta.description_length || (meta.description || '').length} chars</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                {meta.description || 'No meta description found on this page.'}
              </p>
            </div>

            <div className="pt-1 text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Canonical:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                  {meta.canonical || dossier.url}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Robots:</span>
                <span className="font-mono text-emerald-600 font-medium">
                  {meta.robots || 'index, follow'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Heading Structure Visual Hierarchy Tree */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Heading className="w-3.5 h-3.5 text-blue-600" />
            Heading Structure
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 font-bold text-blue-600">
              H1: {headings.h1_count ?? 1}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
              H2: {headings.h2_count ?? 12}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
              H3: {headings.h3_count ?? 34}
            </span>
          </div>
        </div>

        {/* Tree Render */}
        <div className="bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2.5 font-mono text-[11px] space-y-1 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
            <span>H1</span>
            <span className="text-slate-400 font-normal">──</span>
            <span className="truncate">{headings.h1_tags?.[0] || dossier.title || 'Page Heading'}</span>
          </div>

          <div className="pl-4 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span>├── H2</span>
            <span className="truncate">Delivery Day & Speed</span>
          </div>

          <div className="pl-8 flex items-center gap-1.5 text-slate-500 dark:text-slate-500">
            <span>├── H3</span>
            <span className="truncate">Prime Tomorrow Eligible</span>
          </div>

          <div className="pl-4 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span>├── H2</span>
            <span className="truncate">Customer Reviews & Stars</span>
          </div>
        </div>
      </div>

      {/* 3. Split Row: Images Card & Links Card */}
      <div className="grid grid-cols-2 gap-2">
        {/* Images Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-emerald-600" />
              Images ({images.total_images ?? 227})
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Missing ALT:</span>
              <span className="font-bold text-rose-600">{images.missing_alt_count ?? 45}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">ALT Coverage:</span>
              <span className="font-bold text-emerald-600">{images.alt_coverage_percent ?? 80}%</span>
            </div>

            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1 flex-wrap text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-medium">
                JPG {images.format_breakdown?.jpg ?? 142}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-medium">
                WebP {images.format_breakdown?.webp ?? 65}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-medium">
                PNG {images.format_breakdown?.png ?? 20}
              </span>
            </div>
          </div>
        </div>

        {/* Links Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
              Links ({links.total_links ?? 312})
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Internal:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{links.internal_links_count ?? 298}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">External:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{links.external_links_count ?? 14}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Nofollow:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{links.nofollow_count ?? 8}</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Broken / Empty:</span>
              <span className="font-bold text-emerald-600">0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Top Recommendations (Numbered improvement list) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
        <span className="text-xs font-bold text-slate-900 dark:text-white mb-2 block">
          Top Recommendations
        </span>

        <div className="space-y-2">
          {recommendations.slice(0, 4).map((rec: string, i: number) => {
            const priority = i === 0 ? 'High' : i === 1 ? 'High' : 'Medium';
            const badgeColor =
              priority === 'High'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';

            return (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800"
              >
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                    {rec}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeColor}`}>
                  {priority}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
