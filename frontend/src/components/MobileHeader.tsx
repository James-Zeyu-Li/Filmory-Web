import React from 'react';
import { Menu } from 'lucide-react';
import './MobileHeader.css';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenSidebar }) => {
  return (
    <header className="mobile-header">
      <div className="mobile-brand">
        <img src="/logo.png" alt="Filmory Logo" className="mobile-logo" />
        <h2>Filmory</h2>
      </div>
      <button className="mobile-menu-btn" onClick={onOpenSidebar} aria-label="Open Menu">
        <Menu size={24} />
      </button>
    </header>
  );
};
