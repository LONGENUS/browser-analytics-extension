/**
 * WebIntel Auth Storage Adapter
 * Provides persistent, secure token & session storage across browser restarts.
 * Uses chrome.storage.local in Chrome Extension context with web localStorage fallback.
 */

declare const chrome: any;

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

class ChromeStorageAdapter implements StorageAdapter {
  private isChromeExtension(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      Boolean(chrome.storage) &&
      Boolean(chrome.storage.local)
    );
  }

  async getItem(key: string): Promise<string | null> {
    if (this.isChromeExtension()) {
      return new Promise<string | null>((resolve) => {
        try {
          chrome.storage.local.get([key], (result: Record<string, any>) => {
            if (chrome.runtime?.lastError) {
              resolve(this.getFallback(key));
            } else {
              const val = result ? result[key] : null;
              resolve(typeof val === 'string' ? val : val ? JSON.stringify(val) : null);
            }
          });
        } catch (_) {
          resolve(this.getFallback(key));
        }
      });
    }
    return this.getFallback(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.isChromeExtension()) {
      return new Promise<void>((resolve) => {
        try {
          chrome.storage.local.set({ [key]: value }, () => {
            this.setFallback(key, value);
            resolve();
          });
        } catch (_) {
          this.setFallback(key, value);
          resolve();
        }
      });
    }
    this.setFallback(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.isChromeExtension()) {
      return new Promise<void>((resolve) => {
        try {
          chrome.storage.local.remove([key], () => {
            this.removeFallback(key);
            resolve();
          });
        } catch (_) {
          this.removeFallback(key);
          resolve();
        }
      });
    }
    this.removeFallback(key);
  }

  async clear(): Promise<void> {
    if (this.isChromeExtension()) {
      return new Promise<void>((resolve) => {
        try {
          chrome.storage.local.clear(() => {
            this.clearFallback();
            resolve();
          });
        } catch (_) {
          this.clearFallback();
          resolve();
        }
      });
    }
    this.clearFallback();
  }

  private getFallback(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {}
    return null;
  }

  private setFallback(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) {}
  }

  private removeFallback(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  private clearFallback(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (_) {}
  }
}

export const authStorage = new ChromeStorageAdapter();

/**
 * Storage keys used by the authentication module.
 */
export const AUTH_STORAGE_KEYS = {
  SESSION: 'webintel_auth_session',
  USER: 'webintel_auth_user',
  TOKEN: 'webintel_auth_token',
  REFRESH_TOKEN: 'webintel_auth_refresh_token',
  EXPIRES_AT: 'webintel_auth_expires_at',
  LAST_ANALYSIS: 'webintel_pending_save_analysis',
} as const;
