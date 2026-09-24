import React from 'react';
import { RefreshCw, Moon, Sun, X, Globe, Sparkles, User, AlertTriangle } from 'lucide-react';
import { OverviewData } from '../types';
import { ActiveTabInfo } from '../services/api';
import { AuthState, AuthUser } from '../services/auth';

interface HeaderProps {
  overview?: OverviewData | null;
  activeTabInfo?: ActiveTabInfo | null;
  isLoading: boolean;
  onRefresh: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onClose?: () => void;
  authState?: AuthState;
  currentUser?: AuthUser | null;
  onOpenAuth?: (view?: 'login' | 'register' | 'profile') => void;
}

export const Header: React.FC<HeaderProps> = ({
  overview,
  activeTabInfo,
  isLoading,
  onRefresh,
  isDark,
  onToggleTheme,
  onClose,
  authState = 'logged_out',
  currentUser = null,
  onOpenAuth,
}) => {
  const domain = overview?.domain || activeTabInfo?.domain || 'Website';
  const url = overview?.url || activeTabInfo?.url || 'No active URL';
  const favicon = overview?.favicon || activeTabInfo?.favIconUrl;
  const industry = overview?.industry;
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        {/* App Title & Identity */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            WebIntel
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Pro
            </span>
          </span>
        </div>

        {/* Header Right Actions & Auth States */}
        <div className="flex items-center gap-1.5">
          {/* 1. Loading State (Skeleton only) */}
          {authState === 'loading' && (
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
          )}

          {/* 2. Logged Out State */}
          {authState === 'logged_out' && onOpenAuth && (
            <button
              onClick={() => onOpenAuth('login')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            >
              Sign In
            </button>
          )}

          {/* 3. Session Expired State */}
          {authState === 'session_expired' && onOpenAuth && (
            <button
              onClick={() => onOpenAuth('login')}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse"
              title="Session expired. Click to sign in again"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Sign In</span>
            </button>
          )}

          {/* 4. Logged In State (Avatar, Plan, Profile modal) */}
          {authState === 'logged_in' && currentUser && onOpenAuth && (
            <button
              onClick={() => onOpenAuth('profile')}
              className="flex items-center gap-1.5 p-1 pl-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={`${currentUser.fullName || 'User'} (${currentUser.email})`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {currentUser.plan}
              </span>
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>
                    {(currentUser.fullName || currentUser.email || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          )}

          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Target Site Bar */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 rounded-xl p-2 border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-soft">
            {favicon ? (
              <img
                src={favicon}
                alt=""
                className="w-4 h-4 object-contain rounded-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                {domain}
              </span>
              {industry && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  • {industry}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
              {url}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Analyzing...' : 'Re-analyze'}</span>
        </button>
      </div>
    </header>
  );
};
