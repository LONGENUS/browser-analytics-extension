/**
 * WebIntel Auth Session Management
 * State definitions, event subscription, and session lifecycle.
 */

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp in milliseconds
  user: AuthUser;
}

export type AuthState = 'logged_out' | 'logged_in' | 'loading' | 'session_expired';

export type AuthStateChangeListener = (
  state: AuthState,
  session: AuthSession | null
) => void;

class SessionManager {
  private currentSession: AuthSession | null = null;
  private currentState: AuthState = 'loading';
  private listeners: Set<AuthStateChangeListener> = new Set();

  getState(): AuthState {
    return this.currentState;
  }

  getSession(): AuthSession | null {
    return this.currentSession;
  }

  getUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  isAuthenticated(): boolean {
    return this.currentState === 'logged_in' && this.currentSession !== null;
  }

  getAccessToken(): string | null {
    return this.currentSession?.accessToken || null;
  }

  setSession(session: AuthSession | null): void {
    this.currentSession = session;
    const newState: AuthState = session ? 'logged_in' : 'logged_out';
    this.setState(newState);
  }

  setState(state: AuthState): void {
    if (state === 'logged_out') {
      this.currentSession = null;
    }
    this.currentState = state;
    this.notifyListeners();
  }

  subscribe(listener: AuthStateChangeListener): () => void {
    this.listeners.add(listener);
    // Immediate callback with current state
    try {
      listener(this.currentState, this.currentSession);
    } catch (e) {
      console.warn('Auth listener notification warning:', e);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState, this.currentSession);
      } catch (e) {
        console.warn('Error in auth state change listener:', e);
      }
    }
  }
}

export const sessionManager = new SessionManager();
