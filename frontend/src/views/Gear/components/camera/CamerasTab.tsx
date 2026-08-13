import { memo } from 'react';
import { Archive, Camera as CameraIcon, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { Camera, FilmBack } from '../../../../db/schema';
import type { TranslationKey } from '../../../../i18n/translations';
import { EmptyState } from '../../../../components/EmptyState';
import { IconButton } from '../../../../components/ui/IconButton';
import type { GearSort } from '../shared/gearListUtils';
import { useFilteredGearItems } from '../shared/gearListUtils';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface CamerasTabProps {
  cameras: readonly Camera[];
  cameraSystems: readonly { id?: string; name: string }[];
  filmBacks: readonly FilmBack[];
  searchQuery: string;
  sortBy: GearSort;
  t: Translate;
  uploadingEntityId: string | null;
  onAdd: () => void;
  onEdit: (camera: Camera) => void;
  onDelete: (id: string) => void;
  onArchive: (camera: Camera) => void;
  onUpload: (id: string) => void;
  onPreview: (url: string) => void;
}

const getAvatarFullUrl = (url?: string | null) => (
  url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null
);

const getPlaceholderText = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed;
  const parts = trimmed.split(/\s+/);
  const model = parts.length > 1 ? parts.slice(1).join(' ') : trimmed;
  return model.length <= 10 ? model : `${model.slice(0, 9)}...`;
};

export const CamerasTab = memo(({
  cameras,
  cameraSystems,
  filmBacks,
  searchQuery,
  sortBy,
  t,
  uploadingEntityId,
  onAdd,
  onEdit,
  onDelete,
  onArchive,
  onUpload,
  onPreview,
}: CamerasTabProps) => {
  const activeCameras = cameras.filter(camera => camera.status !== 'archived');
  const displayCameras = useFilteredGearItems(activeCameras, searchQuery, sortBy);
  const getSystemName = (id?: string) => cameraSystems.find(system => system.id === id)?.name ?? t('gear.unknownSystem');
  const getBackCount = (camera: Camera) => filmBacks.filter(back => (
    back.cameraSystemId === camera.cameraSystemId && back.status !== 'archived'
  )).length;

  if (activeCameras.length === 0 || displayCameras.length === 0) {
    return (
      <div className="cameras-grid-layout">
        <div style={{ height: '50vh', gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
          <EmptyState
            icon={CameraIcon}
            title={activeCameras.length === 0 ? t('gear.noCameraTitle') : t('gear.noCameraMatch')}
            description={activeCameras.length === 0 ? t('gear.noCameraDesc') : t('gear.noMatchDesc')}
            action={activeCameras.length === 0 ? <button className="primary" onClick={onAdd}><Plus size={16} /> {t('gear.addCamera')}</button> : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cameras-grid-layout">
      {displayCameras.map(camera => {
        const avatarUrl = getAvatarFullUrl(camera.avatarUrl);
        return (
          <div key={camera.id} className="gear-card camera-card-with-avatar" onClick={() => onEdit(camera)} style={{ cursor: 'pointer' }}>
            <div className="camera-avatar-container">
              {avatarUrl ? <img src={avatarUrl} alt={camera.name} className="camera-avatar-img" onClick={event => { event.stopPropagation(); onPreview(avatarUrl); }} title={t('gear.previewCover')} /> : <div className="camera-avatar-placeholder">{getPlaceholderText(camera.name)}</div>}
              <button type="button" className="camera-avatar-upload-overlay" onClick={event => { event.stopPropagation(); if (avatarUrl) onPreview(avatarUrl); else onUpload(camera.id!); }} disabled={uploadingEntityId === camera.id} title={avatarUrl ? t('gear.previewCover') : t('gear.uploadCameraCover')}>
                {uploadingEntityId === camera.id ? <span className="avatar-loading-spinner" /> : avatarUrl ? <Search size={14} /> : <Upload size={14} />}
              </button>
            </div>
            <div className="camera-card-content">
              <div className="gear-card-header">
                <span className={`tag ${camera.type}`}>{camera.type === 'film' ? t('gear.film') : t('gear.digital')}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <IconButton variant="success" icon={<Archive size={16} />} title={t('gear.sellArchive')} onClick={event => { event.stopPropagation(); onArchive(camera); }} />
                  <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={event => { event.stopPropagation(); onDelete(camera.id!); }} />
                </div>
              </div>
              <h3>{camera.name}</h3>
              <div className="gear-details">
                <div><strong>{t('gear.format')}:</strong> {camera.format}</div>
                {camera.format === '120' && <div><strong>{t('gear.back')}:</strong> {camera.backType === 'interchangeable' ? `${getBackCount(camera)} ${t('common.backUnit')} · ${getSystemName(camera.cameraSystemId)}` : t('gear.fixedBack')}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
