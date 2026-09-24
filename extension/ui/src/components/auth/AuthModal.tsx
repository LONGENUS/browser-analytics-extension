import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Login } from './Login';
import { Register } from './Register';
import { ForgotPassword } from './ForgotPassword';
import { Profile } from './Profile';
import { sessionManager, AuthUser, AuthState } from '../../services/auth';

export type AuthModalView = 'login' | 'register' | 'forgot_password' | 'profile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthModalView;
  promptMessage?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialView = 'login',
  promptMessage,
}) => {
  const [view, setView] = useState<AuthModalView>(initialView);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(sessionManager.getUser());

  useEffect(() => {
    if (isOpen) {
      // If user is already logged in and opens modal, default to profile
      if (sessionManager.isAuthenticated()) {
        setView(initialView === 'profile' ? 'profile' : initialView);
      } else {
        setView(initialView === 'profile' ? 'login' : initialView);
      }
      setCurrentUser(sessionManager.getUser());
    }
  }, [isOpen, initialView]);

  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((state, session) => {
      setCurrentUser(session?.user || null);
      if (state === 'logged_out' && view === 'profile') {
        setView('login');
      }
    });
    return unsubscribe;
  }, [view]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3 relative overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>WebIntel Account</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt Alert (e.g. "Login to Save analysis") */}
        {promptMessage && !currentUser && (
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/80 text-[11px] text-blue-700 dark:text-blue-300">
            {promptMessage}
          </div>
        )}

        {/* View Switching */}
        {view === 'login' && (
          <Login
            onSuccess={() => onClose()}
            onNavigateRegister={() => setView('register')}
            onNavigateForgotPassword={() => setView('forgot_password')}
          />
        )}

        {view === 'register' && (
          <Register
            onSuccess={() => onClose()}
            onNavigateLogin={() => setView('login')}
          />
        )}

        {view === 'forgot_password' && (
          <ForgotPassword onNavigateLogin={() => setView('login')} />
        )}

        {view === 'profile' && currentUser && (
          <Profile
            user={currentUser}
            onSignOut={() => setView('login')}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};
