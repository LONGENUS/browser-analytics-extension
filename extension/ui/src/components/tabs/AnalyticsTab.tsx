import React, { useState, useEffect, useRef } from 'react';
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
import { Globe, ShieldAlert, Sparkles, ExternalLink, Activity } from 'lucide-react';
import { FullDossier, BrowserTrafficData } from '../../types';
import { browserTrafficService } from '../../services/browserTraffic';

interface AnalyticsTabProps {
  dossier: FullDossier;
  isAnalyzing?: boolean;
}

const CHANNEL_COLORS: Record<string, string> = {
  Direct: '#2563EB',
  Search: '#10B981',
  'Organic Search': '#10B981',
  Social: '#F59E0B',
  Referral: '#8B5CF6',
  Mail: '#EC4899',
  Email: '#EC4899',
  Paid: '#06B6D4',
  Other: '#64748B',
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ dossier, isAnalyzing = false }) => {
  const [trafficData, setTrafficData] = useState<BrowserTrafficData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fetchedDomainRef = useRef<string>('');

  const domain = dossier?.domain || '';

  useEffect(() => {
    let isCancelled = false;

    async function loadTraffic(force = false) {
      if (!domain) {
        setIsLoading(false);
        setTrafficData(null);
        return;
      }

      // If already analyzing or forced, invalidate & fetch fresh
      setIsLoading(true);
      try {
        const data = await browserTrafficService.getTraffic(domain, force);
        if (!isCancelled) {
          setTrafficData(data);
          fetchedDomainRef.current = domain;
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('Browser Traffic load notice:', err);
          setTrafficData(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    // Refresh if domain changed or isAnalyzing became true
    const shouldForce = isAnalyzing;
    if (domain !== fetchedDomainRef.current || shouldForce) {
      loadTraffic(shouldForce);
    } else {
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [domain, isAnalyzing]);

  // --- STATE 1: LOADING (Stable skeleton cards, no layout shift or blinking) ---
  if (isLoading || isAnalyzing) {
    return (
      <div className="space-y-3 pb-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between px-1">
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-2.5 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>

        {/* 4 KPI Cards Skeleton */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2"
            >
              <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-2 w-14 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Channels & Countries Skeletons */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft space-y-3">
          <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-36 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft space-y-3">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-32 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
        </div>
      </div>
    );
  }

  // --- STATE 3: UNAVAILABLE (If no traffic data exists for the domain, show exact required copy) ---
  if (!trafficData || (!trafficData.monthlyVisits && (!trafficData.topCountries || trafficData.topCountries.length === 0))) {
    return (
      <div className="space-y-3 pb-8">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Browser Traffic
            </h2>
            <span className="text-[10px] text-slate-400">
              Telemetry Status: Unmetered
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {domain || 'Active Site'}
          </span>
        </div>

        {/* Unavailable Banner Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-soft text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Browser Traffic is not available for this domain yet.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Live telemetry is only displayed when verified analytics are configured. WebIntel strictly avoids synthetic or fake numbers.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-left text-xs space-y-2 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Domain:</span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">{domain || 'Active Website'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Status:</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">Unmetered</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Estimates:</span>
              <span className="font-mono text-slate-500">Disabled (Zero Fake Data)</span>
            </div>
          </div>
        </div>

        {/* Verified Telemetry Information */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-soft space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              How Browser Traffic Works
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Browser Traffic displays 100% privacy-compliant website metrics including monthly visits, visit durations, pages per visit, bounce rates, channels, and visitor geography without third-party cookie tracking.
          </p>
        </div>
      </div>
    );
  }

  // --- STATE 2: SUCCESS (Render live traffic data with all 7 metrics) ---
  const channelData = (trafficData.trafficChannels || []).map((c) => ({
    name: c.channel,
    value: c.share,
    color: CHANNEL_COLORS[c.channel] || '#64748B',
  }));

  const countryData = (trafficData.topCountries || []).map((c) => ({
    name: c.country,
    share: c.share,
    visits: c.visits,
  }));

  const topReferrers = trafficData.topReferrers || [];

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Browser Traffic
          </h2>
          <span className="text-[10px] text-slate-400">
            Source: Browser Traffic • Real-Time Telemetry
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          Live Data
        </span>
      </div>

      {/* 2. 4 Primary KPI Cards */}
      <div className="grid grid-cols-4 gap-2">
        {/* Metric 1: Monthly Visits */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Monthly Visits</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {formatNumber(trafficData.monthlyVisits)}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Total sessions</div>
        </div>

        {/* Metric 2: Visit Duration */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Visit Duration</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {formatDuration(trafficData.avgVisitDuration)}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Avg session time</div>
        </div>

        {/* Metric 3: Pages / Visit */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Pages / Visit</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {trafficData.pagesPerVisit !== null ? String(trafficData.pagesPerVisit) : '—'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Depth per user</div>
        </div>

        {/* Metric 4: Bounce Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Bounce Rate</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {trafficData.bounceRate !== null ? `${trafficData.bounceRate}%` : '—'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Exit frequency</div>
        </div>
      </div>

      {/* Metric 5: Traffic Channels */}
      {channelData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Traffic Channels
            </span>
            <span className="text-[10px] text-slate-400">Share of acquisition</span>
          </div>

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

          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {channelData.map((ch, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                {ch.name}: {ch.value}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metric 6: Top Countries */}
      {countryData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Top Countries
            </span>
            <span className="text-[10px] text-slate-400">Geographic distribution</span>
          </div>

          <div className="h-40 w-full">
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
                  formatter={(val: any) => [`${val}%`, 'Share']}
                />
                <Bar dataKey="share" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Metric 7: Top Referrers */}
      {topReferrers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Top Referrers
            </span>
            <span className="text-[10px] text-slate-400">Referring domains</span>
          </div>

          <div className="space-y-1.5">
            {topReferrers.map((ref, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                  {ref.referrer}
                </span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                  {formatNumber(ref.visits)} visits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
