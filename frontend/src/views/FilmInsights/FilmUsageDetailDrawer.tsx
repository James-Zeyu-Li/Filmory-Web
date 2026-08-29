import { useState } from 'react';
import {
  Archive,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Film,
  FolderKanban,
  Layers,
  Play,
  X,
} from 'lucide-react';
import type { Roll } from '../../db/schema';
import type { TranslationKey } from '../../i18n/translations';
import type { CollectionGroup } from '../../services/rollCollectionGrouping';
import type { FilmUsageSummary } from '../../services/filmInsightsService';
import { Drawer } from '../../components/Drawer';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/ui/IconButton';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface FilmUsageDetailDrawerProps {
  isOpen: boolean;
  summary: FilmUsageSummary | null;
  language: string;
  t: Translate;
  onClose: () => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollection: (collectionId: string) => void;
  onCreateRoll: () => void;
}

const formatDate = (value: number | undefined, language: string, fallback: string) => {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(value);
};

const getRollDate = (roll: Roll): number | undefined => roll.endDate ?? roll.startDate;

const mostRecentDate = (rolls: readonly Roll[]): number | undefined => {
  const dates = rolls.map(getRollDate).filter((value): value is number => Boolean(value));
  return dates.length > 0 ? Math.max(...dates) : undefined;
};

export const FilmUsageDetailDrawer: React.FC<FilmUsageDetailDrawerProps> = ({
  isOpen,
  summary,
  language,
  t,
  onClose,
  onOpenRoll,
  onOpenCollection,
  onCreateRoll,
}) => {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  if (!summary) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} width={580}>
        <section className="film-insights-drawer" role="dialog" aria-modal="true" aria-labelledby="film-insights-unavailable-title">
          <header className="film-insights-drawer-header">
            <h2 id="film-insights-unavailable-title">{t('filmInsights.detailEyebrow')}</h2>
            <IconButton icon={<X size={20} />} title={t('filmInsights.closeDetails')} onClick={onClose} />
          </header>
          <div className="film-insights-drawer-content">
            <EmptyState icon={Film} title={t('filmInsights.emptyTitle')} description={t('filmInsights.emptyDescription')} />
          </div>
        </section>
      </Drawer>
    );
  }

  const label = `${summary.film.brand} ${summary.film.name}`;
  const hasUsage = summary.activeRolls.length > 0 || summary.completedRolls.length > 0;

  const renderRollRow = (roll: Roll) => (
    <div
      key={roll.id}
      role="button"
      tabIndex={0}
      className="film-insights-roll-row film-insights-roll-row-clickable"
      onClick={() => onOpenRoll(roll.id!)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenRoll(roll.id!);
        }
      }}
      aria-label={t('rolls.openDetails', { name: roll.name })}
    >
      {roll.status === 'active' ? <CircleDot size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
      <div>
        <strong>{roll.name}</strong>
        <span><CalendarDays size={13} /> {formatDate(getRollDate(roll), language, t('filmInsights.noDate'))}</span>
      </div>
    </div>
  );

  const renderProjectRow = (group: CollectionGroup) => {
    const isExpanded = expandedCollectionId === group.collection.id;
    const activeCount = group.rolls.filter(roll => roll.status === 'active').length;
    const archivedCount = group.rolls.filter(roll => roll.status === 'archived').length;

    return (
      <div className="film-insights-project-group" key={group.collection.id}>
        <button
          type="button"
          className="film-insights-project-row"
          aria-expanded={isExpanded}
          onClick={() => setExpandedCollectionId(isExpanded ? null : (group.collection.id ?? null))}
        >
          <FolderKanban size={18} aria-hidden="true" />
          <div className="film-insights-project-identity">
            <h4>{group.collection.name}</h4>
            <p>
              {t('filmInsights.projectMeta', {
                count: group.rolls.length,
                date: formatDate(mostRecentDate(group.rolls), language, t('filmInsights.noDate')),
              })}
            </p>
          </div>
          <span className="film-insights-project-status">
            {t('rolls.active')} {activeCount} · {t('rolls.archived')} {archivedCount}
          </span>
          <ChevronDown size={16} className={`film-insights-project-chevron ${isExpanded ? 'is-expanded' : ''}`} aria-hidden="true" />
        </button>
        {isExpanded && (
          <div className="film-insights-project-expanded">
            <div className="film-insights-roll-list">
              {group.rolls.map(renderRollRow)}
            </div>
            <button type="button" className="secondary film-insights-enter-project" onClick={() => onOpenCollection(group.collection.id!)}>
              {t('filmInsights.enterProject')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={580}>
      <section className="film-insights-drawer" role="dialog" aria-modal="true" aria-labelledby="film-insights-detail-title">
        <header className="film-insights-drawer-header">
          <div>
            <p className="film-insights-eyebrow">{t('filmInsights.detailEyebrow')}</p>
            <h2 id="film-insights-detail-title">{label}</h2>
            <p>ISO {summary.film.iso} · {summary.film.format} · {summary.film.colorType === 'color' ? t('filmInsights.color') : t('filmInsights.bw')}</p>
          </div>
          <IconButton icon={<X size={20} />} title={t('filmInsights.closeDetails')} onClick={onClose} />
        </header>

        <div className="film-insights-drawer-content">
          <div className="film-insights-detail-metrics">
            <div><span>{t('filmInsights.inStock')}</span><strong>{summary.film.stockCount ?? 0}</strong></div>
            <div><span>{t('filmInsights.used')}</span><strong>{summary.completedRolls.length}</strong></div>
            <div><span>{t('filmInsights.active')}</span><strong>{summary.activeRolls.length}</strong></div>
          </div>

          {!hasUsage ? (
            <EmptyState
              icon={Film}
              title={t('filmInsights.emptyUsageTitle')}
              description={t('filmInsights.emptyUsageDesc')}
              action={<button type="button" className="primary" onClick={onCreateRoll}>{t('filmInsights.newRollAction')}</button>}
            />
          ) : (
            <>
              <section aria-labelledby="film-insights-active-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-active-title"><Play size={16} /> {t('filmInsights.activeRolls')}</h3><span>{summary.activeRolls.length}</span></div>
                {summary.activeRolls.length === 0 ? <p className="film-insights-empty-inline">{t('filmInsights.noActiveRolls')}</p> : (
                  <div className="film-insights-roll-list">
                    {summary.activeRolls.map(renderRollRow)}
                  </div>
                )}
              </section>

              <section aria-labelledby="film-insights-history-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-history-title"><Archive size={16} /> {t('filmInsights.history')}</h3><span>{summary.completedRolls.length}</span></div>
                {summary.completedRolls.length === 0 ? <p className="film-insights-empty-inline">{t('filmInsights.noHistory')}</p> : (
                  <div className="film-insights-roll-list">
                    {summary.completedRolls.map(renderRollRow)}
                  </div>
                )}
              </section>

              <section aria-labelledby="film-insights-projects-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-projects-title"><FolderKanban size={16} /> {t('filmInsights.projectsTitle')}</h3><span>{summary.collectionGroups.length}</span></div>
                {summary.collectionGroups.length === 0 ? (
                  <p className="film-insights-empty-inline">{t('filmInsights.noProjects')}</p>
                ) : (
                  <div className="film-insights-project-list">
                    {summary.collectionGroups.map(renderProjectRow)}
                  </div>
                )}
              </section>

              <section aria-labelledby="film-insights-unassigned-title">
                <div className="film-insights-drawer-section-heading"><h3 id="film-insights-unassigned-title"><Layers size={16} /> {t('filmInsights.unassignedTitle')}</h3><span>{summary.unassignedRolls.length}</span></div>
                {summary.unassignedRolls.length === 0 ? (
                  <p className="film-insights-empty-inline">{t('filmInsights.noUnassigned')}</p>
                ) : (
                  <div className="film-insights-roll-list">
                    {summary.unassignedRolls.map(renderRollRow)}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </Drawer>
  );
};
