import { memo } from 'react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { OtherEquipment } from '../../../db/schema';
import type { TranslationKey } from '../../../i18n/translations';
import { EmptyState } from '../../../components/EmptyState';
import { IconButton } from '../../../components/ui/IconButton';
import type { GearSort } from './gearListUtils';
import { useFilteredGearItems } from './gearListUtils';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;
interface OtherEquipmentTabProps { equipment: readonly OtherEquipment[]; searchQuery: string; sortBy: GearSort; nowTimestamp: number; t: Translate; onAdd: () => void; onEdit: (equipment: OtherEquipment) => void; onDelete: (id: string) => void; }
export const OtherEquipmentTab = memo(({ equipment, searchQuery, sortBy, nowTimestamp, t, onAdd, onEdit, onDelete }: OtherEquipmentTabProps) => {
  const displayEquipment = useFilteredGearItems(equipment, searchQuery, sortBy);
  return <><div className="gear-context-note">{t('gear.otherContextNote')}</div><div className="grid-layout">{equipment.length === 0 || displayEquipment.length === 0 ? <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}><EmptyState icon={SlidersHorizontal} title={equipment.length === 0 ? t('gear.noOtherTitle') : t('gear.noOtherMatch')} description={equipment.length === 0 ? t('gear.noOtherDesc') : t('gear.noMatchDesc')} action={equipment.length === 0 ? <button className="primary" onClick={onAdd}><Plus size={16} /> {t('gear.registerAccessory')}</button> : undefined} /></div> : displayEquipment.map(item => { const expired = item.type === 'chemical' && Boolean(item.expiryDate && item.expiryDate < nowTimestamp); return <div key={item.id} className={`gear-card equipment-card ${expired ? 'expired-alert' : ''}`} onClick={() => onEdit(item)} style={{ cursor: 'pointer' }}><div className="gear-card-header"><span className={`tag eq-${item.type}`}>{item.type === 'chemical' ? t('gear.chemical') : item.type === 'tripod' ? t('gear.tripod') : item.type === 'cleaner' ? t('gear.cleaner') : t('gear.otherType')}</span>{expired && <span className="tag expired-tag">{t('gear.expired')}</span>}<IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={event => { event.stopPropagation(); onDelete(item.id!); }} /></div><h3>{item.name}</h3><div className="gear-details">{item.purchaseDate && <div><strong>{t('gear.purchaseDate')}:</strong> {new Date(item.purchaseDate).toLocaleDateString()}</div>}{item.type === 'chemical' && item.expiryDate && <div className={expired ? 'expired-text' : ''}><strong>{t('gear.expiryDate')}:</strong> {new Date(item.expiryDate).toLocaleDateString()}</div>}{item.notes && <div><strong>{t('gear.notes')}:</strong> {item.notes}</div>}</div></div>; })}</div></>;
});
