import React from 'react';
import { motion } from 'framer-motion';

export type TabKey = 'overview' | 'products' | 'seo' | 'tech' | 'analytics' | 'insights';

interface TabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  productCount: number;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, productCount }) => {
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'products', label: 'Products', badge: productCount },
    { key: 'seo', label: 'SEO' },
    { key: 'tech', label: 'Tech Stack' },
    { key: 'analytics', label: 'Browser Traffic' },
    { key: 'insights', label: 'AI Insights' },
  ];

  return (
    <nav className="sticky top-[93px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-3 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1 min-w-max py-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors select-none flex items-center gap-1.5 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBadge"
                  className="absolute inset-0 bg-blue-50 dark:bg-blue-950/40 rounded-lg -z-10 border border-blue-200/60 dark:border-blue-800/40"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
