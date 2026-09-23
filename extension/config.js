/* ==============================================================================
   WebIntel — Extension Configuration
   Centralized environment management for local development & Vercel production.
   ============================================================================== */

const APP_CONFIG = {
  // Active environment: 'production' or 'development'
  // When 'production', the extension queries the Vercel deployed API.
  // When 'development', the extension falls back to local FastAPI on http://localhost:8000.
  ENVIRONMENT: 'production',

  ENVIRONMENTS: {
    production: {
      API_BASE_URL: 'https://browser-analytics-extension.vercel.app',
      SUPABASE_URL: 'https://your-project.supabase.co',
      TIMEOUT_MS: 60000,
    },
    development: {
      API_BASE_URL: 'http://localhost:8000',
      SUPABASE_URL: '',
      TIMEOUT_MS: 30000,
    },
  },

  get API_BASE_URL() {
    const env = this.ENVIRONMENTS[this.ENVIRONMENT];
    return (env && env.API_BASE_URL) || this.ENVIRONMENTS.development.API_BASE_URL;
  },

  /**
   * Resolves the active API base URL, checking chrome.storage
   * for user-configured custom URLs or environment overrides if present.
   */
  async getBaseUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storage = chrome.storage.sync || chrome.storage.local;
        const stored = await storage.get(['customApiUrl', 'environment']);
        if (stored && stored.customApiUrl && typeof stored.customApiUrl === 'string' && stored.customApiUrl.trim()) {
          return stored.customApiUrl.trim().replace(/\/$/, '');
        }
        if (stored && stored.environment && this.ENVIRONMENTS[stored.environment]) {
          return this.ENVIRONMENTS[stored.environment].API_BASE_URL;
        }
      }
    } catch (_) {
      // Fallback to static config if storage is unavailable
    }
    return this.API_BASE_URL;
  }
};

// Global exports across browser window, service worker, and Node environments
if (typeof self !== 'undefined') {
  self.APP_CONFIG = APP_CONFIG;
}
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}
