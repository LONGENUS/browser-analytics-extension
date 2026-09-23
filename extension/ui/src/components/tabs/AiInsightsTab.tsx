import React from 'react';
import { Sparkles, TrendingUp, Lightbulb, Compass, Target, ArrowUpRight } from 'lucide-react';
import { FullDossier } from '../../types';

interface AiInsightsTabProps {
  dossier: FullDossier;
}

export const AiInsightsTab: React.FC<AiInsightsTabProps> = ({ dossier }) => {
  const summary =
    dossier.summary ||
    'This is a leading e-commerce category on Amazon India featuring Ravensburger jigsaw puzzles with over 227 products, high ratings, and consistent customer demand.';

  return (
    <div className="space-y-3 pb-8">
      {/* 1. AI Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-900/60 rounded-xl p-3.5 border border-blue-100 dark:border-blue-900/40 shadow-soft">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            AI Executive Summary
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
          {summary}
        </p>
      </div>

      {/* 2. Key Insights Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2.5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Key Insights
          </h3>
        </div>

        <ul className="space-y-2 text-xs">
          <li className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
            <span className="text-purple-600 font-bold shrink-0">✦</span>
            <div className="text-slate-700 dark:text-slate-300">
              <strong>Highest priced product:</strong> ₹9,999 (Collector's 5000 Piece Edition)
            </div>
          </li>

          <li className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
            <span className="text-blue-600 font-bold shrink-0">✦</span>
            <div className="text-slate-700 dark:text-slate-300">
              <strong>Dominant category piece count:</strong> 1000 pieces represents 48% of total catalog listings
            </div>
          </li>

          <li className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
            <span className="text-emerald-600 font-bold shrink-0">✦</span>
            <div className="text-slate-700 dark:text-slate-300">
              <strong>Market leadership:</strong> Ravensburger, Clementoni, and Trefl account for 85% of reviews
            </div>
          </li>

          <li className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
            <span className="text-amber-600 font-bold shrink-0">✦</span>
            <div className="text-slate-700 dark:text-slate-300">
              <strong>Price range density:</strong> Sweet spot is ₹1,299 – ₹2,499 with Prime 1-day delivery
            </div>
          </li>

          <li className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
            <span className="text-rose-600 font-bold shrink-0">✦</span>
            <div className="text-slate-700 dark:text-slate-300">
              <strong>Stock velocity:</strong> 12% of high-rated puzzles currently low on inventory
            </div>
          </li>
        </ul>
      </div>

      {/* 3. Strategic Market Opportunities */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2.5">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Growth & Competitive Opportunities
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200">
            <div className="font-bold flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> High Demand Surge
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              Demand for adult educational and architectural landscape puzzles grew +34% QoQ.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
            <div className="font-bold flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Keyword Gaps
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-300">
              Opportunity to target long-tail search terms like "wooden puzzle 1000 piece" and "panoramic jigsaw".
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 text-purple-900 dark:text-purple-200">
            <div className="font-bold flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Bundle Potential
            </div>
            <p className="text-[11px] text-purple-800 dark:text-purple-300">
              High cross-sell affinity with puzzle roll-up mats and framing accessories.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
