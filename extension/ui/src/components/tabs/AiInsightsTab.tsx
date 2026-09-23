import React from 'react';
import { Sparkles, Clock, Lock, ArrowRight, Zap, Target, BarChart2 } from 'lucide-react';
import { FullDossier } from '../../types';

interface AiInsightsTabProps {
  dossier: FullDossier | null;
}

export const AiInsightsTab: React.FC<AiInsightsTabProps> = ({ dossier }) => {
  const domain = dossier?.domain || 'this website';

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Coming Soon Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 text-white shadow-xl">
        {/* Subtle decorative circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-purple-500/20 blur-xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">
              <Clock className="w-3 h-3" /> Coming Soon
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          <h2 className="text-base font-bold tracking-tight text-white mb-1.5">
            AI Strategic Intelligence
          </h2>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            Autonomous multi-modal intelligence for <strong className="text-white">{domain}</strong> is currently in development. High-fidelity predictive market modeling and competitive gap audits will be available in the next release.
          </p>
        </div>
      </div>

      {/* 2. Upcoming Capabilities Roadmap */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Roadmap Capabilities
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">v2.1 Feature Set</span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
            <div className="p-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                Predictive Pricing & Elasticity
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                AI price-point simulation analyzing historical margin, competitor indexing, and customer willingness to pay.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
            <div className="p-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                SERP & Search Term Gap Audit
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Uncovers high-volume, low-competition keywords where competitors are capturing search traffic.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
            <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                Competitive Moat & Vulnerability Radar
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Synthesizes supply-chain vulnerabilities, pricing shifts, and customer sentiment signals into executive actions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Status Notification */}
      <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          This feature is currently disabled and undergoing final model fine-tuning.
        </p>
      </div>
    </div>
  );
};
