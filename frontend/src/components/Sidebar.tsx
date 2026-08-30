import React, { useRef, useState } from 'react';
import {
  Camera, 
  Settings, 
  Film,
  LayoutDashboard,
  BarChart2,
  Columns,
  ChevronLeft,
  ChevronRight,
  UserRound
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../contexts/useLanguage';
import './Sidebar.css';

export type ActiveTab = 'dashboard' | 'rolls' | 'gear' | 'settings' | 'insights';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenAccountCenter: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, onOpenAccountCenter, isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1250 && window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isResizing, setIsResizing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const onCloseRef = useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = () => {
    setIsClosing(true);
    onClose();
    setTimeout(() => setIsClosing(false), 300);
  };

  const handleOpenAccountCenter = () => {
    onOpenAccountCenter();
    onClose();
  };

  React.useEffect(() => {
    let lastWidth = window.innerWidth;
    let resizeTimer: number;
    
    const handleResize = () => {
      setIsResizing(true);
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        setIsResizing(false);
      }, 150);

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
        // Desktop has no open/closed drawer state — the sidebar just sits in
        // normal flow. Clear any mobile-open state left over from resizing
        // past this breakpoint, otherwise the fixed backdrop below keeps
        // rendering (isOpen is untouched by width) on top of the now in-flow
        // desktop sidebar.
        onCloseRef.current();
      }
      
      lastWidth = currentWidth;
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={handleClose} />}
      
      <aside 
        className={`sidebar ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{
          transition: isResizing || (!isOpen && !isClosing && isMobile) ? 'none' : undefined
        }}
      >
      <div className="sidebar-brand">
        {/* Collapsed state: compact brand mark. */}
        <div className="brand-logo-wrapper brand-logo-collapsed">
          <img src="/compact-logo.webp" alt="Grainfolio" className="brand-logo-img" />
        </div>
        {/* Expanded state: full wordmark. */}
        <div className="brand-logo-expanded">
          <img src="/word-logo.webp" alt="Grainfolio" className="brand-wordmark-img" />
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          aria-label={t('nav.dashboard')}
          title={t('nav.dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>{t('nav.dashboard')}</span>
        </NavLink>

        <NavLink 
          to="/rolls"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          aria-label={t('nav.rolls')}
          title={t('nav.rolls')}
        >
          <Film size={20} />
          <span>{t('nav.rolls')}</span>
        </NavLink>

        <NavLink 
          to="/gear"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
          aria-label={t('nav.gear')}
          title={t('nav.gear')}
        >
          <Camera size={20} />
          <span>{t('nav.gear')}</span>
        </NavLink>

        <div className="sidebar-nav-secondary">
          <NavLink
            to="/insights"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            aria-label={t('nav.insights')}
            title={t('nav.insights')}
          >
            <BarChart2 size={20} />
            <span>{t('nav.insights')}</span>
          </NavLink>

          <NavLink
            to="/compare"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            aria-label={t('nav.compare')}
            title={t('nav.compare')}
          >
            <Columns size={20} />
            <span>{t('nav.compare')}</span>
          </NavLink>
        </div>

      </nav>

      <div className="sidebar-footer">
        <button
          className="nav-item"
          onClick={handleOpenAccountCenter}
          aria-label={t('nav.account')}
          title={t('nav.account')}
        >
          <UserRound size={20} />
          <span>{t('nav.account')}</span>
        </button>
        <div className="nav-spacer" />

        <button
          className="nav-item"
          onClick={onOpenSettings}
          aria-label={t('nav.preferences')}
          title={t('nav.preferences')}
        >
          <Settings size={20} />
          <span>{t('nav.preferences')}</span>
        </button>

        <div className="sidebar-collapse-divider" />

        <button
          className="nav-item collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? t('nav.expandTitle') : t('nav.collapseTitle')}
          aria-label={isCollapsed ? t('nav.expandTitle') : t('nav.collapseTitle')}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          <span>{isCollapsed ? t('nav.expandTitle') : t('nav.collapse')}</span>
        </button>
      </div>
    </aside>
    </>
  );
};
