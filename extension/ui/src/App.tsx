import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { TabBar, TabKey } from './components/TabBar';
import { OverviewTab } from './components/tabs/OverviewTab';
import { ProductsTab } from './components/tabs/ProductsTab';
import { SeoTab } from './components/tabs/SeoTab';
import { TechStackTab } from './components/tabs/TechStackTab';
import { AnalyticsTab } from './components/tabs/AnalyticsTab';
import { AiInsightsTab } from './components/tabs/AiInsightsTab';
import { getCurrentTabUrl, analyzeWebsite, getMockDossier } from './services/api';
import { FullDossier } from './types';

export const App: React.FC = () => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('webintel_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Active Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Analysis data state
  const [dossier, setDossier] = useState<FullDossier>(() =>
    getMockDossier('https://www.amazon.in/s?k=Ravensburger+puzzle', 'Amazon.in : Ravensburger puzzle')
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync dark theme class on document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('webintel_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('webintel_theme', 'light');
    }
  }, [isDark]);

  // Initial load: detect active tab URL and analyze
  const loadActivePageAnalysis = async () => {
    setIsLoading(true);
    try {
      const tab = await getCurrentTabUrl();
      const data = await analyzeWebsite(tab.url, tab.title);
      setDossier(data);
    } catch (err) {
      console.error('Failed to load page analysis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivePageAnalysis();
  }, []);

  const handleToggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  const currencySymbol = dossier.overview?.currency === 'INR' ? '₹' : '$';
  const productCount = dossier.products?.length || 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center">
      {/* 420px - 480px Chrome Side Panel Container */}
      <div className="w-full max-w-[480px] min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col border-x border-slate-200/80 dark:border-slate-800 shadow-2xl relative">
        {/* Sticky Header */}
        <Header
          overview={dossier.overview}
          isLoading={isLoading}
          onRefresh={loadActivePageAnalysis}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onClose={handleClose}
        />

        {/* Sticky Horizontal Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          productCount={productCount}
        />

        {/* Main Scrollable Content Area */}
        <main className="flex-1 p-3 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  dossier={dossier}
                  onNavigateTab={setActiveTab}
                  onRefresh={loadActivePageAnalysis}
                  isLoading={isLoading}
                />
              )}

              {activeTab === 'products' && (
                <ProductsTab
                  products={dossier.products}
                  currencySymbol={currencySymbol}
                  domain={dossier.domain}
                />
              )}

              {activeTab === 'seo' && <SeoTab dossier={dossier} />}

              {activeTab === 'tech' && <TechStackTab dossier={dossier} />}

              {activeTab === 'analytics' && <AnalyticsTab dossier={dossier} />}

              {activeTab === 'insights' && <AiInsightsTab dossier={dossier} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
