import React, { useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FinanceView } from '../Finance/FinanceView';
import { FilmInsightsView } from '../FilmInsights/FilmInsightsView';
import { StatsView } from '../Stats/StatsView';
import { useLanguage } from '../../contexts/useLanguage';
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
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (tab: 'shooting' | 'spending' | 'film') => {
    setSearchParams({ tab });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const tabOrder: Array<'shooting' | 'spending' | 'film'> = ['shooting', 'spending', 'film'];
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabOrder.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabOrder.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    selectTab(tabOrder[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
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
            aria-controls="insights-shooting-panel"
            aria-selected={activeTab === 'shooting'}
            tabIndex={activeTab === 'shooting' ? 0 : -1}
            ref={element => { tabRefs.current[0] = element; }}
            onClick={() => selectTab('shooting')}
            onKeyDown={event => handleTabKeyDown(event, 0)}
          >
            {t('insights.shootingTab')}
          </button>
          <button
            type="button"
            className={activeTab === 'spending' ? 'active' : ''}
            role="tab"
            id="insights-spending-tab"
            aria-controls="insights-spending-panel"
            aria-selected={activeTab === 'spending'}
            tabIndex={activeTab === 'spending' ? 0 : -1}
            ref={element => { tabRefs.current[1] = element; }}
            onClick={() => selectTab('spending')}
            onKeyDown={event => handleTabKeyDown(event, 1)}
          >
            {t('insights.spendingTab')}
          </button>
          <button
            type="button"
            className={activeTab === 'film' ? 'active' : ''}
            role="tab"
            id="insights-film-tab"
            aria-controls="insights-film-panel"
            aria-selected={activeTab === 'film'}
            tabIndex={activeTab === 'film' ? 0 : -1}
            ref={element => { tabRefs.current[2] = element; }}
            onClick={() => selectTab('film')}
            onKeyDown={event => handleTabKeyDown(event, 2)}
          >
            {t('insights.filmTab')}
          </button>
        </div>
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
