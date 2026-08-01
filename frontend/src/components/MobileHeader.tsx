import React from 'react';
import { Menu } from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import './MobileHeader.css';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenSidebar }) => {
  return (
    <header className="mobile-header">
      <div className="mobile-brand">
        <img src="/logo.png" alt="Grainfolio Logo" className="mobile-logo" />
        <h2>Grainfolio</h2>
      </div>
      <div className="mobile-header-actions">
        <SyncStatusBadge compact />
        <button className="mobile-menu-btn" onClick={onOpenSidebar} aria-label="Open Menu">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};
