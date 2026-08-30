import { memo } from 'react';
import { Archive, Plus, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import type { Lens } from '../../../../db/schema';
import type { TranslationKey } from '../../../../i18n/translations';
import { EmptyState } from '../../../../components/EmptyState';
import { IconButton } from '../../../../components/ui/IconButton';
import { LensSvgAvatar } from '../../../../components/LensSvgAvatar';
import type { GearSort } from '../shared/gearListUtils';
import { useFilteredGearItems } from '../shared/gearListUtils';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;
interface LensesTabProps {
  lenses: readonly Lens[]; searchQuery: string; sortBy: GearSort; t: Translate; uploadingEntityId: string | null;
  onAdd: () => void; onEdit: (lens: Lens) => void; onDelete: (id: string) => void; onArchive: (lens: Lens) => void; onUpload: (id: string) => void; onPreview: (url: string) => void;
}
const getAvatarUrl = (url?: string | null) => url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null;

export const LensesTab = memo(({ lenses, searchQuery, sortBy, t, uploadingEntityId, onAdd, onEdit, onDelete, onArchive, onUpload, onPreview }: LensesTabProps) => {
  const activeLenses = lenses.filter(lens => lens.status !== 'archived');
  const displayLenses = useFilteredGearItems(activeLenses, searchQuery, sortBy);
  if (activeLenses.length === 0 || displayLenses.length === 0) return <div className="lenses-grid-layout"><div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}><EmptyState icon={SlidersHorizontal} title={activeLenses.length === 0 ? t('gear.noLensTitle') : t('gear.noLensMatch')} description={activeLenses.length === 0 ? t('gear.noLensDesc') : t('gear.noMatchDesc')} action={activeLenses.length === 0 ? <button className="primary" onClick={onAdd}><Plus size={16} /> {t('gear.addLens')}</button> : undefined} /></div></div>;
  return <div className="lenses-grid-layout">{displayLenses.map(lens => {
    const avatarUrl = getAvatarUrl(lens.avatarUrl);
    return <div key={lens.id} className="gear-card gear-row-card" onClick={() => onEdit(lens)} style={{ cursor: 'pointer' }}>
      <button type="button" className="gear-card-open-action" onClick={event => { event.stopPropagation(); onEdit(lens); }} aria-label={`${t('gear.editLens')}: ${lens.name}`} />
      <div className="camera-avatar-container" style={{ width: '80px', height: '80px' }}>
        {avatarUrl ? <img src={avatarUrl} alt={lens.name} className="camera-avatar-img" onClick={event => { event.stopPropagation(); onPreview(avatarUrl); }} title={t('gear.previewCover')} style={{ objectFit: 'cover' }} /> : <div className="lens-card-avatar" style={{ margin: 0 }}><LensSvgAvatar focalLength={lens.focalLength} type={lens.type || 'prime'} size={72} /></div>}
        <button type="button" className="camera-avatar-upload-overlay" onClick={event => { event.stopPropagation(); if (avatarUrl) onPreview(avatarUrl); else onUpload(lens.id!); }} disabled={uploadingEntityId === lens.id} title={avatarUrl ? t('gear.previewCover') : t('gear.uploadLensCover')}>{uploadingEntityId === lens.id ? <span className="avatar-loading-spinner" /> : avatarUrl ? <Search size={14} /> : <Upload size={14} />}</button>
      </div>
      <div className="lens-card-content"><div className="gear-card-header"><span className={`tag lens-${lens.type || 'prime'}`}>{lens.type === 'prime' ? t('gear.prime') : t('gear.zoom')}</span><div style={{ display: 'flex', gap: '8px' }}><IconButton variant="success" icon={<Archive size={16} />} title={t('gear.sellArchive')} onClick={event => { event.stopPropagation(); onArchive(lens); }} /><IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={event => { event.stopPropagation(); onDelete(lens.id!); }} /></div></div><h3>{lens.name}</h3><div className="gear-details"><div><strong>{t('gear.focalLength')}:</strong> {lens.focalLength}mm</div><div><strong>{t('gear.maxAperture')}:</strong> {lens.maxAperture}</div></div></div>
    </div>;
  })}</div>;
});
