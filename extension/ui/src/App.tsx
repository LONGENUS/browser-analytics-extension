import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Globe, Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { TabBar, TabKey } from './components/TabBar';
import { OverviewTab } from './components/tabs/OverviewTab';
import { ProductsTab } from './components/tabs/ProductsTab';
import { SeoTab } from './components/tabs/SeoTab';
import { TechStackTab } from './components/tabs/TechStackTab';
import { AnalyticsTab } from './components/tabs/AnalyticsTab';
import { AiInsightsTab } from './components/tabs/AiInsightsTab';
import { getActiveTab, analyzeWebsite, ActiveTabInfo } from './services/api';
import { browserTrafficService } from './services/browserTraffic';
import { FullDossier } from './types';

declare const chrome: any;

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

  // Active Tab navigation
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Active browser tab state
  const [currentTab, setCurrentTab] = useState<ActiveTabInfo | null>(null);

  // Analysis result & error state
  const [dossier, setDossier] = useState<FullDossier | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronization and request locks (to prevent infinite loops and duplicate requests)
  const isAnalyzingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastAnalyzedUrlRef = useRef<string>('');
  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Sync dark theme class on documentElement
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('webintel_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('webintel_theme', 'light');
    }
  }, [isDark]);

  /**
   * Executes a single analysis with concurrency lock and cancellation of any in-flight request.
   */
  const executeAnalysis = useCallback(
    async (url: string, title: string = '', forceRefresh: boolean = false) => {
      const cleanUrl = (url || '').trim();
      if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
        setError('Please navigate to an active website (HTTP/HTTPS) to analyze.');
        setIsLoading(false);
        return;
      }

      // Concurrency lock: prevent duplicate execution for the same URL unless forced
      if (isAnalyzingRef.current && cleanUrl === lastAnalyzedUrlRef.current && !forceRefresh) {
        return;
      }

      // Cancel previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      isAnalyzingRef.current = true;
      setIsLoading(true);
      setError(null);
      lastAnalyzedUrlRef.current = cleanUrl;

      try {
        const data = await analyzeWebsite(cleanUrl, title, forceRefresh, controller.signal);
        if (isMountedRef.current && abortControllerRef.current === controller) {
          setDossier(data);
          setError(null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'Analysis was cancelled') {
          return; // Silently exit on intentional abort
        }
        if (isMountedRef.current && abortControllerRef.current === controller) {
          console.error('Analysis error:', err);
          setError(err?.message || 'Failed to analyze page. Please try again.');
        }
      } finally {
        if (abortControllerRef.current === controller) {
          isAnalyzingRef.current = false;
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }
    },
    []
  );

  /**
   * Debounced click handler for the Analyze / Re-analyze button.
   */
  const handleRefreshClick = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      const tab = await getActiveTab();
      if (tab && tab.isValidHttp) {
        setCurrentTab(tab);
        if (tab.domain) {
          browserTrafficService.invalidate(tab.domain);
        }
        executeAnalysis(tab.url, tab.title, true);
      }
    }, 200);
  }, [executeAnalysis]);

  /**
   * Run once on mount: detect active tab and perform initial analysis.
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Initial tab query
    getActiveTab().then((tab) => {
      if (!isMountedRef.current) return;
      setCurrentTab(tab);
      if (tab.isValidHttp && lastAnalyzedUrlRef.current !== tab.url) {
        executeAnalysis(tab.url, tab.title, false);
      }
    });

    // Listen for tab switching in Chrome
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onActivated) {
      const handleActivated = async () => {
        const tab = await getActiveTab();
        if (!isMountedRef.current) return;
        setCurrentTab(tab);
        // Only trigger if switched to a different URL
        if (tab.isValidHttp && tab.url !== lastAnalyzedUrlRef.current) {
          executeAnalysis(tab.url, tab.title, false);
        }
      };

      chrome.tabs.onActivated.addListener(handleActivated);

      return () => {
        isMountedRef.current = false;
        chrome.tabs.onActivated.removeListener(handleActivated);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [executeAnalysis]);

  const handleToggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  const currencySymbol = dossier?.overview?.currency === 'INR' ? '₹' : '$';
  const productCount = dossier?.products?.length || 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center">
      {/* 420px - 480px Chrome Side Panel Container */}
      <div className="w-full max-w-[480px] min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col border-x border-slate-200/80 dark:border-slate-800 shadow-2xl relative">
        {/* Sticky Header */}
        <Header
          overview={dossier?.overview}
          activeTabInfo={currentTab}
          isLoading={isLoading}
          onRefresh={handleRefreshClick}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onClose={handleClose}
        />

        {/* Subtle top loading progress bar (non-blinking) */}
        {isLoading && (
          <div className="h-0.5 w-full bg-blue-100 dark:bg-blue-950 overflow-hidden shrink-0">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            />
          </div>
        )}

        {/* Sticky Horizontal Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          productCount={productCount}
        />

        {/* Main Content Area — Remains stable without remounting or blinking */}
        <main className="flex-1 p-3 overflow-y-auto">
          {/* Cold initial loading state (only before any data has loaded) */}
          {!dossier && isLoading && (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Analyzing {currentTab?.domain || 'website'}...
              </div>
              <p className="text-[11px] text-slate-400">
                Fetching live page elements, SEO metadata, and technologies.
              </p>
            </div>
          )}

          {/* Error State (only shown when no dossier is available) */}
          {!dossier && !isLoading && error && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-rose-200 dark:border-rose-900/40 shadow-soft text-center space-y-3 my-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Analysis Failed
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  {error}
                </p>
              </div>

              {currentTab?.isValidHttp && (
                <button
                  onClick={handleRefreshClick}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Analysis</span>
                </button>
              )}
            </div>
          )}

          {/* Unsupported Page State (e.g. chrome:// or blank) */}
          {!dossier && !isLoading && !error && !currentTab?.isValidHttp && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 shadow-soft text-center space-y-3 my-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Unsupported Page
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                WebIntel analyzes public web pages. Please switch or navigate to an active website (e.g., <strong>amazon.in</strong>, <strong>nike.com</strong>, <strong>github.com</strong>).
              </p>
            </div>
          )}

          {/* Active Dossier View (Keeps rendered tabs stable, updates in place) */}
          {dossier && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {activeTab === 'overview' && (
                  <OverviewTab
                    dossier={dossier}
                    onNavigateTab={setActiveTab}
                    onRefresh={handleRefreshClick}
                    isLoading={isLoading}
                  />
                )}

                {activeTab === 'products' && (
                  <ProductsTab
                    products={dossier.products || []}
                    currencySymbol={currencySymbol}
                    domain={dossier.domain}
                  />
                )}

                {activeTab === 'seo' && <SeoTab dossier={dossier} />}

                {activeTab === 'tech' && <TechStackTab dossier={dossier} />}

                {activeTab === 'analytics' && (
                  <AnalyticsTab dossier={dossier} isAnalyzing={isLoading} />
                )}

                {activeTab === 'insights' && <AiInsightsTab dossier={dossier} />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
};
