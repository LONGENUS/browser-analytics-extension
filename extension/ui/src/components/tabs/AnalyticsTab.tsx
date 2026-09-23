import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TrendingUp, Users, Clock, BookOpen, Percent, Calendar } from 'lucide-react';
import { FullDossier } from '../../types';

interface AnalyticsTabProps {
  dossier: FullDossier;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ dossier }) => {
  const [timeRange, setTimeRange] = useState('6 Months');

  const traffic = dossier.traffic || ({} as any);
  const metrics = traffic.metrics || {
    monthlyVisits: 12400000,
    avgVisitDuration: '4m 32s',
    pagesPerVisit: 6.1,
    bounceRate: 32.4,
  };

  // Mock Trend Data for 6 Months (April to September)
  const trafficTrendData = [
    { month: 'Apr', visits: 9.8 },
    { month: 'May', visits: 10.4 },
    { month: 'Jun', visits: 11.2 },
    { month: 'Jul', visits: 10.9 },
    { month: 'Aug', visits: 11.8 },
    { month: 'Sep', visits: 12.4 },
  ];

  // Traffic Channels Donut Data
  const channelData = [
    { name: 'Direct', value: 48.2, color: '#2563EB' },
    { name: 'Organic Search', value: 38.6, color: '#10B981' },
    { name: 'Referral', value: 7.2, color: '#8B5CF6' },
    { name: 'Social', value: 4.1, color: '#F59E0B' },
    { name: 'Mail', value: 1.9, color: '#EC4899' },
  ];

  // Top Countries Data
  const countryData = (traffic.topCountries && traffic.topCountries.length > 0
    ? traffic.topCountries
    : [
        { country: 'India', share: 88.4 },
        { country: 'United States', share: 4.2 },
        { country: 'UAE', share: 2.1 },
        { country: 'United Kingdom', share: 1.8 },
        { country: 'Canada', share: 1.2 },
      ]
  ).map((c: any) => ({ name: c.country, share: c.share }));

  // Device Split Data
  const deviceData = [
    { name: 'Mobile', value: 68, color: '#3B82F6' },
    { name: 'Desktop', value: 28, color: '#10B981' },
    { name: 'Tablet', value: 4, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Traffic & Audience Intelligence
          </h2>
          <span className="text-[10px] text-slate-400">
            Source: {traffic.source || 'Similarweb Public Estimates'}
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
            {metrics.monthlyVisits ? `${(metrics.monthlyVisits / 1000000).toFixed(1)}M` : '12.4M'}
          </div>
          <div className="text-[9px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-0.5">
            <TrendingUp className="w-2.5 h-2.5" /> +5.2%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Avg. Duration</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {metrics.avgVisitDuration || '4m 32s'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Session time</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Pages / Visit</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {metrics.pagesPerVisit || '6.1'}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Page views</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="text-[10px] text-slate-400 font-medium">Bounce Rate</div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            {metrics.bounceRate ? `${metrics.bounceRate}%` : '32.4%'}
          </div>
          <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">Low</div>
        </div>
      </div>

      {/* 3. Monthly Traffic Line/Area Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Traffic Trend (Millions)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Apr — Sep 2026</span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} domain={[8, 14]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
                formatter={(val: any) => [`${val}M Visits`, 'Traffic']}
              />
              <Area
                type="monotone"
                dataKey="visits"
                stroke="#2563EB"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#trafficGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Split Row: Traffic Channels Donut & Device Split */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: Channels Donut */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white mb-1">
            Traffic Channels
          </span>

          <div className="h-32 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: '#fff',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Share']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600 dark:text-slate-400 pt-1">
            {channelData.slice(0, 4).map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="truncate">{c.name}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 ml-auto">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Device Split */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white mb-1">
            Device Split
          </span>

          <div className="h-32 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: '#fff',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Share']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around text-[10px] text-slate-600 dark:text-slate-400 pt-1">
            {deviceData.map((d) => (
              <div key={d.name} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.name} {d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Top Countries Horizontal Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
        <span className="text-xs font-bold text-slate-900 dark:text-white mb-2 block">
          Geography & Country Share
        </span>

        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={countryData}
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={85}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fff',
                }}
                formatter={(val: any) => [`${val}%`, 'Traffic Share']}
              />
              <Bar dataKey="share" fill="#3B82F6" radius={[0, 6, 6, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Traffic Sources Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-soft overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Traffic Sources Breakdown
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 uppercase font-semibold">
              <th className="py-2 px-3">Channel</th>
              <th className="py-2 px-3">Traffic Share</th>
              <th className="py-2 px-3">Bounce Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr>
              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Direct</td>
              <td className="py-2 px-3 font-bold text-blue-600">48.2%</td>
              <td className="py-2 px-3 text-slate-500">28.4%</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Organic Search</td>
              <td className="py-2 px-3 font-bold text-emerald-600">38.6%</td>
              <td className="py-2 px-3 text-slate-500">34.1%</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Referral</td>
              <td className="py-2 px-3 font-bold text-purple-600">7.2%</td>
              <td className="py-2 px-3 text-slate-500">39.0%</td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">Social</td>
              <td className="py-2 px-3 font-bold text-amber-600">4.1%</td>
              <td className="py-2 px-3 text-slate-500">52.3%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
