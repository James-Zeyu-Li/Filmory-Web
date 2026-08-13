import { useState, type FormEvent } from 'react';
import { Package } from 'lucide-react';
import { Modal } from '../../../../components/Modal';
import { useCurrency } from '../../../../contexts/useCurrency';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { OtherEquipment } from '../../../../db/schema';
import type { GearAvatarTableName } from '../../../../services/gearAvatarService';
import { useGearActions } from '../../hooks/useGearActions';
import { GearAvatarEditor } from '../shared/GearAvatarEditor';

interface OtherEquipmentFormModalProps {
  isOpen: boolean;
  editingEquipment: OtherEquipment | null;
  equipment: readonly OtherEquipment[];
  keepModalOpen: boolean;
  uploadingEntityId: string | null;
  onKeepModalOpenChange: (value: boolean) => void;
  onClose: () => void;
  onPreview: (url?: string | null) => void;
  onUpload: (id: string, type: GearAvatarTableName) => void;
  onRemoveAvatar: (id: string, type: GearAvatarTableName, label: string) => void;
}

const createDefaultDraft = (): Partial<OtherEquipment> => ({
  name: '',
  type: 'chemical',
  notes: '',
  purchaseDate: undefined,
  expiryDate: undefined,
  purchasePrice: undefined,
});

const formatDateInput = (timestamp?: number) => (
  timestamp ? new Date(timestamp).toISOString().substring(0, 10) : ''
);

export const OtherEquipmentFormModal = ({
  isOpen,
  editingEquipment,
  equipment,
  keepModalOpen,
  uploadingEntityId,
  onKeepModalOpenChange,
  onClose,
  onPreview,
  onUpload,
  onRemoveAvatar,
}: OtherEquipmentFormModalProps) => {
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const gearActions = useGearActions();
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(editingEquipment?.id || null);
  const [draft, setDraft] = useState<Partial<OtherEquipment>>(() => editingEquipment || createDefaultDraft());

  const currentEditingEquipment = editingEquipmentId
    ? equipment.find(item => item.id === editingEquipmentId) || editingEquipment
    : null;
  const avatarUrl = editingEquipmentId
    ? currentEditingEquipment?.avatarUrl
    : draft.avatarUrl;

  const resetForm = () => {
    setEditingEquipmentId(null);
    setDraft(createDefaultDraft());
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name) return;

    const result = await gearActions.saveOtherEquipment({
      draft,
      editingId: editingEquipmentId,
      existingEquipment: equipment,
    });
    if (result === 'trial-blocked') {
      onClose();
      return;
    }
    if (result !== 'saved') return;

    resetForm();
    if (!keepModalOpen) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3>{editingEquipmentId ? t('gear.editGear') : t('gear.otherModalTitle')}</h3>
      <form onSubmit={handleSave}>
        <div className="gear-context-note">{t('gear.otherModalNote')}</div>

        <GearAvatarEditor
          id={editingEquipmentId}
          type="otherEquipments"
          avatarUrl={avatarUrl}
          label={draft.name || t('gear.addGear')}
          placeholder={<Package size={34} />}
          uploading={uploadingEntityId === editingEquipmentId}
          t={t}
          onPreview={url => onPreview(url)}
          onUpload={onUpload}
          onRemove={onRemoveAvatar}
        />

        <div className="form-group">
          <label>{t('gear.gearName')}</label>
          <input
            type="text"
            className="form-control"
            placeholder={t('gear.gearNamePlaceholder')}
            value={draft.name || ''}
            onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))}
            required
          />
        </div>
        <div className="form-group">
          <label>{t('gear.gearType')}</label>
          <select
            className="form-control"
            value={draft.type || 'chemical'}
            onChange={event => setDraft(previous => ({
              ...previous,
              type: event.target.value as OtherEquipment['type'],
            }))}
            required
          >
            <option value="chemical">{t('gear.chemical')}</option>
            <option value="tripod">{t('gear.tripod')}</option>
            <option value="cleaner">{t('gear.cleaner')}</option>
            <option value="other">{t('gear.otherType')}</option>
          </select>
        </div>
        <div className="form-group">
          <label>{t('gear.purchaseDate')}</label>
          <input
            type="date"
            className="form-control"
            value={formatDateInput(draft.purchaseDate)}
            onChange={event => setDraft(previous => ({
              ...previous,
              purchaseDate: event.target.value ? new Date(event.target.value).getTime() : undefined,
            }))}
          />
        </div>
        {draft.type === 'chemical' && (
          <div className="form-group">
            <label>{t('gear.chemicalExpiryDate')}</label>
            <input
              type="date"
              className="form-control"
              value={formatDateInput(draft.expiryDate)}
              onChange={event => setDraft(previous => ({
                ...previous,
                expiryDate: event.target.value ? new Date(event.target.value).getTime() : undefined,
              }))}
              required
            />
          </div>
        )}
        <div className="form-group">
          <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
          <input
            type="number"
            className="form-control"
            placeholder={t('gear.purchasePriceGearPlaceholder')}
            value={draft.purchasePrice || ''}
            onChange={event => setDraft(previous => ({
              ...previous,
              purchasePrice: event.target.value ? Number(event.target.value) : undefined,
            }))}
          />
        </div>
        <div className="form-group">
          <label>{t('gear.notesLabel')}</label>
          <textarea
            className="form-control"
            rows={2}
            placeholder={t('gear.notesPlaceholder')}
            value={draft.notes || ''}
            onChange={event => setDraft(previous => ({ ...previous, notes: event.target.value }))}
          />
        </div>

        <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={keepModalOpen}
              onChange={event => onKeepModalOpenChange(event.target.checked)}
            />
            {t('gear.saveAndAddNext')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="primary">
              {editingEquipmentId ? t('gear.saveChanges') : t('gear.add')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
