import React, { useState } from 'react';
import { 
  Camera, 
  Settings, 
  Film,
  LayoutDashboard,
  BarChart2,
  Columns,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export type ActiveTab = 'dashboard' | 'photos' | 'rolls' | 'gear' | 'settings' | 'insights';

interface SidebarProps {
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, isOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1250 && window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isClosing, setIsClosing] = useState(false);
  
  const handleClose = () => {
    setIsClosing(true);
    onClose();
    setTimeout(() => setIsClosing(false), 300);
  };

  React.useEffect(() => {
    let lastWidth = window.innerWidth;
    
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      
      // Auto-collapse when crossing down the 1250px threshold
      if (currentWidth < 1250 && lastWidth >= 1250) {
        setIsCollapsed(true);
      }
      // Auto-expand when crossing up the 1250px threshold
      else if (currentWidth >= 1250 && lastWidth < 1250) {
        setIsCollapsed(false);
      }
      
      if (currentWidth <= 1024 && lastWidth > 1024) {
        setIsMobile(true);
      } else if (currentWidth > 1024 && lastWidth <= 1024) {
        setIsMobile(false);
      }
      
      lastWidth = currentWidth;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={handleClose} />}
      
      <aside 
        className={`sidebar ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          transition: (!isOpen && !isClosing && isMobile) ? 'none' : undefined
        }}
      >
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Filmory Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <div className="brand-text">
          <h2>Filmory</h2>
          <span>Web Workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LayoutDashboard size={20} />
          <span>控制中心</span>
        </NavLink>

        <NavLink 
          to="/rolls"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Film size={20} />
          <span>拍摄卷 (Rolls)</span>
        </NavLink>

        <NavLink 
          to="/gear"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Camera size={20} />
          <span>器材库</span>
        </NavLink>

        <NavLink 
          to="/insights"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <BarChart2 size={20} />
          <span>数据与财务 (Insights)</span>
        </NavLink>

        <NavLink 
          to="/compare"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Columns size={20} />
          <span>对比台 (Compare)</span>
        </NavLink>

      </nav>

      <div className="sidebar-footer">
        <button 
          className="nav-item collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', outline: 'none' }}
          title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          <span>收起侧边栏</span>
        </button>
        <div className="nav-spacer" style={{ height: '8px' }} />

        <button 
          className="nav-item"
          onClick={onOpenSettings}
          style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', outline: 'none' }}
        >
          <Settings size={20} />
          <span>偏好设置</span>
        </button>
        <div className="nav-spacer" style={{ height: '16px' }} />
        <div className="footer-status">
          <div className="status-dot green" />
          <span>Local-First (Offline)</span>
        </div>
      </div>
    </aside>
    </>
  );
};
