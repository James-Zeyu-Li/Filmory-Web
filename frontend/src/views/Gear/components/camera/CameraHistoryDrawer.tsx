import { useState } from 'react';
import {
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
import type { Camera, FilmBack, Roll } from '../../../../db/schema';
import type { TranslationKey } from '../../../../i18n/translations';
import type { CameraHistorySummary } from '../../../../services/gearHistoryService';
import type { CollectionGroup } from '../../../../services/rollCollectionGrouping';
import { Drawer } from '../../../../components/Drawer';
import { EmptyState } from '../../../../components/EmptyState';
import { IconButton } from '../../../../components/ui/IconButton';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface CameraHistoryDrawerProps {
  isOpen: boolean;
  camera: Camera | null;
  summary: CameraHistorySummary | null;
  cameraSystems: readonly { id?: string; name: string }[];
  filmBacks: readonly FilmBack[];
  language: string;
  t: Translate;
  onClose: () => void;
  onEdit: (camera: Camera) => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollections: () => void;
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

export const CameraHistoryDrawer: React.FC<CameraHistoryDrawerProps> = ({
  isOpen,
  camera,
  summary,
  cameraSystems,
  filmBacks,
  language,
  t,
  onClose,
  onEdit,
  onOpenRoll,
  onOpenCollections,
}) => {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);

  const getSystemName = (id?: string) => cameraSystems.find(system => system.id === id)?.name ?? t('gear.unknownSystem');
  const getBackCount = (targetCamera: Camera) => filmBacks.filter(back => (
    back.cameraSystemId === targetCamera.cameraSystemId && back.status !== 'archived'
  )).length;

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
            <button type="button" className="secondary camera-history-enter-project" onClick={onOpenCollections}>
              {t('gear.historyEnterProject')}
            </button>
          </div>
        )}
      </div>
    );
  };

  const avatarUrl = camera ? getAvatarFullUrl(camera.avatarUrl) : null;
  const hasHistory = summary ? summary.linkedRolls.length > 0 : false;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={620}>
      {!camera || !summary ? (
        <section className="camera-history-drawer" role="dialog" aria-modal="true" aria-labelledby="camera-history-unavailable-title">
          <header className="camera-history-drawer-header">
            <h2 id="camera-history-unavailable-title">{t('gear.cameraHistoryUnavailableTitle')}</h2>
            <IconButton icon={<X size={20} />} title={t('gear.closeCameraHistory')} onClick={onClose} />
          </header>
          <div className="camera-history-drawer-content">
            <EmptyState
              icon={CameraIcon}
              title={t('gear.cameraHistoryUnavailableTitle')}
              description={t('gear.cameraHistoryUnavailableDesc')}
            />
          </div>
        </section>
      ) : (
        <section className="camera-history-drawer" role="dialog" aria-modal="true" aria-labelledby="camera-history-title">
          <header className="camera-history-drawer-header">
            <div className="camera-history-identity">
              <div className="camera-history-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <CameraIcon size={22} aria-hidden="true" />}
              </div>
              <div>
                <p className="camera-history-eyebrow">{t('gear.cameraHistoryEyebrow')}</p>
                <h2 id="camera-history-title">{camera.name}</h2>
                <p className="camera-history-subline">
                  {camera.type === 'film' ? t('gear.film') : t('gear.digital')} · {camera.format}
                  {camera.format === '120' && (
                    <> · {camera.backType === 'interchangeable'
                      ? `${getBackCount(camera)} ${t('common.backUnit')} · ${getSystemName(camera.cameraSystemId)}`
                      : t('gear.fixedBack')}</>
                  )}
                </p>
              </div>
            </div>
            <div className="camera-history-drawer-actions">
              <button type="button" className="secondary camera-history-edit-btn" onClick={() => onEdit(camera)}>
                <Edit2 size={16} /> {t('gear.editCamera')}
              </button>
              <IconButton icon={<X size={20} />} title={t('gear.closeCameraHistory')} onClick={onClose} />
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
                icon={CameraIcon}
                title={t('gear.historyEmptyTitle')}
                description={t('gear.historyEmptyDesc')}
              />
            ) : (
              <>
                <section aria-labelledby="camera-history-projects-title">
                  <div className="camera-history-section-heading">
                    <h3 id="camera-history-projects-title"><FolderKanban size={16} /> {t('gear.historyProjectsTitle')}</h3>
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

                <section aria-labelledby="camera-history-unassigned-title">
                  <div className="camera-history-section-heading">
                    <h3 id="camera-history-unassigned-title"><Layers size={16} /> {t('gear.historyUnassignedTitle')}</h3>
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
