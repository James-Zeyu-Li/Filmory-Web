import { useState } from 'react';
import { Archive, CalendarDays, ChevronRight, CircleDot, Film, Package, Palette, Play, X } from 'lucide-react';
import { Drawer } from '../../components/Drawer';
import { EmptyState } from '../../components/EmptyState';
import { useFilmStocks, useRolls } from '../../hooks/useData';
import { useLanguage } from '../../contexts/useLanguage';
import {
  buildFilmInsightsOverview,
  buildFilmUsageSummaries,
  sortFilmUsageSummaries,
  type FilmInsightSort,
  type FilmUsageSummary,
} from '../../services/filmInsightsService';
import './FilmInsightsView.css';

const formatDate = (value: number | undefined, language: string, fallback: string) => {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(value);
};

export const FilmInsightsView: React.FC = () => {
  const { language, t } = useLanguage();
  const filmStocks = useFilmStocks();
  const rolls = useRolls();
  const [sort, setSort] = useState<FilmInsightSort>('recent');
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);

  const summaries = buildFilmUsageSummaries(filmStocks, rolls);
  const overview = buildFilmInsightsOverview(summaries);
  const sortedSummaries = sortFilmUsageSummaries(summaries, sort);
  const selectedSummary = summaries.find(summary => summary.film.id === selectedFilmId) ?? null;

  const getFilmLabel = (summary: FilmUsageSummary) => `${summary.film.brand} ${summary.film.name}`;
  const getRollDate = (roll: FilmUsageSummary['activeRolls'][number]) => roll.endDate ?? roll.startDate;

  return (
    <div className="main-content film-insights-view">
      <header className="view-header">
        <div className="view-header-title-container">
          <div className="view-header-icon"><Film size={20} /></div>
          <div className="view-header-text-group">
            <h1>{t('filmInsights.title')}</h1>
            <p className="view-header-subtitle">{t('filmInsights.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="view-body film-insights-body">
        <section className="film-insights-overview" aria-label={t('filmInsights.overviewLabel')}>
          <article className="film-insights-metric film-insights-metric-accent">
            <Package size={18} aria-hidden="true" />
            <div><span>{t('filmInsights.inStock')}</span><strong>{t('filmInsights.rollCount', { count: overview.inventoryCount })}</strong></div>
          </article>
          <article className="film-insights-metric film-insights-metric-active">
            <Play size={18} aria-hidden="true" />
            <div><span>{t('filmInsights.active')}</span><strong>{t('filmInsights.rollCount', { count: overview.activeCount })}</strong></div>
          </article>
          <article className="film-insights-metric">
            <Archive size={18} aria-hidden="true" />
            <div><span>{t('filmInsights.used')}</span><strong>{t('filmInsights.rollCount', { count: overview.completedCount })}</strong></div>
          </article>
          <article className="film-insights-metric film-insights-metric-split">
            <Palette size={18} aria-hidden="true" />
            <div><span>{t('filmInsights.usedByType')}</span><strong>{t('filmInsights.colorBwCounts', { color: overview.colorCompletedCount, bw: overview.bwCompletedCount })}</strong></div>
          </article>
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

      <Drawer isOpen={Boolean(selectedSummary)} onClose={() => setSelectedFilmId(null)} width={580}>
        {selectedSummary && (
          <section className="film-insights-drawer" role="dialog" aria-modal="true" aria-labelledby="film-insights-detail-title">
            <header className="film-insights-drawer-header">
              <div>
                <p className="film-insights-eyebrow">{t('filmInsights.detailEyebrow')}</p>
                <h2 id="film-insights-detail-title">{getFilmLabel(selectedSummary)}</h2>
                <p>ISO {selectedSummary.film.iso} · {selectedSummary.film.format} · {selectedSummary.film.colorType === 'color' ? t('filmInsights.color') : t('filmInsights.bw')}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedFilmId(null)} aria-label={t('filmInsights.closeDetails')}><X size={20} /></button>
            </header>

            <div className="film-insights-drawer-content">
              <div className="film-insights-detail-metrics">
                <div><span>{t('filmInsights.inStock')}</span><strong>{selectedSummary.film.stockCount ?? 0}</strong></div>
                <div><span>{t('filmInsights.used')}</span><strong>{selectedSummary.completedRolls.length}</strong></div>
                <div><span>{t('filmInsights.active')}</span><strong>{selectedSummary.activeRolls.length}</strong></div>
              </div>

              <section aria-labelledby="film-insights-active-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-active-title"><Play size={16} /> {t('filmInsights.activeRolls')}</h3><span>{selectedSummary.activeRolls.length}</span></div>
                {selectedSummary.activeRolls.length === 0 ? <p className="film-insights-empty-inline">{t('filmInsights.noActiveRolls')}</p> : (
                  <div className="film-insights-roll-list">
                    {selectedSummary.activeRolls.map(roll => <div className="film-insights-roll-row" key={roll.id}><CircleDot size={16} aria-hidden="true" /><div><strong>{roll.name}</strong><span><CalendarDays size={13} /> {formatDate(getRollDate(roll), language, t('filmInsights.noDate'))}</span></div></div>)}
                  </div>
                )}
              </section>

              <section aria-labelledby="film-insights-history-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-history-title"><Archive size={16} /> {t('filmInsights.history')}</h3><span>{selectedSummary.completedRolls.length}</span></div>
                {selectedSummary.completedRolls.length === 0 ? <p className="film-insights-empty-inline">{t('filmInsights.noHistory')}</p> : (
                  <div className="film-insights-roll-list">
                    {selectedSummary.completedRolls.map(roll => <div className="film-insights-roll-row" key={roll.id}><Archive size={16} aria-hidden="true" /><div><strong>{roll.name}</strong><span><CalendarDays size={13} /> {formatDate(getRollDate(roll), language, t('filmInsights.noDate'))}</span></div></div>)}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}
      </Drawer>
    </div>
  );
};
