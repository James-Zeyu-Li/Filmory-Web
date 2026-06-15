import { useState, useEffect } from 'react';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { PhotosView } from './views/Photos/PhotosView';
import { RollsView } from './views/Rolls/RollsView';
import { GearView } from './views/Gear/GearView';
import { CompareView } from './views/Compare/CompareView';
import { StatsView } from './views/Stats/StatsView';
import { SettingsView } from './views/Settings/SettingsView';
import { seedDatabaseIfNeeded } from './services/seedService';
import { Film } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('photos');
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

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <Film className="loading-logo animate-pulse" size={64} />
        <h2>Filmory</h2>
        <span>胶片摄影统计正在载入本地空间...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      {activeTab === 'photos' && <PhotosView enableFilmMode={enableFilmMode} />}
      {activeTab === 'rolls' && <RollsView enableFilmMode={enableFilmMode} />}
      {activeTab === 'gear' && <GearView enableFilmMode={enableFilmMode} />}
      {activeTab === 'compare' && <CompareView />}
      {activeTab === 'stats' && <StatsView enableFilmMode={enableFilmMode} />}
      {activeTab === 'settings' && (
        <SettingsView 
          enableFilmMode={enableFilmMode} 
          setEnableFilmMode={setEnableFilmMode} 
        />
      )}
    </div>
  );
}

export default App;
