import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/Dashboard/DashboardView';
import { PhotosView } from './views/Photos/PhotosView';
import { RollsView } from './views/Rolls/RollsView';
import { GearView } from './views/Gear/GearView';
import { CompareView } from './views/Compare/CompareView';
import { InsightsView } from './views/Insights/InsightsView';
import { SettingsView } from './views/Settings/SettingsView';
import { seedDatabaseIfNeeded } from './services/seedService';
import { Film } from 'lucide-react';
import { MobileHeader } from './components/MobileHeader';
import { PageTransition } from './components/PageTransition';
import { AnimatePresence } from 'framer-motion';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { useAuth } from './contexts/useAuth';
import { LoginView } from './views/Auth/LoginView';
import { LandingView } from './views/Landing/LandingView';
import './App.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading: authLoading } = useAuth();
  
  const [sidebarOpenPath, setSidebarOpenPath] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isSidebarOpen = sidebarOpenPath === location.pathname;
  
  const [enableFilmMode, setEnableFilmMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('filmory_enable_film_mode');
    return saved === null ? true : saved === 'true';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Sync film mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('filmory_enable_film_mode', String(enableFilmMode));
  }, [enableFilmMode]);

  // Seed database on launch
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await seedDatabaseIfNeeded();
      } catch (err) {
        console.error('Initialization failed', err);
      } finally {
        setIsLoading(false);
      }
    };
    initializeApp();
  }, []);

  if (authLoading || isLoading) {
    return (
      <div className="app-loading-screen">
        <Film className="loading-logo animate-pulse" size={64} />
        <h2>Filmory</h2>
        <span>胶片摄影统计正在载入本地空间...</span>
      </div>
    );
  }

  // Define public routes that don't require layout
  const isPublicRoute = location.pathname === '/' || location.pathname === '/login';

  if (isPublicRoute) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingView />} />
          <Route path="/login" element={<LoginView />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <div className="app-container">
      <MobileHeader onOpenSidebar={() => setSidebarOpenPath(location.pathname)} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpenPath(null)} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <main className="app-main-content">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/dashboard" element={<PageTransition><DashboardView enableFilmMode={enableFilmMode} onNavigate={(path) => navigate(`/${path}`)} /></PageTransition>} />
            <Route path="/photos" element={<PageTransition><PhotosView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/rolls" element={<PageTransition><RollsView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/gear" element={<PageTransition><GearView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/insights" element={<PageTransition><InsightsView enableFilmMode={enableFilmMode} /></PageTransition>} />
            <Route path="/compare" element={<PageTransition><CompareView /></PageTransition>} />
            
            {/* Catch-all redirects to dashboard if not matched */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <AnimatePresence>
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
        <AppContent />
      </FeedbackProvider>
    </ConfirmProvider>
  );
}

export default App;
