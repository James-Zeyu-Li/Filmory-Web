import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ChevronRight, Film, Package, Palette, Play } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { StatCard } from '../../components/ui/StatCard';
import { useCollections, useFilmStocks, useRolls } from '../../hooks/useData';
import { useLanguage } from '../../contexts/useLanguage';
import {
  buildFilmInsightsOverview,
  buildFilmUsageSummaries,
  sortFilmUsageSummaries,
  type FilmInsightSort,
  type FilmUsageSummary,
} from '../../services/filmInsightsService';
import { FilmUsageDetailDrawer } from './FilmUsageDetailDrawer';
import './FilmInsightsView.css';

const formatDate = (value: number | undefined, language: string, fallback: string) => {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(value);
};

interface FilmInsightsViewProps {
  isEmbedded?: boolean;
}

export const FilmInsightsView: React.FC<FilmInsightsViewProps> = ({ isEmbedded = false }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const filmStocks = useFilmStocks();
  const rolls = useRolls();
  const collections = useCollections();
  const [sort, setSort] = useState<FilmInsightSort>('recent');
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);

  const summaries = buildFilmUsageSummaries(filmStocks, rolls, collections);
  const overview = buildFilmInsightsOverview(summaries);
  const sortedSummaries = sortFilmUsageSummaries(summaries, sort);
  const selectedSummary = summaries.find(summary => summary.film.id === selectedFilmId) ?? null;

  const openRoll = (rollId: string) => navigate(`/rolls?tab=all&openRoll=${rollId}`);
  const openCollection = (collectionId: string) => navigate(`/rolls?tab=collections&collectionId=${collectionId}`);
  const openNewRoll = () => navigate('/rolls?newRoll=1');

  const getFilmLabel = (summary: FilmUsageSummary) => `${summary.film.brand} ${summary.film.name}`;

  return (
    <div className={isEmbedded ? 'film-insights-view' : 'main-content film-insights-view'}>
      {!isEmbedded && <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon"><Film size={20} /></div>
          <div className="view-header-text-group">
            <h1>{t('filmInsights.title')}</h1>
            <p className="view-header-subtitle">{t('filmInsights.subtitle')}</p>
          </div>
        </div>
      </header>}

      <div className={`film-insights-body ${isEmbedded ? 'film-insights-body-embedded' : 'view-body'}`}>
        <section className="stat-card-grid" aria-label={t('filmInsights.overviewLabel')}>
          <StatCard
            tone="gold"
            icon={Package}
            label={t('filmInsights.inStock')}
            value={t('filmInsights.rollCount', { count: overview.inventoryCount })}
          />
          <StatCard
            tone="emerald"
            icon={Play}
            label={t('filmInsights.active')}
            value={t('filmInsights.rollCount', { count: overview.activeCount })}
          />
          <StatCard
            icon={Archive}
            label={t('filmInsights.used')}
            value={t('filmInsights.rollCount', { count: overview.completedCount })}
          />
          <StatCard
            icon={Palette}
            label={t('filmInsights.usedByType')}
            value={t('filmInsights.colorBwCounts', { color: overview.colorCompletedCount, bw: overview.bwCompletedCount })}
          />
        </section>

        <section className="film-insights-workspace" aria-labelledby="film-insights-library-title">
          <div className="film-insights-section-heading">
            <div>
              <p className="film-insights-eyebrow">{t('filmInsights.libraryEyebrow')}</p>
              <h2 id="film-insights-library-title">{t('filmInsights.libraryTitle')}</h2>
            </div>
            <label className="film-insights-sort-control">
              <span>{t('filmInsights.sortLabel')}</span>
              <select value={sort} onChange={event => setSort(event.target.value as FilmInsightSort)}>
                <option value="recent">{t('filmInsights.sortRecent')}</option>
                <option value="usage">{t('filmInsights.sortUsage')}</option>
                <option value="stock">{t('filmInsights.sortStock')}</option>
              </select>
            </label>
          </div>

          {sortedSummaries.length === 0 ? (
            <EmptyState icon={Film} title={t('filmInsights.emptyTitle')} description={t('filmInsights.emptyDescription')} />
          ) : (
            <ul className="film-insights-list" aria-label={t('filmInsights.libraryTitle')}>
              {sortedSummaries.map(summary => {
                const label = getFilmLabel(summary);
                const isColor = summary.film.colorType === 'color';

                return (
                  <li key={summary.film.id}>
                    <button
                      type="button"
                      className="film-insights-row"
                      onClick={() => setSelectedFilmId(summary.film.id ?? null)}
                      aria-label={t('filmInsights.openDetails', { name: label })}
                    >
                      <div className={`film-insights-row-mark ${isColor ? 'color' : 'bw'}`} aria-hidden="true"><Film size={18} /></div>
                      <div className="film-insights-row-identity">
                        <div className="film-insights-row-title">
                          <h3>{label}</h3>
                          <span className={`film-insights-type-badge ${isColor ? 'color' : 'bw'}`}>{isColor ? t('filmInsights.color') : t('filmInsights.bw')}</span>
                        </div>
                        <p>ISO {summary.film.iso} · {summary.film.format} · {t('filmInsights.lastUsed', { date: formatDate(summary.lastUsedAt, language, t('filmInsights.neverUsed')) })}</p>
                      </div>
                      <div className="film-insights-row-stats" aria-label={t('filmInsights.rowStatsLabel')}>
                        <span><small>{t('filmInsights.inStock')}</small><strong>{summary.film.stockCount ?? 0}</strong></span>
                        <span><small>{t('filmInsights.used')}</small><strong>{summary.completedRolls.length}</strong></span>
                        <span className={summary.activeRolls.length > 0 ? 'is-active' : ''}><small>{t('filmInsights.active')}</small><strong>{summary.activeRolls.length}</strong></span>
                      </div>
                      <ChevronRight className="film-insights-row-chevron" size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <FilmUsageDetailDrawer
        isOpen={Boolean(selectedSummary)}
        summary={selectedSummary}
        language={language}
        t={t}
        onClose={() => setSelectedFilmId(null)}
        onOpenRoll={openRoll}
        onOpenCollection={openCollection}
        onCreateRoll={openNewRoll}
      />
    </div>
  );
};
