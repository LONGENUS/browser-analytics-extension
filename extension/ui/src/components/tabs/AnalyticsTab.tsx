import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Calendar, Globe, PlugZap, ShieldCheck, Sparkles } from 'lucide-react';
import { FullDossier } from '../../types';

interface AnalyticsTabProps {
  dossier: FullDossier;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ dossier }) => {
  const [timeRange, setTimeRange] = useState('6 Months');

  const traffic = dossier.traffic || ({} as any);
  const metrics = traffic.metrics;
  const isProviderConnected = Boolean(
    metrics &&
      typeof metrics.monthlyVisits === 'number' &&
      metrics.monthlyVisits > 0 &&
      traffic.source &&
      !traffic.source.toLowerCase().includes('unavailable')
  );

  // Channels Donut Data (if provided by connected live provider)
  const channelData = traffic.channels
    ? [
        { name: 'Direct', value: traffic.channels.direct || 0, color: '#2563EB' },
        { name: 'Organic Search', value: traffic.channels.organicSearch || 0, color: '#10B981' },
        { name: 'Referral', value: traffic.channels.referral || 0, color: '#8B5CF6' },
        { name: 'Social', value: traffic.channels.social || 0, color: '#F59E0B' },
        { name: 'Mail', value: traffic.channels.mail || 0, color: '#EC4899' },
      ].filter((c) => c.value > 0)
    : [];

  // Top Countries Data (if provided by connected live provider)
  const countryData = Array.isArray(traffic.topCountries)
    ? traffic.topCountries.map((c: any) => ({ name: c.country, share: c.share }))
    : [];

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Traffic & Audience Intelligence
          </h2>
          <span className="text-[10px] text-slate-400">
            Source: {isProviderConnected ? traffic.source : 'Unmetered (No provider connected)'}
          </span>
        </div>

        {isProviderConnected && (
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800 text-xs">
            <Calendar className="w-3 h-3 text-slate-400 ml-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="30 Days">Last 30 Days</option>
              <option value="6 Months">Last 6 Months</option>
              <option value="12 Months">Last 12 Months</option>
            </select>
          </div>
        )}
      </div>

      {/* 2. DUAL STATE RENDER: State B (Provider Connected) vs State A (No Provider / Coming Soon) */}
      {isProviderConnected ? (
        <>
          {/* State B: Real Provider Connected KPIs */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-[10px] text-slate-400 font-medium">Monthly Visits</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {metrics?.monthlyVisits
                  ? `${(metrics.monthlyVisits / 1000000).toFixed(1)}M`
                  : '—'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Audience size</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-[10px] text-slate-400 font-medium">Avg. Duration</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {metrics?.avgVisitDuration || '—'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Session time</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-[10px] text-slate-400 font-medium">Pages / Visit</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {metrics?.pagesPerVisit ? String(metrics.pagesPerVisit) : '—'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Engagement depth</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
              <div className="text-[10px] text-slate-400 font-medium">Bounce Rate</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {metrics?.bounceRate ? `${metrics.bounceRate}%` : '—'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Exit frequency</div>
            </div>
          </div>

          {/* Acquisition Channels */}
          {channelData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
              <span className="text-xs font-bold text-slate-900 dark:text-white block mb-2">
                Acquisition Channels
              </span>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#FFF',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Countries */}
          {countryData.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
              <span className="text-xs font-bold text-slate-900 dark:text-white block mb-2">
                Top Countries
              </span>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#FFF',
                        fontSize: '11px',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Traffic Share']}
                    />
                    <Bar dataKey="share" fill="#2563EB" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : (
        /* State A: No Provider Configured — Honest & Clean Coming Soon State */
        <div className="space-y-3">
          {/* Main Unmetered Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-soft text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                Coming Soon
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Traffic analytics unavailable. (Coming soon)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Connect Similarweb, Tranco, or another provider later.
              </p>
            </div>

            {/* Provider Integration Status */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Domain:</span>
                <span className="font-mono text-slate-900 dark:text-white font-bold">{dossier.domain || 'Active Website'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Provider Status:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">No Provider Configured</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Telemetry Data:</span>
                <span className="font-mono text-slate-500">Zero Synthetic / Unmetered</span>
              </div>
            </div>
          </div>

          {/* Integration Roadmap Previews */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Supported Providers Roadmap
            </span>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                  S
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Similarweb Enterprise</div>
                  <div className="text-[10px] text-slate-400">Monthly traffic, bounce rates, visit durations</div>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                Coming Soon
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                  T
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Tranco Global Ranking</div>
                  <div className="text-[10px] text-slate-400">Verified top 1M domains global rank & reach</div>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
