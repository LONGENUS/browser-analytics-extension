/**
 * TailorResume — API Communication Service
 * Unified HTTP client for communicating with the FastAPI / Supabase backend.
 * Provides authenticatedFetch with automatic JWT Bearer token injection.
 */

import { sessionManager } from './auth';

const DEFAULT_API_BASE_URL = 'https://browser-analytics-extension-longenus05-3620s-projects.vercel.app';

/**
 * Resolves the backend API base URL using window.APP_CONFIG (if present)
 * or falls back to the production Vercel serverless deployment.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG) {
    try {
      const config = (window as any).APP_CONFIG;
      if (typeof config.getBaseUrl === 'function') {
        const url = await config.getBaseUrl();
        if (url) return url.replace(/\/$/, '');
      } else if (config.API_BASE_URL) {
        return config.API_BASE_URL.replace(/\/$/, '');
      }
    } catch (e) {
      console.warn('Error reading APP_CONFIG base URL:', e);
    }
  }
  return DEFAULT_API_BASE_URL;
}

/**
 * Authenticated API Request Wrapper.
 * Automatically injects the user's active Supabase Bearer token.
 * If server responds with 401 Unauthorized, transitions SessionManager state to session_expired.
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = await getApiBaseUrl();
  const token = sessionManager.getAccessToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && token) {
    sessionManager.setState('session_expired');
  }

  return response;
}

/**
 * Fetches the authenticated user's verified identity and profile from the backend.
 */
export async function fetchMyProfile(): Promise<any> {
  const resp = await authenticatedFetch('/auth/profile');
  if (!resp.ok) {
    throw new Error(`Failed to fetch user profile (${resp.status})`);
  }
  return resp.json();
}

/**
 * Updates the authenticated user's profile on the backend.
 */
export async function updateMyProfile(data: { full_name?: string; avatar_url?: string }): Promise<any> {
  const resp = await authenticatedFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update profile (${resp.status})`);
  }
  return resp.json();
}
