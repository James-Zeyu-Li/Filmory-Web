import { useState } from 'react';
import {
  Aperture,
  Archive,
  CalendarDays,
  Camera as CameraIcon,
  ChevronDown,
  CircleDot,
  Edit2,
  FolderKanban,
  Layers,
  X,
} from 'lucide-react';
import type { Camera, Lens, Roll } from '../../../../db/schema';
import type { TranslationKey } from '../../../../i18n/translations';
import type { LensHistorySummary } from '../../../../services/gearHistoryService';
import type { CollectionGroup } from '../../../../services/rollCollectionGrouping';
import { Drawer } from '../../../../components/Drawer';
import { EmptyState } from '../../../../components/EmptyState';
import { IconButton } from '../../../../components/ui/IconButton';
import { UsageChipList } from '../../../../components/ui/UsageChipList';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface LensHistoryDrawerProps {
  isOpen: boolean;
  lens: Lens | null;
  summary: LensHistorySummary | null;
  cameras: readonly Camera[];
  language: string;
  t: Translate;
  onClose: () => void;
  onEdit: (lens: Lens) => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollection: (collectionId: string) => void;
}

const getAvatarFullUrl = (url?: string | null) => (
  url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null
);

const getRollDate = (roll: Roll): number | undefined => roll.endDate ?? roll.startDate;

const formatDate = (value: number | undefined, language: string, fallback: string) => {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(value);
};

const mostRecentDate = (rolls: readonly Roll[]): number | undefined => {
  const dates = rolls.map(getRollDate).filter((value): value is number => Boolean(value));
  return dates.length > 0 ? Math.max(...dates) : undefined;
};

// Reuses the `.camera-history-*` class names verbatim (same shared drawer
// layout as CameraHistoryDrawer) rather than a parallel `.lens-history-*`
// stylesheet — mirrors how `.collection-card` already reuses `.roll-card`'s
// CSS in RollsView instead of duplicating it.
export const LensHistoryDrawer: React.FC<LensHistoryDrawerProps> = ({
  isOpen,
  lens,
  summary,
  cameras,
  language,
  t,
  onClose,
  onEdit,
  onOpenRoll,
  onOpenCollection,
}) => {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  const getCameraLabel = (id: string) => cameras.find(camera => camera.id === id)?.name ?? t('common.unknownCamera');

  const renderRollRow = (roll: Roll) => (
    <div
      key={roll.id}
      role="button"
      tabIndex={0}
      className="camera-history-roll-row"
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
      <span className={`camera-history-roll-status ${roll.status}`}>
        {roll.status === 'active' ? t('rolls.active') : t('rolls.archived')}
      </span>
    </div>
  );

  const renderProjectRow = (group: CollectionGroup) => {
    const isExpanded = expandedCollectionId === group.collection.id;
    const activeCount = group.rolls.filter(roll => roll.status === 'active').length;
    const archivedCount = group.rolls.filter(roll => roll.status === 'archived').length;

    return (
      <div className="camera-history-project-group" key={group.collection.id}>
        <button
          type="button"
          className="camera-history-project-row"
          aria-expanded={isExpanded}
          onClick={() => setExpandedCollectionId(isExpanded ? null : (group.collection.id ?? null))}
        >
          <FolderKanban size={18} aria-hidden="true" />
          <div className="camera-history-project-identity">
            <h4>{group.collection.name}</h4>
            <p>
              {t('gear.historyProjectMeta', {
                count: group.rolls.length,
                date: formatDate(mostRecentDate(group.rolls), language, t('filmInsights.noDate')),
              })}
            </p>
          </div>
          <span className="camera-history-project-status">
            {t('rolls.active')} {activeCount} · {t('rolls.archived')} {archivedCount}
          </span>
          <ChevronDown size={16} className={`camera-history-project-chevron ${isExpanded ? 'is-expanded' : ''}`} aria-hidden="true" />
        </button>
        {isExpanded && (
          <div className="camera-history-project-expanded">
            <div className="camera-history-roll-list">
              {group.rolls.map(renderRollRow)}
            </div>
            <button type="button" className="secondary camera-history-enter-project" onClick={() => onOpenCollection(group.collection.id!)}>
              {t('gear.historyEnterProject')}
            </button>
          </div>
        )}
      </div>
    );
  };

  const avatarUrl = lens ? getAvatarFullUrl(lens.avatarUrl) : null;
  const hasHistory = summary ? summary.linkedRolls.length > 0 : false;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={620}>
      {!lens || !summary ? (
        <section className="camera-history-drawer" role="dialog" aria-modal="true" aria-labelledby="lens-history-unavailable-title">
          <header className="camera-history-drawer-header">
            <h2 id="lens-history-unavailable-title">{t('gear.lensHistoryUnavailableTitle')}</h2>
            <IconButton icon={<X size={20} />} title={t('gear.closeLensHistory')} onClick={onClose} />
          </header>
          <div className="camera-history-drawer-content">
            <EmptyState
              icon={Aperture}
              title={t('gear.lensHistoryUnavailableTitle')}
              description={t('gear.lensHistoryUnavailableDesc')}
            />
          </div>
        </section>
      ) : (
        <section className="camera-history-drawer" role="dialog" aria-modal="true" aria-labelledby="lens-history-title">
          <header className="camera-history-drawer-header">
            <div className="camera-history-identity">
              <div className="camera-history-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <Aperture size={22} aria-hidden="true" />}
              </div>
              <div>
                <p className="camera-history-eyebrow">{t('gear.lensHistoryEyebrow')}</p>
                <h2 id="lens-history-title">{lens.name}</h2>
                <p className="camera-history-subline">
                  {lens.type === 'prime' ? t('gear.prime') : t('gear.zoom')} · {lens.focalLength}mm · {lens.maxAperture}
                </p>
              </div>
            </div>
            <div className="camera-history-drawer-actions">
              <button type="button" className="secondary camera-history-edit-btn" onClick={() => onEdit(lens)}>
                <Edit2 size={16} /> {t('gear.editLens')}
              </button>
              <IconButton icon={<X size={20} />} title={t('gear.closeLensHistory')} onClick={onClose} />
            </div>
          </header>

          <div className="camera-history-drawer-content">
            <div className="camera-history-metrics">
              <div><span>{t('gear.historyTotalRecords')}</span><strong>{summary.linkedRolls.length}</strong></div>
              <div><span>{t('rolls.active')}</span><strong>{summary.activeRolls.length}</strong></div>
              <div><span>{t('rolls.archived')}</span><strong>{summary.completedRolls.length}</strong></div>
              <div><span>{t('gear.historyProjectCount')}</span><strong>{summary.collectionGroups.length}</strong></div>
              <div><span>{t('gear.historyLastUsed')}</span><strong>{formatDate(summary.lastUsedAt, language, t('filmInsights.neverUsed'))}</strong></div>
            </div>

            {!hasHistory ? (
              <EmptyState
                icon={Aperture}
                title={t('gear.historyEmptyTitle')}
                description={t('gear.lensHistoryEmptyDesc')}
              />
            ) : (
              <>
                <section aria-labelledby="lens-history-cameras-title">
                  <div className="camera-history-section-heading">
                    <h3 id="lens-history-cameras-title"><CameraIcon size={16} /> {t('gear.historyCamerasTitle')}</h3>
                  </div>
                  {summary.cameraUsage.length === 0 ? (
                    <p className="camera-history-empty-inline">{t('gear.historyNoCameras')}</p>
                  ) : (
                    <UsageChipList
                      items={summary.cameraUsage.map(usage => ({ id: usage.id, label: getCameraLabel(usage.id), count: usage.count }))}
                      t={t}
                    />
                  )}
                </section>

                <section aria-labelledby="lens-history-projects-title">
                  <div className="camera-history-section-heading">
                    <h3 id="lens-history-projects-title"><FolderKanban size={16} /> {t('gear.historyProjectsTitle')}</h3>
                    <span>{summary.collectionGroups.length}</span>
                  </div>
                  {summary.collectionGroups.length === 0 ? (
                    <p className="camera-history-empty-inline">{t('gear.historyNoProjects')}</p>
                  ) : (
                    <div className="camera-history-project-list">
                      {summary.collectionGroups.map(renderProjectRow)}
                    </div>
                  )}
                </section>

                <section aria-labelledby="lens-history-unassigned-title">
                  <div className="camera-history-section-heading">
                    <h3 id="lens-history-unassigned-title"><Layers size={16} /> {t('gear.historyUnassignedTitle')}</h3>
                    <span>{summary.unassignedRolls.length}</span>
                  </div>
                  {summary.unassignedRolls.length === 0 ? (
                    <p className="camera-history-empty-inline">{t('gear.historyNoUnassigned')}</p>
                  ) : (
                    <div className="camera-history-roll-list">
                      {summary.unassignedRolls.map(renderRollRow)}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </section>
      )}
    </Drawer>
  );
};
