/* ========================================
   WebIntel — Popup Main Script
   ======================================== */

(() => {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    API_BASE: (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.API_BASE_URL : 'http://localhost:8000'),
    ITEMS_PER_PAGE: 10,
    MAX_HISTORY: 50,
    CACHE_TTL_MS: 3600000 // 1 hour
  };

  // --- State ---
  const state = {
    currentTab: null,
    analysisResult: null,
    currentPage: 1,
    totalPages: 1,
    isAnalyzing: false,
    showHistory: false
  };

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Site info
    siteFavicon: $('#site-favicon'),
    siteTitle: $('#site-title'),
    siteUrl: $('#site-url'),
    siteMetaRow: $('#site-meta-row'),
    siteDomain: $('#site-domain'),
    siteType: $('#site-type'),
    // Buttons
    btnAnalyze: $('#btn-analyze'),
    btnHistory: $('#btn-history'),
    btnRetry: $('#btn-retry'),
    btnExportCsv: $('#btn-export-csv'),
    btnExportXlsx: $('#btn-export-xlsx'),
    btnExportJson: $('#btn-export-json'),
    btnCloseHistory: $('#btn-close-history'),
    btnPrevPage: $('#btn-prev-page'),
    btnNextPage: $('#btn-next-page'),
    // Sections
    loadingState: $('#loading-state'),
    errorState: $('#error-state'),
    resultsDashboard: $('#results-dashboard'),
    historyPanel: $('#history-panel'),
    analyzeHint: $('#analyze-hint'),
    // Loading steps
    stepCrawl: $('#step-crawl'),
    stepExtract: $('#step-extract'),
    stepAnalyze: $('#step-analyze'),
    stepSummary: $('#step-summary'),
    // Results
    aiSummaryText: $('#ai-summary-text'),
    kpiProducts: $('#kpi-products'),
    kpiAvgPrice: $('#kpi-avg-price'),
    kpiBrands: $('#kpi-brands'),
    kpiAvgRating: $('#kpi-avg-rating'),
    priceRangeFill: $('#price-range-fill'),
    priceMin: $('#price-min'),
    priceMedian: $('#price-median'),
    priceMax: $('#price-max'),
    brandsList: $('#brands-list'),
    seoGrid: $('#seo-grid'),
    productTableBody: $('#product-table-body'),
    productCountBadge: $('#product-count-badge'),
    pageInfo: $('#page-info'),
    // Error
    errorMessage: $('#error-message'),
    // History
    historyList: $('#history-list'),
    // Footer
    analysesCount: $('#analyses-count')
  };

  // --- Initialize ---
  async function init() {
    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.getBaseUrl) {
      try {
        CONFIG.API_BASE = await APP_CONFIG.getBaseUrl();
      } catch (_) {}
    }
    detectCurrentTab();
    loadAnalysesCount();
    bindEvents();
  }

  // --- Tab Detection ---
  async function detectCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      state.currentTab = tab;
      const url = new URL(tab.url || '');

      // Set site info
      dom.siteTitle.textContent = tab.title || 'Untitled Page';
      dom.siteUrl.textContent = tab.url;
      dom.siteDomain.textContent = url.hostname;

      // Favicon
      if (tab.favIconUrl) {
        dom.siteFavicon.src = tab.favIconUrl;
        dom.siteFavicon.style.display = 'block';
      }

      // Detect site type
      const siteType = detectSiteType(url.hostname);
      dom.siteType.textContent = siteType;
      dom.siteMetaRow.style.display = 'flex';

      // Check for cached results
      const cached = await getCachedAnalysis(tab.url);
      if (cached) {
        showResults(cached);
      }
    } catch (err) {
      console.error('Tab detection failed:', err);
      dom.siteTitle.textContent = 'Unable to detect page';
    }
  }

  function detectSiteType(hostname) {
    const types = {
      'amazon': 'E-Commerce',
      'flipkart': 'E-Commerce',
      'shopify': 'E-Commerce',
      'ebay': 'E-Commerce',
      'myntra': 'E-Commerce',
      'linkedin': 'Professional',
      'github': 'Developer',
      'wikipedia': 'Knowledge',
      'youtube': 'Video',
      'reddit': 'Forum',
      'twitter': 'Social',
      'x.com': 'Social',
      'medium': 'Blog',
      'news': 'News'
    };

    for (const [key, type] of Object.entries(types)) {
      if (hostname.includes(key)) return type;
    }
    return 'Website';
  }

  // --- Event Binding ---
  function bindEvents() {
    dom.btnAnalyze.addEventListener('click', handleAnalyze);
    dom.btnRetry.addEventListener('click', handleAnalyze);
    dom.btnHistory.addEventListener('click', toggleHistory);
    dom.btnCloseHistory.addEventListener('click', toggleHistory);
    dom.btnExportCsv.addEventListener('click', () => handleExport('csv'));
    dom.btnExportXlsx.addEventListener('click', () => handleExport('xlsx'));
    dom.btnExportJson.addEventListener('click', () => handleExport('json'));
    dom.btnPrevPage.addEventListener('click', () => changePage(-1));
    dom.btnNextPage.addEventListener('click', () => changePage(1));
  }

  // --- Analysis Flow ---
  async function handleAnalyze() {
    if (state.isAnalyzing || !state.currentTab?.url) return;

    state.isAnalyzing = true;
    showLoading();

    try {
      // Step 1: Crawling
      setLoadingStep('crawl');

      const response = await fetch(`${CONFIG.API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.currentTab.url,
          title: state.currentTab.title || ''
        })
      });

      // Step 2: Extracting
      setLoadingStep('extract');
      await sleep(300); // Visual feedback

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${response.status})`);
      }

      // Step 3: Analyzing
      setLoadingStep('analyze');
      const result = await response.json();

      // Step 4: AI Summary
      setLoadingStep('summary');
      await sleep(200);

      // Store result
      state.analysisResult = result;
      await cacheAnalysis(state.currentTab.url, result);
      await addToHistory(state.currentTab, result);
      await incrementAnalysesCount();

      // Show results
      showResults(result);
    } catch (err) {
      showError(err.message);
    } finally {
      state.isAnalyzing = false;
    }
  }

  // --- Loading UI ---
  function showLoading() {
    dom.loadingState.style.display = 'block';
    dom.errorState.style.display = 'none';
    dom.resultsDashboard.style.display = 'none';
    dom.historyPanel.style.display = 'none';
    dom.btnAnalyze.disabled = true;

    // Reset steps
    const btnText = dom.btnAnalyze.querySelector('.btn-analyze-text');
    const btnIcon = dom.btnAnalyze.querySelector('.btn-analyze-icon');
    const btnLoader = dom.btnAnalyze.querySelector('.btn-analyze-loader');
    btnText.style.display = 'none';
    btnIcon.style.display = 'none';
    btnLoader.style.display = 'flex';

    [dom.stepCrawl, dom.stepExtract, dom.stepAnalyze, dom.stepSummary].forEach(
      el => { el.className = 'loading-step'; }
    );
  }

  function setLoadingStep(step) {
    const steps = ['crawl', 'extract', 'analyze', 'summary'];
    const currentIdx = steps.indexOf(step);

    steps.forEach((s, i) => {
      const el = $(`#step-${s}`);
      if (i < currentIdx) el.className = 'loading-step done';
      else if (i === currentIdx) el.className = 'loading-step active';
      else el.className = 'loading-step';
    });
  }

  // --- Error UI ---
  function showError(message) {
    dom.loadingState.style.display = 'none';
    dom.errorState.style.display = 'block';
    dom.resultsDashboard.style.display = 'none';
    dom.errorMessage.textContent = message;
    resetAnalyzeButton();
  }

  function resetAnalyzeButton() {
    dom.btnAnalyze.disabled = false;
    const btnText = dom.btnAnalyze.querySelector('.btn-analyze-text');
    const btnIcon = dom.btnAnalyze.querySelector('.btn-analyze-icon');
    const btnLoader = dom.btnAnalyze.querySelector('.btn-analyze-loader');
    btnText.style.display = '';
    btnIcon.style.display = '';
    btnLoader.style.display = 'none';
  }

  // --- Results Rendering ---
  function showResults(result) {
    dom.loadingState.style.display = 'none';
    dom.errorState.style.display = 'none';
    dom.resultsDashboard.style.display = 'flex';
    dom.historyPanel.style.display = 'none';
    resetAnalyzeButton();

    const analytics = result.analytics || {};
    const products = result.products || [];
    const seo = result.seo || {};
    const summary = result.summary || '';

    // AI Summary
    dom.aiSummaryText.textContent = summary || 'No AI summary available for this page.';

    // KPIs
    dom.kpiProducts.textContent = formatNumber(analytics.total_products || 0);
    dom.kpiAvgPrice.textContent = formatCurrency(analytics.avg_price || 0);
    dom.kpiBrands.textContent = formatNumber(analytics.unique_brands || 0);
    dom.kpiAvgRating.textContent = analytics.avg_rating
      ? `${analytics.avg_rating.toFixed(1)}★`
      : '—';

    // Price Range
    if (analytics.min_price != null && analytics.max_price != null) {
      const range = analytics.max_price - analytics.min_price || 1;
      const medianPos = ((analytics.median_price || analytics.avg_price || 0) - analytics.min_price) / range;
      dom.priceRangeFill.style.width = `${Math.min(medianPos * 100, 100)}%`;
      dom.priceMin.textContent = formatCurrency(analytics.min_price);
      dom.priceMedian.textContent = formatCurrency(analytics.median_price || analytics.avg_price || 0);
      dom.priceMax.textContent = formatCurrency(analytics.max_price);
    }

    // Top Brands
    renderBrands(analytics.top_brands || []);

    // SEO Overview
    renderSeo(seo);

    // Product Table
    state.analysisResult = result;
    state.currentPage = 1;
    state.totalPages = Math.ceil(products.length / CONFIG.ITEMS_PER_PAGE) || 1;
    dom.productCountBadge.textContent = products.length;
    renderProductPage();

    // Update analyze button
    dom.btnAnalyze.querySelector('.btn-analyze-text').textContent = 'Re-Analyze';
    dom.analyzeHint.textContent = `Last analyzed ${new Date().toLocaleTimeString()}`;
  }

  function renderBrands(brands) {
    if (!brands.length) {
      dom.brandsList.innerHTML = '<p style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0;">No brand data available</p>';
      return;
    }

    const maxCount = brands[0]?.count || 1;
    dom.brandsList.innerHTML = brands.slice(0, 8).map(b => `
      <div class="brand-row">
        <span class="brand-name">${escapeHtml(b.name)}</span>
        <div class="brand-bar-wrap">
          <div class="brand-bar" style="width:${(b.count / maxCount * 100).toFixed(1)}%"></div>
        </div>
        <span class="brand-count">${b.count}</span>
      </div>
    `).join('');
  }

  function renderSeo(seo) {
    const items = [
      { label: 'Meta Title', value: seo.meta_title ? '✓ Present' : '✗ Missing', cls: seo.meta_title ? 'seo-good' : 'seo-bad' },
      { label: 'Meta Desc', value: seo.meta_description ? '✓ Present' : '✗ Missing', cls: seo.meta_description ? 'seo-good' : 'seo-bad' },
      { label: 'H1 Tags', value: seo.h1_count ?? '—', cls: seo.h1_count === 1 ? 'seo-good' : seo.h1_count > 1 ? 'seo-warn' : 'seo-bad' },
      { label: 'H2 Tags', value: seo.h2_count ?? '—', cls: '' },
      { label: 'Images', value: seo.image_count ?? '—', cls: '' },
      { label: 'Links', value: seo.link_count ?? '—', cls: '' },
      { label: 'JSON-LD', value: seo.json_ld_count ? `${seo.json_ld_count} schemas` : 'None', cls: seo.json_ld_count ? 'seo-good' : '' },
      { label: 'OG Tags', value: seo.og_tags_present ? '✓ Present' : '✗ Missing', cls: seo.og_tags_present ? 'seo-good' : 'seo-warn' }
    ];

    dom.seoGrid.innerHTML = items.map(item => `
      <div class="seo-item">
        <span class="seo-item-label">${item.label}</span>
        <span class="seo-item-value ${item.cls}">${item.value}</span>
      </div>
    `).join('');
  }

  function renderProductPage() {
    const products = state.analysisResult?.products || [];
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const pageProducts = products.slice(start, end);

    if (!pageProducts.length) {
      dom.productTableBody.innerHTML = `
        <tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No products found on this page</td></tr>
      `;
    } else {
      dom.productTableBody.innerHTML = pageProducts.map(p => `
        <tr>
          <td title="${escapeHtml(p.title || '')}">${escapeHtml(truncate(p.title || 'Untitled', 40))}</td>
          <td>${p.price ? formatCurrency(parseFloat(p.price.toString().replace(/[^0-9.]/g, ''))) : '—'}</td>
          <td>${p.rating ? `${p.rating}★` : '—'}</td>
          <td>${escapeHtml(p.brand || '—')}</td>
        </tr>
      `).join('');
    }

    // Pagination
    dom.pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
    dom.btnPrevPage.disabled = state.currentPage <= 1;
    dom.btnNextPage.disabled = state.currentPage >= state.totalPages;
  }

  function changePage(delta) {
    const newPage = state.currentPage + delta;
    if (newPage < 1 || newPage > state.totalPages) return;
    state.currentPage = newPage;
    renderProductPage();
  }

  // --- Export ---
  async function handleExport(format) {
    if (!state.analysisResult) return;

    const btn = $(`#btn-export-${format}`);
    const originalText = btn.textContent;
    btn.textContent = 'Exporting...';
    btn.disabled = true;

    try {
      if (format === 'json') {
        downloadJson(state.analysisResult);
      } else {
        // Try backend export first
        try {
          const response = await fetch(`${CONFIG.API_BASE}/export/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.analysisResult)
          });

          if (!response.ok) throw new Error('Server export failed');

          const blob = await response.blob();
          const ext = format === 'xlsx' ? 'xlsx' : 'csv';
          downloadBlob(blob, `webintel-analysis.${ext}`);
        } catch {
          // Fallback: client-side CSV export
          if (format === 'csv') {
            downloadCsvClientSide(state.analysisResult.products || []);
          } else {
            throw new Error('Excel export requires the backend server');
          }
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'webintel-analysis.json');
  }

  function downloadCsvClientSide(products) {
    if (!products.length) return;

    const headers = Object.keys(products[0]);
    const rows = products.map(p =>
      headers.map(h => `"${String(p[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'webintel-products.csv');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- History ---
  function toggleHistory() {
    state.showHistory = !state.showHistory;
    dom.historyPanel.style.display = state.showHistory ? 'block' : 'none';
    dom.btnHistory.classList.toggle('active', state.showHistory);

    if (state.showHistory) {
      dom.resultsDashboard.style.display = 'none';
      loadHistory();
    } else if (state.analysisResult) {
      dom.resultsDashboard.style.display = 'flex';
    }
  }

  async function loadHistory() {
    try {
      const data = await chrome.storage.local.get('history');
      const history = data.history || [];

      if (!history.length) {
        dom.historyList.innerHTML = '<p class="history-empty">No analyses yet. Click "Analyze" to get started.</p>';
        return;
      }

      dom.historyList.innerHTML = history.map((item, idx) => `
        <div class="history-item" data-index="${idx}">
          <img class="history-item-favicon" src="${item.favicon || ''}" alt="" onerror="this.style.display='none'" />
          <div class="history-item-info">
            <div class="history-item-title">${escapeHtml(item.title || 'Untitled')}</div>
            <div class="history-item-url">${escapeHtml(item.url || '')}</div>
          </div>
          <span class="history-item-time">${formatTimeAgo(item.timestamp)}</span>
        </div>
      `).join('');

      // Bind click to reload analysis
      dom.historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index);
          const item = history[idx];
          if (item?.result) {
            state.analysisResult = item.result;
            state.showHistory = false;
            dom.historyPanel.style.display = 'none';
            dom.btnHistory.classList.remove('active');
            showResults(item.result);
          }
        });
      });
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  async function addToHistory(tab, result) {
    try {
      const data = await chrome.storage.local.get('history');
      const history = data.history || [];

      // Prepend new entry
      history.unshift({
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl,
        timestamp: Date.now(),
        result: result
      });

      // Keep only the last N entries
      if (history.length > CONFIG.MAX_HISTORY) {
        history.length = CONFIG.MAX_HISTORY;
      }

      await chrome.storage.local.set({ history });
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  }

  // --- Cache ---
  async function getCachedAnalysis(url) {
    try {
      const data = await chrome.storage.local.get('cache');
      const cache = data.cache || {};
      const entry = cache[url];
      if (entry && (Date.now() - entry.timestamp) < CONFIG.CACHE_TTL_MS) {
        return entry.result;
      }
      return null;
    } catch { return null; }
  }

  async function cacheAnalysis(url, result) {
    try {
      const data = await chrome.storage.local.get('cache');
      const cache = data.cache || {};
      cache[url] = { result, timestamp: Date.now() };

      // Limit cache size (keep 20 entries)
      const keys = Object.keys(cache);
      if (keys.length > 20) {
        const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        oldest.slice(0, keys.length - 20).forEach(k => delete cache[k]);
      }

      await chrome.storage.local.set({ cache });
    } catch (err) {
      console.error('Failed to cache:', err);
    }
  }

  // --- Analyses Count ---
  async function loadAnalysesCount() {
    try {
      const data = await chrome.storage.local.get('analysesCount');
      const info = data.analysesCount || { count: 0, date: new Date().toDateString() };

      // Reset if new day
      if (info.date !== new Date().toDateString()) {
        info.count = 0;
        info.date = new Date().toDateString();
        await chrome.storage.local.set({ analysesCount: info });
      }

      dom.analysesCount.textContent = `${info.count} analyses today`;
    } catch (err) {
      console.error('Failed to load count:', err);
    }
  }

  async function incrementAnalysesCount() {
    try {
      const data = await chrome.storage.local.get('analysesCount');
      const info = data.analysesCount || { count: 0, date: new Date().toDateString() };

      if (info.date !== new Date().toDateString()) {
        info.count = 0;
        info.date = new Date().toDateString();
      }

      info.count++;
      await chrome.storage.local.set({ analysesCount: info });
      dom.analysesCount.textContent = `${info.count} analyses today`;
    } catch (err) {
      console.error('Failed to update count:', err);
    }
  }

  // --- Helpers ---
  function formatNumber(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  function formatCurrency(value) {
    if (!value || isNaN(value)) return '—';
    return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', init);
})();
