import React from 'react';
import { Wallet } from 'lucide-react';
import { FinanceView } from '../Finance/FinanceView';
import { useLanguage } from '../../contexts/useLanguage';
import './InsightsView.css';

export const InsightsView: React.FC<{ enableFilmMode: boolean }> = () => {
  const { t } = useLanguage();

  return (
    <div className="main-content insights-page">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <Wallet size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>{t('finance.title')}</h1>
            <p className="view-header-subtitle">{t('finance.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="view-body insights-body">
        <FinanceView isEmbedded />
      </div>
    </div>
  );
};
