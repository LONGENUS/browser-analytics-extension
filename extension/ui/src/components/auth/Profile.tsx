import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Clock,
  LogOut,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { authService, AuthUser } from '../../services/auth';

interface ProfileProps {
  user: AuthUser;
  onSignOut: () => void;
  onClose?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onSignOut, onClose }) => {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authService.signOut();
    setIsSigningOut(false);
    onSignOut();
  };

  const initials = (user.fullName || user.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const formattedCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recently';

  const formattedLastLogin = user.lastLogin
    ? new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Now';

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-soft overflow-hidden">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {user.fullName || 'User'}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                user.plan === 'pro'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}
            >
              {user.plan}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {user.email}
          </p>

          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
            <span>Member since {formattedCreated}</span>
            <span>•</span>
            <span>Active {formattedLastLogin}</span>
          </div>
        </div>
      </div>

      {/* Account Status Card */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            Authentication
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Supabase Auth Verified
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Resume Platform
          </span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Active Workspace
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex-1 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {isSigningOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </>
          )}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
