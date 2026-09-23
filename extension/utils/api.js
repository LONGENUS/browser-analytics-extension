/* ========================================
   WebIntel — API Client Utility
   ======================================== */

const ApiClient = (() => {
  'use strict';

  let baseUrl = (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.API_BASE_URL : 'http://localhost:8000');
  const DEFAULT_TIMEOUT = 60000; // 60 seconds for crawling

  // --- Configuration ---
  function setBaseUrl(url) {
    baseUrl = url.replace(/\/$/, '');
  }

  function getBaseUrl() {
    return baseUrl;
  }

  // --- Core Request ---
  async function request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      timeout = DEFAULT_TIMEOUT,
      responseType = 'json'
    } = options;

    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.getBaseUrl && baseUrl === APP_CONFIG.API_BASE_URL) {
      try {
        baseUrl = await APP_CONFIG.getBaseUrl();
      } catch (_) {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.detail || `Request failed (${response.status})`,
          response.status
        );
      }

      if (responseType === 'blob') {
        return await response.blob();
      }

      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. The server may be busy crawling.', 408);
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. Make sure it is running.'
          : err.message,
        0
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // --- API Methods ---

  /**
   * Analyze a URL — sends it to the backend for crawling + extraction + analytics
   */
  async function analyzeUrl(url, title = '') {
    return request('/analyze', {
      method: 'POST',
      body: { url, title }
    });
  }

  /**
   * Get analysis history
   */
  async function getHistory(page = 1, limit = 20) {
    return request(`/history?page=${page}&limit=${limit}`);
  }

  /**
   * Get a specific analysis by ID
   */
  async function getAnalysis(id) {
    return request(`/history/${id}`);
  }

  /**
   * Export analysis to CSV
   */
  async function exportCsv(analysisData) {
    return request('/export/csv', {
      method: 'POST',
      body: analysisData,
      responseType: 'blob'
    });
  }

  /**
   * Export analysis to Excel
   */
  async function exportXlsx(analysisData) {
    return request('/export/xlsx', {
      method: 'POST',
      body: analysisData,
      responseType: 'blob'
    });
  }

  /**
   * Export analysis to JSON
   */
  async function exportJson(analysisData) {
    return request('/export/json', {
      method: 'POST',
      body: analysisData,
      responseType: 'blob'
    });
  }

  /**
   * Health check
   */
  async function healthCheck() {
    return request('/health', { timeout: 5000 });
  }

  // --- Error Class ---
  class ApiError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  }

  // --- Public API ---
  return {
    setBaseUrl,
    getBaseUrl,
    analyzeUrl,
    getHistory,
    getAnalysis,
    exportCsv,
    exportXlsx,
    exportJson,
    healthCheck,
    ApiError
  };
})();

// Export for use in popup.js or service-worker
if (typeof module !== 'undefined') {
  module.exports = ApiClient;
}
