/**
 * WebIntel Authentication Service
 * Full-featured Supabase Auth integration supporting Email/Password, Google OAuth,
 * session persistence across browser restarts, token rotation, and cloud analysis sync.
 */

import { createClient, SupabaseClient, Session as SupabaseSession } from '@supabase/supabase-js';
import { authStorage, AUTH_STORAGE_KEYS } from './storage';
import { isTokenExpired } from './jwt';
import { sessionManager, AuthSession, AuthUser, AuthState } from './session';

declare const chrome: any;

// Default public Supabase project configuration (can be overridden via APP_CONFIG or chrome.storage)
const DEFAULT_SUPABASE_URL = 'https://nwbftptghgacpsqtzmve.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53YmZ0cHRnaGdhY3BzcXR6bXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4ODk5OTksImV4cCI6MjA1ODQ2NTk5OX0.placeholder_key';

export interface SignUpResponse {
  success: boolean;
  needsEmailVerification?: boolean;
  user?: AuthUser;
  error?: string;
}

export interface SignInResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export class AuthService {
  private client: SupabaseClient | null = null;
  private isInitialized: boolean = false;
  private refreshTimer: any = null;

  constructor() {
    this.initClient();
  }

  /**
   * Initializes Supabase Client using resolved configuration.
   */
  private async initClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;

    let supabaseUrl = DEFAULT_SUPABASE_URL;
    let supabaseAnonKey = DEFAULT_SUPABASE_ANON_KEY;

    // Read from window.APP_CONFIG if available
    if (typeof window !== 'undefined' && (window as any).APP_CONFIG) {
      const cfg = (window as any).APP_CONFIG;
      const env = cfg.ENVIRONMENTS ? cfg.ENVIRONMENTS[cfg.ENVIRONMENT] : null;
      if (env?.SUPABASE_URL) supabaseUrl = env.SUPABASE_URL;
      if (env?.SUPABASE_ANON_KEY) supabaseAnonKey = env.SUPABASE_ANON_KEY;
    }

    // Read from chrome.storage overrides if set by user
    try {
      const storedUrl = await authStorage.getItem('custom_supabase_url');
      const storedKey = await authStorage.getItem('custom_supabase_anon_key');
      if (storedUrl && storedUrl.trim()) supabaseUrl = storedUrl.trim();
      if (storedKey && storedKey.trim()) supabaseAnonKey = storedKey.trim();
    } catch (_) {}

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: {
          getItem: (k) => authStorage.getItem(k),
          setItem: (k, v) => authStorage.setItem(k, v),
          removeItem: (k) => authStorage.removeItem(k),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    // Listen to Supabase Auth state changes
    this.client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          await this.syncSessionFromSupabase(session);
        }
      } else if (event === 'SIGNED_OUT') {
        await this.handleSignedOut();
      }
    });

    return this.client;
  }

  /**
   * Resolves the active Supabase client.
   */
  async getClient(): Promise<SupabaseClient> {
    if (!this.client) {
      await this.initClient();
    }
    return this.client!;
  }

  /**
   * Restores session silently on extension / page startup.
   * Checks token validity, refreshes via refresh token if necessary.
   */
  async restoreSession(): Promise<AuthState> {
    try {
      sessionManager.setState('loading');
      const client = await this.getClient();

      // Check current Supabase active session
      const { data: { session }, error } = await client.auth.getSession();

      if (error || !session) {
        // Try reading stored session from storage adapter directly
        const storedJson = await authStorage.getItem(AUTH_STORAGE_KEYS.SESSION);
        if (storedJson) {
          try {
            const parsed = JSON.parse(storedJson) as AuthSession;
            if (parsed.refreshToken) {
              const { data: refreshData, error: refreshErr } = await client.auth.refreshSession({
                refresh_token: parsed.refreshToken,
              });

              if (!refreshErr && refreshData.session) {
                await this.syncSessionFromSupabase(refreshData.session);
                return 'logged_in';
              }
            }
          } catch (_) {}
        }

        sessionManager.setState('logged_out');
        return 'logged_out';
      }

      // Check if access token is expired
      if (isTokenExpired(session.access_token, 30)) {
        if (session.refresh_token) {
          const { data: refreshData, error: refreshErr } = await client.auth.refreshSession({
            refresh_token: session.refresh_token,
          });

          if (!refreshErr && refreshData.session) {
            await this.syncSessionFromSupabase(refreshData.session);
            return 'logged_in';
          }
        }
        // If refresh failed, mark as session expired without destroying user data
        sessionManager.setState('session_expired');
        return 'session_expired';
      }

      await this.syncSessionFromSupabase(session);
      return 'logged_in';
    } catch (e) {
      console.warn('Silent session restore error:', e);
      sessionManager.setState('logged_out');
      return 'logged_out';
    }
  }

  /**
   * Maps a Supabase Session to AuthSession and persists it in storage.
   */
  private async syncSessionFromSupabase(session: SupabaseSession): Promise<AuthSession> {
    const rawUser = session.user;
    const client = await this.getClient();

    // Query user profile from public.profiles table
    let profile: any = null;
    try {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('id', rawUser.id)
        .maybeSingle();
      profile = data;
    } catch (_) {}

    const authUser: AuthUser = {
      id: rawUser.id,
      email: rawUser.email || '',
      fullName:
        profile?.full_name ||
        rawUser.user_metadata?.full_name ||
        rawUser.user_metadata?.name ||
        rawUser.email?.split('@')[0] ||
        'User',
      avatarUrl: profile?.avatar_url || rawUser.user_metadata?.avatar_url || rawUser.user_metadata?.picture || '',
      plan: (profile?.plan as any) || 'free',
      createdAt: profile?.created_at || rawUser.created_at,
      lastLogin: profile?.last_login || new Date().toISOString(),
    };

    const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + 3600 * 1000;

    const authSession: AuthSession = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt,
      user: authUser,
    };

    // Save locally
    await authStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(authSession));
    await authStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, session.access_token);
    await authStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token);

    sessionManager.setSession(authSession);

    // Schedule next token refresh
    this.scheduleTokenRefresh(expiresAt, session.refresh_token);

    return authSession;
  }

  /**
   * Schedules automatic token refresh before expiration.
   */
  private scheduleTokenRefresh(expiresAt: number, refreshToken: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const msUntilRefresh = Math.max(10000, expiresAt - Date.now() - 60000); // 1 minute before expiry
    this.refreshTimer = setTimeout(async () => {
      try {
        const client = await this.getClient();
        const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
        if (!error && data.session) {
          await this.syncSessionFromSupabase(data.session);
        } else {
          sessionManager.setState('session_expired');
        }
      } catch (err) {
        console.warn('Scheduled token refresh failed:', err);
        sessionManager.setState('session_expired');
      }
    }, msUntilRefresh);
  }

  /**
   * Register a new user with Email + Password.
   */
  async signUp(email: string, password: string, fullName?: string): Promise<SignUpResponse> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    try {
      const client = await this.getClient();
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName?.trim() || cleanEmail.split('@')[0],
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        const authSession = await this.syncSessionFromSupabase(data.session);
        return { success: true, user: authSession.user };
      }

      // If Supabase has email confirmation enabled
      if (data.user && !data.session) {
        return { success: true, needsEmailVerification: true };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    }
  }

  /**
   * Sign In with Email + Password.
   */
  async signInWithPassword(email: string, password: string): Promise<SignInResponse> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    try {
      const client = await this.getClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session) {
        return { success: false, error: 'Failed to retrieve session from server.' };
      }

      const authSession = await this.syncSessionFromSupabase(data.session);
      return { success: true, user: authSession.user };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Login failed. Please check credentials.' };
    }
  }

  /**
   * Sign In with Google OAuth.
   * Uses chrome.identity.launchWebAuthFlow in Chrome Extension context,
   * or direct OAuth URL redirection in web browser.
   */
  async signInWithGoogle(): Promise<SignInResponse> {
    try {
      const client = await this.getClient();

      // Check if Chrome Identity API is available
      if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.launchWebAuthFlow) {
        const redirectUrl = chrome.identity.getRedirectURL('supabase-auth');
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (error || !data.url) {
          return { success: false, error: error?.message || 'Failed to initialize Google login' };
        }

        // Launch OAuth flow popup window
        return new Promise<SignInResponse>((resolve) => {
          chrome.identity.launchWebAuthFlow(
            {
              url: data.url,
              interactive: true,
            },
            async (responseUrl?: string) => {
              if (chrome.runtime?.lastError || !responseUrl) {
                resolve({
                  success: false,
                  error: chrome.runtime?.lastError?.message || 'Google sign-in was cancelled.',
                });
                return;
              }

              try {
                // Parse access_token and refresh_token from responseUrl hash
                const url = new URL(responseUrl);
                const hashParams = new URLSearchParams(url.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                  const { data: setSessionData, error: setSessionErr } =
                    await client.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    });

                  if (!setSessionErr && setSessionData.session) {
                    const session = await this.syncSessionFromSupabase(setSessionData.session);
                    resolve({ success: true, user: session.user });
                    return;
                  }
                }
                resolve({ success: false, error: 'Could not extract tokens from Google auth callback.' });
              } catch (parseErr: any) {
                resolve({ success: false, error: parseErr?.message || 'Failed to process Google login.' });
              }
            }
          );
        });
      }

      // Web Fallback: Standard Supabase OAuth redirect
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google login failed.' };
    }
  }

  /**
   * Sign Out. Clears tokens, revokes refresh token, and resets session state.
   */
  async signOut(): Promise<void> {
    try {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      const client = await this.getClient();
      await client.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut notice:', e);
    } finally {
      await this.handleSignedOut();
    }
  }

  private async handleSignedOut(): Promise<void> {
    await authStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
    await authStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    await authStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    sessionManager.setState('logged_out');
  }

  /**
   * Request password reset email.
   */
  async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }

    try {
      const client = await this.getClient();
      const { error } = await client.auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send password reset email.' };
    }
  }

  /**
   * Updates user password (e.g. after clicking reset link).
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    try {
      const client = await this.getClient();
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update password.' };
    }
  }

  /**
   * Saves a completed analysis to the logged-in user's cloud account.
   */
  async saveAnalysisToCloud(dossier: any): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!sessionManager.isAuthenticated()) {
      return { success: false, error: 'User is not logged in.' };
    }

    const user = sessionManager.getUser();
    if (!user) return { success: false, error: 'Missing authenticated user' };

    try {
      const client = await this.getClient();
      const record = {
        user_id: user.id,
        domain: dossier.domain || 'website',
        url: dossier.url || '',
        page_type: dossier.overview?.pageType || 'Website',
        created_at: new Date().toISOString(),
        overview_json: dossier.overview || {},
        products_json: dossier.products || [],
        seo_json: dossier.seo_intelligence || {},
        tech_json: dossier.tech_stack || {},
        browser_traffic_json: dossier.traffic || {},
        security_json: {},
        ai_json: dossier.ai_insights || {},
      };

      const { data, error } = await client
        .from('analyses')
        .insert(record)
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save analysis to cloud.' };
    }
  }

  /**
   * Fetches saved cloud analyses for the logged-in user.
   */
  async getSavedAnalyses(): Promise<any[]> {
    if (!sessionManager.isAuthenticated()) return [];
    const user = sessionManager.getUser();
    if (!user) return [];

    try {
      const client = await this.getClient();
      const { data, error } = await client
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data;
    } catch (err) {
      console.warn('Failed to fetch saved analyses:', err);
      return [];
    }
  }

  /**
   * Deletes a saved cloud analysis.
   */
  async deleteSavedAnalysis(id: string): Promise<boolean> {
    if (!sessionManager.isAuthenticated()) return false;

    try {
      const client = await this.getClient();
      const { error } = await client.from('analyses').delete().eq('id', id);
      return !error;
    } catch (_) {
      return false;
    }
  }
}

export const authService = new AuthService();
