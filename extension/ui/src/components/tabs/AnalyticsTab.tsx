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
import { TrendingUp, Users, Clock, BookOpen, Percent, Calendar, ShieldAlert, Globe } from 'lucide-react';
import { FullDossier } from '../../types';

interface AnalyticsTabProps {
  dossier: FullDossier;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ dossier }) => {
  const [timeRange, setTimeRange] = useState('6 Months');

  const traffic = dossier.traffic || ({} as any);
  const metrics = traffic.metrics;
  const isMetered = Boolean(metrics && metrics.monthlyVisits);

  // Channels Donut Data (if provided by live backend)
  const channelData = traffic.channels
    ? [
        { name: 'Direct', value: traffic.channels.direct || 0, color: '#2563EB' },
        { name: 'Organic Search', value: traffic.channels.organicSearch || 0, color: '#10B981' },
        { name: 'Referral', value: traffic.channels.referral || 0, color: '#8B5CF6' },
        { name: 'Social', value: traffic.channels.social || 0, color: '#F59E0B' },
        { name: 'Mail', value: traffic.channels.mail || 0, color: '#EC4899' },
      ].filter((c) => c.value > 0)
    : [];

  // Top Countries Data (if provided by live backend)
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
            Source: {traffic.source || 'Unavailable (Unmetered)'}
          </span>
        </div>

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
      </div>

      {/* 2. KPI Row (4 Cards) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Monthly Visits</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {metrics?.monthlyVisits
              ? `${(metrics.monthlyVisits / 1000000).toFixed(1)}M`
              : '—'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            {isMetered ? 'Audience size' : 'Unmetered'}
          </div>
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

      {/* 3. Live Charts or Unmetered Notice */}
      {isMetered ? (
        <>
          {/* Charts if data available */}
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
        /* Honest Unmetered Telemetry State */
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-soft text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Traffic Telemetry Unmetered
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Global audience metrics for <strong className="text-slate-700 dark:text-slate-200">{dossier.domain || 'this website'}</strong> require an external telemetry provider integration (e.g., Similarweb Enterprise or SEMrush).
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-left text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Provider Status:</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">Unmetered / Standby</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Telemetry Data Source:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">Unavailable</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
