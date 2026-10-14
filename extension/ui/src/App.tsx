import React, { useState, useEffect } from 'react';
import { AlertTriangle, User } from 'lucide-react';
import { Header } from './components/Header';
import { TabBar, TabKey } from './components/TabBar';
import { AuthModal, AuthModalView } from './components/auth/AuthModal';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { TailoredResumesList } from './components/dashboard/TailoredResumesList';
import { ResumeDashboard } from './components/resume/ResumeDashboard';
import { JobsDashboard } from './components/jobs/JobsDashboard';
import { JobTailorFlow } from './components/extension/JobTailorFlow';
import { Profile } from './components/auth/Profile';
import { authService, sessionManager, AuthState, AuthUser } from './services/auth';
import { dashboardService } from './services/dashboard.service';

export const App: React.FC = () => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tailor_resume_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Authentication State
  const [authState, setAuthState] = useState<AuthState>(sessionManager.getState());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(sessionManager.getUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalView, setAuthModalView] = useState<AuthModalView>('login');
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  // Active Tab navigation ('dashboard' | 'resumes' | 'tailored' | 'jobs' | 'tailor' | 'profile')
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  // Badge counts
  const [masterCount, setMasterCount] = useState<number | undefined>(undefined);
  const [tailoredCount, setTailoredCount] = useState<number | undefined>(undefined);
  const [jobCount, setJobCount] = useState<number | undefined>(undefined);

  // Cross-tab actions triggered from Dashboard Overview
  const [resumeAction, setResumeAction] = useState<'create' | 'import' | null>(null);
  const [targetResumeIdToEdit, setTargetResumeIdToEdit] = useState<string | null>(null);
  const [targetResumeIdToPreview, setTargetResumeIdToPreview] = useState<string | null>(null);

  // Sync dark theme class on documentElement
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tailor_resume_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tailor_resume_theme', 'light');
    }
  }, [isDark]);

  // Restore auth session silently on startup & subscribe to changes
  useEffect(() => {
    authService.restoreSession();
    const unsubscribe = sessionManager.subscribe((state, session) => {
      setAuthState(state);
      setCurrentUser(session?.user || null);
    });
    return unsubscribe;
  }, []);

  // Fetch real counts when authenticated or active tab changes
  useEffect(() => {
    if (authState === 'logged_in') {
      dashboardService
        .getOverview()
        .then((res) => {
          setMasterCount(res.counts.master_resumes);
          setTailoredCount(res.counts.tailored_resumes);
          setJobCount(res.counts.saved_jobs);
        })
        .catch(() => {
          // Non-blocking error for badges
        });
    }
  }, [authState, activeTab]);

  const handleOpenAuth = (view: AuthModalView = 'login', prompt?: string) => {
    setAuthModalView(view);
    setAuthPromptMessage(prompt || null);
    setIsAuthModalOpen(true);
  };

  const handleToggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center">
      {/* Responsive App Shell: Compact inside side panel (400-480px) and expanded on desktop (up to 1152px) */}
      <div className="w-full sm:max-w-6xl min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col border-x border-slate-200/80 dark:border-slate-800 shadow-2xl relative">
        {/* Sticky Header */}
        <Header
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onClose={handleClose}
          authState={authState}
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
        />

        {/* Session Expired Prompt */}
        {authState === 'session_expired' && (
          <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 px-3.5 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 shrink-0">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Session expired. Please sign in again.</span>
            </span>
            <button
              onClick={() => handleOpenAuth('login', 'Please sign in to keep your session active.')}
              className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors shrink-0"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Sticky Navigation Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            // Reset any one-shot cross-navigation triggers when user clicks a tab
            setResumeAction(null);
            setTargetResumeIdToEdit(null);
            setTargetResumeIdToPreview(null);
            setActiveTab(tab);
          }}
          masterCount={masterCount}
          tailoredCount={tailoredCount}
          jobCount={jobCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-5 overflow-y-auto">
          {/* 1. Dashboard Overview Tab */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              onNavigateTab={(tab) => {
                setResumeAction(null);
                setTargetResumeIdToEdit(null);
                setTargetResumeIdToPreview(null);
                setActiveTab(tab);
              }}
              onOpenCreateResume={() => {
                setResumeAction('create');
                setActiveTab('resumes');
              }}
              onOpenImportResume={() => {
                setResumeAction('import');
                setActiveTab('resumes');
              }}
              onOpenResumeEdit={(id) => {
                setTargetResumeIdToEdit(id);
                setActiveTab('resumes');
              }}
              onOpenResumePreview={(id) => {
                setTargetResumeIdToPreview(id);
                setActiveTab('resumes');
              }}
              authState={authState}
              onOpenAuth={handleOpenAuth}
            />
          )}

          {/* 2. Master Resumes Tab */}
          {activeTab === 'resumes' && (
            <ResumeDashboard
              initialOpenCreate={resumeAction === 'create'}
              initialOpenImport={resumeAction === 'import'}
              initialResumeIdToEdit={targetResumeIdToEdit}
              initialResumeIdToPreview={targetResumeIdToPreview}
              authState={authState}
              onOpenAuth={handleOpenAuth}
            />
          )}

          {/* 3. Tailored Resumes History Tab */}
          {activeTab === 'tailored' && (
            <TailoredResumesList
              onNavigateToJobs={() => setActiveTab('jobs')}
              onNavigateToTailor={() => setActiveTab('tailor')}
            />
          )}

          {/* 4. Saved Jobs Tab */}
          {activeTab === 'jobs' && (
            <JobsDashboard />
          )}

          {/* 5. Extension Tailoring Flow Tab */}
          {activeTab === 'tailor' && (
            <JobTailorFlow
              currentUser={currentUser}
              onOpenAuth={handleOpenAuth}
              onNavigateToResumes={() => setActiveTab('resumes')}
            />
          )}

          {/* 6. Profile / Account Settings Tab */}
          {activeTab === 'profile' && (
            <div className="py-2 max-w-md mx-auto">
              {currentUser ? (
                <Profile
                  user={currentUser}
                  onSignOut={() => setActiveTab('dashboard')}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sign in to view your profile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Manage your account details and master resumes across devices.
                  </p>
                  <button
                    onClick={() => handleOpenAuth('login')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-soft transition-all"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Unified Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialView={authModalView}
          promptMessage={authPromptMessage}
        />
      </div>
    </div>
  );
};
