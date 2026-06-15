import React from 'react';
import { 
  Image, 
  Camera, 
  Columns, 
  BarChart3, 
  Settings, 
  Film 
} from 'lucide-react';
import './Sidebar.css';

export type ActiveTab = 'photos' | 'rolls' | 'gear' | 'compare' | 'stats' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Film className="brand-icon" size={28} />
        <div className="brand-text">
          <h2>Filmory</h2>
          <span>Web Workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button 
          className={`nav-item ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <Image size={20} />
          <span>照片库</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'rolls' ? 'active' : ''}`}
          onClick={() => setActiveTab('rolls')}
        >
          <Film size={20} />
          <span>拍摄卷 (Rolls)</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'gear' ? 'active' : ''}`}
          onClick={() => setActiveTab('gear')}
        >
          <Camera size={20} />
          <span>器材库</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <Columns size={20} />
          <span>对比工作台</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={20} />
          <span>数据分析</span>
        </button>

        <div className="nav-spacer" />

        <button 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} />
          <span>设置</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-status">
          <div className="status-dot green" />
          <span>Local-First (Offline)</span>
        </div>
      </div>
    </aside>
  );
};
