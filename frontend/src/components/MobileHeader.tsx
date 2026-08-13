import React from 'react';
import { Menu } from 'lucide-react';
import { useLanguage } from '../contexts/useLanguage';
import './MobileHeader.css';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenSidebar }) => {
  const { t } = useLanguage();
  return (
    <header className="mobile-header">
      <div className="mobile-brand">
        <div className="brand-logo-wrapper mobile">
          <img src="/compact-logo.webp" alt="Grainfolio Logo" className="brand-logo-img" />
        </div>
        <img src="/word-logo.webp" alt="Grainfolio" className="brand-wordmark-img mobile" />
      </div>
      <button className="mobile-menu-btn" onClick={onOpenSidebar} aria-label={t('nav.expandTitle')}>
        <Menu size={24} />
      </button>
    </header>
  );
};
