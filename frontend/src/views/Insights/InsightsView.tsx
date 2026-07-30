import React, { useEffect, useState } from 'react';
import { BarChart2, Wallet } from 'lucide-react';
import { StatsView } from '../Stats/StatsView';
import { FinanceView } from '../Finance/FinanceView';
import { INSIGHTS_TAB_KEY } from '../../services/workspacePreferences';
import { useLanguage } from '../../contexts/useLanguage';
import './InsightsView.css';

type InsightsTab = 'stats' | 'finance';

const isInsightsTab = (value: string | null): value is InsightsTab => {
  return value === 'stats' || value === 'finance';
};

export const InsightsView: React.FC<{ enableFilmMode: boolean }> = ({ enableFilmMode }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<InsightsTab>(() => {
    const savedTab = localStorage.getItem(INSIGHTS_TAB_KEY);
    return isInsightsTab(savedTab) ? savedTab : 'stats';
  });

  useEffect(() => {
    localStorage.setItem(INSIGHTS_TAB_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="main-content">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <BarChart2 size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>{t('insights.title')}</h1>
            <p className="view-header-subtitle">{t('insights.subtitle')}</p>
          </div>
        </div>
        <div className="view-header-actions">
          <div className="tab-navigation insights-tab-navigation">
            <button className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
              <BarChart2 size={16} />
              {t('insights.statsTab')}
            </button>
            <button className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
              <Wallet size={16} />
              {t('insights.financeTab')}
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'stats' && <StatsView enableFilmMode={enableFilmMode} isEmbedded />}
      {activeTab === 'finance' && <FinanceView isEmbedded />}
    </div>
  );
};
