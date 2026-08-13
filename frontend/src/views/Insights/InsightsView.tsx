import React from 'react';
import { BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FinanceView } from '../Finance/FinanceView';
import { FilmInsightsView } from '../FilmInsights/FilmInsightsView';
import { StatsView } from '../Stats/StatsView';
import { useLanguage } from '../../contexts/useLanguage';
import { PageTabs } from '../../components/ui/PageTabs';
import './InsightsView.css';

interface InsightsViewProps {
  enableFilmMode: boolean;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ enableFilmMode }) => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'spending'
    ? 'spending'
    : searchParams.get('tab') === 'film'
      ? 'film'
      : 'shooting';
  const selectTab = (tab: 'shooting' | 'spending' | 'film') => {
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
        <PageTabs
          className="insights-tabs"
          tabs={[
            { id: 'shooting', label: t('insights.shootingTab') },
            { id: 'spending', label: t('insights.spendingTab') },
            { id: 'film', label: t('insights.filmTab') },
          ] as const}
          activeId={activeTab}
          onChange={selectTab}
          ariaLabel={t('insights.title')}
          idPrefix="insights"
        />
        <div
          id={`insights-${activeTab}-panel`}
          className="insights-tab-panel"
          role="tabpanel"
          aria-labelledby={`insights-${activeTab}-tab`}
        >
          {activeTab === 'shooting' && <StatsView enableFilmMode={enableFilmMode} isEmbedded />}
          {activeTab === 'spending' && <FinanceView isEmbedded />}
          {activeTab === 'film' && <FilmInsightsView isEmbedded />}
        </div>
      </div>
    </div>
  );
};
