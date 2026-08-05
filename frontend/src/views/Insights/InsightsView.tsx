import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FinanceView } from '../Finance/FinanceView';
import { StatsView } from '../Stats/StatsView';
import { useLanguage } from '../../contexts/useLanguage';
import './InsightsView.css';

interface InsightsViewProps {
  enableFilmMode: boolean;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ enableFilmMode }) => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'spending' ? 'spending' : 'shooting';

  const selectTab = (tab: 'shooting' | 'spending') => {
    setSearchParams({ tab });
  };

  return (
    <div className="main-content insights-page">
      {/* Unified Header */}
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <BarChart3 size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>{t('insights.title')}</h1>
            <p className="view-header-subtitle">{t('insights.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="view-body insights-body">
        <div className="insights-tabs" role="tablist" aria-label={t('insights.title')}>
          <button
            type="button"
            className={activeTab === 'shooting' ? 'active' : ''}
            role="tab"
            id="insights-shooting-tab"
            aria-controls="insights-tab-panel"
            aria-selected={activeTab === 'shooting'}
            onClick={() => selectTab('shooting')}
          >
            {t('insights.shootingTab')}
          </button>
          <button
            type="button"
            className={activeTab === 'spending' ? 'active' : ''}
            role="tab"
            id="insights-spending-tab"
            aria-controls="insights-tab-panel"
            aria-selected={activeTab === 'spending'}
            onClick={() => selectTab('spending')}
          >
            {t('insights.spendingTab')}
          </button>
        </div>
        <div
          id="insights-tab-panel"
          className="insights-tab-panel"
          role="tabpanel"
          aria-labelledby={`insights-${activeTab}-tab`}
        >
          {activeTab === 'shooting'
            ? <StatsView enableFilmMode={enableFilmMode} isEmbedded />
            : <FinanceView isEmbedded />}
        </div>
      </div>
    </div>
  );
};
