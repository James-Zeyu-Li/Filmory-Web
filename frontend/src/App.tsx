import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { AccountCenterModal } from './components/AccountCenterModal';
import { DashboardView } from './views/Dashboard/DashboardView';
import { RollsView } from './views/Rolls/RollsView';
import { GearView } from './views/Gear/GearView';
import { CompareView } from './views/Compare/CompareView';
import { InsightsView } from './views/Insights/InsightsView';
import { SettingsView } from './views/Settings/SettingsView';
import { seedDatabaseIfNeeded } from './services/seedService';
import { SyncService } from './services/syncService';
import { Film } from 'lucide-react';
import { MobileHeader } from './components/MobileHeader';
import { TrialBanner } from './components/TrialBanner';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { PageTransition } from './components/PageTransition';
import { AnimatePresence } from 'framer-motion';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { TrialGateProvider } from './contexts/TrialGateContext';
import { useAuth } from './contexts/useAuth';
import { useLanguage } from './contexts/useLanguage';
import { LoginView } from './views/Auth/LoginView';
import { ForgotPasswordView } from './views/Auth/ForgotPasswordView';
import { ResetPasswordView } from './views/Auth/ResetPasswordView';
import { AuthCallbackView } from './views/Auth/AuthCallbackView';
import { AuthStatusView } from './views/Auth/AuthStatusView';
import { LandingView } from './views/Landing/LandingView';
import { AUTH_ROUTES } from './services/authFlow';
import './App.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authMode, isLoading: authLoading, isAuthTransitioning, authTransitionMode } = useAuth();
  const { t } = useLanguage();
  const routeState = location.state as { skipPageTransition?: boolean } | null;
  const disablePageTransition = Boolean(routeState?.skipPageTransition);
  const userId = user?.id;
  
  const [sidebarOpenPath, setSidebarOpenPath] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountCenterOpen, setIsAccountCenterOpen] = useState(false);
  const isSidebarOpen = sidebarOpenPath === location.pathname;
  
  const [enableFilmMode, setEnableFilmMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('grainfolio_enable_film_mode');
    return saved === null ? true : saved === 'true';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Sync film mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('grainfolio_enable_film_mode', String(enableFilmMode));
  }, [enableFilmMode]);

  // Seed sample data only for the local developer bypass account.
  // Real Supabase users should start empty unless they explicitly carry over trial data.
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }
    if (authMode !== 'dev-bypass') {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    let cancelled = false;
    const initializeApp = async () => {
      queueMicrotask(() => {
        if (!cancelled) setIsLoading(true);
      });
      try {
        await seedDatabaseIfNeeded();
      } catch (err) {
        console.error('Initialization failed', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    initializeApp();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authMode, userId]);

  useEffect(() => {
    if (!userId || authMode === 'trial') {
      SyncService.stop();
      return;
    }

    SyncService.start();
    return () => {
      SyncService.stop();
    };
  }, [authMode, userId]);

  const loadingMessage = authTransitionMode === 'deletingAccount'
    ? t('app.deletingAccount')
    : authTransitionMode === 'loggingOut'
      ? t('app.signingOut')
      : t('app.openingWorkspace');

  if (authLoading || isLoading || isAuthTransitioning) {
    return (
      <div className="app-loading-screen">
        <Film className="loading-logo animate-pulse" size={64} />
        <h2>Grainfolio</h2>
        <span>{loadingMessage}</span>
        {authTransitionMode === 'deletingAccount' && (
          <p className="app-loading-note">{t('app.deleteFarewell')}</p>
        )}
      </div>
    );
  }

  // Define public routes that don't require layout
  const publicPaths = new Set([
    '/',
    AUTH_ROUTES.login,
    AUTH_ROUTES.callback,
    AUTH_ROUTES.forgotPassword,
    AUTH_ROUTES.resetPassword,
    AUTH_ROUTES.checkEmail,
    AUTH_ROUTES.verified,
  ]);
  const isPublicRoute = publicPaths.has(location.pathname);

  if (isPublicRoute) {
    if (user && authMode !== 'trial' && location.pathname === AUTH_ROUTES.login) {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingView />} />
          <Route path={AUTH_ROUTES.login} element={<LoginView />} />
          <Route path={AUTH_ROUTES.forgotPassword} element={<ForgotPasswordView />} />
          <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordView />} />
          <Route path={AUTH_ROUTES.callback} element={<AuthCallbackView />} />
          <Route path={AUTH_ROUTES.checkEmail} element={<AuthStatusView mode="check-email" />} />
          <Route path={AUTH_ROUTES.verified} element={<AuthStatusView mode="verified" />} />
        </Routes>
      </AnimatePresence>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <MobileHeader onOpenSidebar={() => setSidebarOpenPath(location.pathname)} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpenPath(null)} 
        onOpenAccountCenter={() => setIsAccountCenterOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <main className="app-main-content">
        <TrialBanner />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/dashboard" element={<PageTransition disableMotion={disablePageTransition}><DashboardView enableFilmMode={enableFilmMode} onNavigate={(path, options) => navigate(`/${path}`, { state: options?.skipPageTransition ? { skipPageTransition: true } : undefined })} /></PageTransition>} />
            <Route path="/rolls" element={<PageTransition disableMotion={disablePageTransition}><RollsView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/gear" element={<PageTransition disableMotion={disablePageTransition}><GearView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/insights" element={<PageTransition disableMotion={disablePageTransition}><InsightsView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/compare" element={<PageTransition disableMotion={disablePageTransition}><CompareView /></PageTransition>} />
            
            {/* Catch-all redirects to dashboard if not matched */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isAccountCenterOpen && (
          <AccountCenterModal
            isOpen={isAccountCenterOpen}
            onClose={() => setIsAccountCenterOpen(false)}
          />
        )}
        {isSettingsOpen && (
          <SettingsView 
            enableFilmMode={enableFilmMode} 
            setEnableFilmMode={setEnableFilmMode} 
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ConfirmProvider>
      <FeedbackProvider>
        <PwaUpdatePrompt />
        <CurrencyProvider>
          <TrialGateProvider>
            <AppContent />
          </TrialGateProvider>
        </CurrencyProvider>
      </FeedbackProvider>
    </ConfirmProvider>
  );
}

export default App;
