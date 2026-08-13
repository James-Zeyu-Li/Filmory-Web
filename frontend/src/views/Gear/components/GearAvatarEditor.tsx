import type { ReactNode } from 'react';
import type { GearAvatarTableName } from '../../../services/gearAvatarService';
import type { TranslationKey } from '../../../i18n/translations';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

interface GearAvatarEditorProps {
  id: string | null;
  type: GearAvatarTableName;
  avatarUrl?: string | null;
  label: string;
  placeholder: ReactNode;
  uploading: boolean;
  t: Translate;
  onPreview: (url: string) => void;
  onUpload: (id: string, type: GearAvatarTableName) => void;
  onRemove: (id: string, type: GearAvatarTableName, label: string) => void;
}

const getAvatarUrl = (url?: string | null) => (
  url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null
);

export const GearAvatarEditor = ({
  id,
  type,
  avatarUrl,
  label,
  placeholder,
  uploading,
  t,
  onPreview,
  onUpload,
  onRemove,
}: GearAvatarEditorProps) => {
  if (!id) return null;

  const resolvedAvatarUrl = getAvatarUrl(avatarUrl);

  return (
    <div className="edit-avatar-panel">
      <div className="edit-avatar-preview" onClick={() => resolvedAvatarUrl && onPreview(resolvedAvatarUrl)}>
        {resolvedAvatarUrl ? <img src={resolvedAvatarUrl} alt={label} /> : <div className="edit-avatar-placeholder">{placeholder}</div>}
      </div>
      <div className="edit-avatar-content">
        <div>
          <h4>{t('gear.coverTitle')}</h4>
          <p>{resolvedAvatarUrl ? t('gear.coverCustom') : t('gear.coverDefault')}</p>
        </div>
        <div className="edit-avatar-actions">
          <button type="button" className="secondary" onClick={() => resolvedAvatarUrl ? onPreview(resolvedAvatarUrl) : onUpload(id, type)} disabled={uploading}>
            {uploading ? t('common.loading') : resolvedAvatarUrl ? t('gear.viewCover') : t('gear.uploadCover')}
          </button>
          {resolvedAvatarUrl && <>
            <button type="button" className="secondary" onClick={() => onUpload(id, type)} disabled={uploading}>{t('gear.changeCover')}</button>
            <button type="button" className="danger" onClick={() => onRemove(id, type, label)}>{t('gear.removeCover')}</button>
          </>}
        </div>
      </div>
    </div>
  );
};
