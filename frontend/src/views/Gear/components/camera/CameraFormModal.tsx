import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { COMMON_CAMERAS, type CommonCameraPreset } from '../../../../catalog/gear';
import { Modal } from '../../../../components/Modal';
import { useCurrency } from '../../../../contexts/useCurrency';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Camera } from '../../../../db/schema';
import { useCameraSystems, useCameras, useFilmBacks } from '../../../../hooks/useData';
import type { GearAvatarTableName } from '../../../../services/gearAvatarService';
import { BrandModelPicker } from '../shared/BrandModelPicker';
import { GearAvatarEditor } from '../shared/GearAvatarEditor';
import { useGearActions } from '../../hooks/useGearActions';

// Shown by default before the brand list is searched or expanded. 120 shooters
// look for a different set of "mainstream" names than 135/digital shooters.
const POPULAR_CAMERA_BRANDS = ['Canon', 'Nikon', 'Leica', 'Pentax', 'Olympus', 'Minolta', 'Contax'];
const POPULAR_120_CAMERA_BRANDS = ['Hasselblad', 'Mamiya', 'Rolleiflex', 'Bronica', 'Pentax', 'Yashica'];

const CAMERA_SYSTEM_PRESETS = [
  { name: 'Hasselblad V', backs: ['A12 Back', 'A16 Back', 'A24 Back'] },
  { name: 'Mamiya RB67', backs: ['6x7 120 Back', '6x6 Back', 'Polaroid Back'] },
  { name: 'Mamiya RZ67', backs: ['6x7 120 Back', '6x4.5 Back', 'Polaroid Back'] },
  { name: 'Bronica SQ', backs: ['120 6x6 Back', '220 6x6 Back'] },
  { name: 'Bronica ETR', backs: ['120 6x4.5 Back', '220 6x4.5 Back'] },
  { name: 'Fuji GX680', backs: ['120 Holder', '220 Holder', 'Instant Film Holder'] },
];

const COMMON_FILM_BACK_NAMES = ['A12 Back', 'A16 Back', '6x7 120 Back', '6x6 Back', '6x4.5 Back', 'Polaroid Back'];

const getPlaceholderText = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed;
  const parts = trimmed.split(/\s+/);
  const model = parts.length > 1 ? parts.slice(1).join(' ') : trimmed;
  return model.length <= 10 ? model : `${model.slice(0, 9)}…`;
};

interface CameraFormModalProps {
  isOpen: boolean;
  editingCamera: Camera | null;
  keepModalOpen: boolean;
  uploadingEntityId: string | null;
  onKeepModalOpenChange: (value: boolean) => void;
  onClose: () => void;
  onPreview: (url?: string | null) => void;
  onUpload: (id: string, type: GearAvatarTableName) => void;
  onRemoveAvatar: (id: string, type: GearAvatarTableName, label: string) => void;
}

export const CameraFormModal = ({
  isOpen,
  editingCamera,
  keepModalOpen,
  uploadingEntityId,
  onKeepModalOpenChange,
  onClose,
  onPreview,
  onUpload,
  onRemoveAvatar,
}: CameraFormModalProps) => {
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const gearActions = useGearActions();
  const allCameras = useCameras();
  const cameraSystems = useCameraSystems();
  const filmBacks = useFilmBacks();
  const [editingCameraId, setEditingCameraId] = useState<string | null>(editingCamera?.id || null);
  const [newCamera, setNewCamera] = useState<Partial<Camera>>(
    editingCamera || { name: '', type: 'film', format: '135', purchasePrice: undefined },
  );
  const [cameraSystemMode, setCameraSystemMode] = useState<'new' | 'existing'>(
    editingCamera ? 'existing' : 'new',
  );
  const [selectedExistingCameraSystemId, setSelectedExistingCameraSystemId] = useState(
    editingCamera?.cameraSystemId || '',
  );
  const [cameraSystemName, setCameraSystemName] = useState(
    cameraSystems.find(system => system.id === editingCamera?.cameraSystemId)?.name || '',
  );
  const [cameraBackNames, setCameraBackNames] = useState<string[]>(editingCamera ? [] : ['Back 1']);
  const [newFilmBackName, setNewFilmBackName] = useState('');
  const [selectedCameraModel, setSelectedCameraModel] = useState('');
  const [nowTimestamp] = useState(Date.now);

  const currentEditingCamera = editingCameraId
    ? allCameras.find(camera => camera.id === editingCameraId) || editingCamera
    : null;
  const activeCameraSystemId = editingCameraId
    ? newCamera.cameraSystemId
    : cameraSystemMode === 'existing'
      ? selectedExistingCameraSystemId
      : undefined;
  const activeSystemFilmBacks = activeCameraSystemId
    ? filmBacks.filter(back => back.cameraSystemId === activeCameraSystemId && back.status !== 'archived')
    : [];
  const cameraTypeLabel = newCamera.type === 'digital' ? t('gear.digitalCamera') : t('gear.filmCamera');
  const availableCameraFormats = newCamera.type === 'digital' ? ['digital'] : ['135', '120', 'largeFormat'];
  const cameraFormatLabels: Record<string, string> = {
    '135': '135',
    '120': '120',
    digital: t('gear.digital'),
    largeFormat: t('gear.largeFormat'),
  };
  const cameraCatalog = COMMON_CAMERAS.filter(camera =>
    camera.type === newCamera.type && camera.format === newCamera.format);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const form = event.currentTarget.form;
    if (!form) return;
    const elements = Array.from(form.elements) as HTMLElement[];
    const index = elements.indexOf(event.currentTarget);
    const nextElement = elements.slice(index + 1).find(element =>
      !element.hidden &&
      !element.hasAttribute('disabled') &&
      (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'BUTTON'));
    if (!nextElement) return;
    if (nextElement.tagName === 'BUTTON' && (nextElement as HTMLButtonElement).type === 'submit') {
      nextElement.click();
    } else {
      nextElement.focus();
    }
  };

  const resetForm = () => {
    setEditingCameraId(null);
    setNewCamera({ name: '', type: 'film', format: '135', purchasePrice: undefined });
    setCameraSystemMode('new');
    setSelectedExistingCameraSystemId('');
    setCameraSystemName('');
    setCameraBackNames(['Back 1']);
    setNewFilmBackName('');
    setSelectedCameraModel('');
  };

  const handleSaveCamera = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCamera.name) return;
    const result = await gearActions.saveCamera({
      draft: newCamera,
      editingId: editingCameraId,
      existingCameras: allCameras,
      cameraSystemMode,
      selectedExistingCameraSystemId,
      cameraSystemName,
      cameraBackNames,
      timestamp: nowTimestamp,
    });
    if (result === 'trial-blocked') {
      onClose();
      return;
    }
    if (result !== 'saved') return;
    resetForm();
    if (!keepModalOpen) onClose();
  };

  const handleAddFilmBack = async () => {
    const name = newFilmBackName.trim();
    if (!name) return;
    if (!editingCameraId || !newCamera.cameraSystemId) {
      setCameraBackNames(previous => [...previous, name]);
      setNewFilmBackName('');
      return;
    }
    await gearActions.addFilmBack({
      cameraSystemId: newCamera.cameraSystemId,
      name,
      timestamp: nowTimestamp,
    });
    setNewFilmBackName('');
  };

  const handleRemoveDraftFilmBack = (index: number) => {
    setCameraBackNames(previous => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const addDraftFilmBackName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCameraBackNames(previous => previous.includes(trimmed) ? previous : [...previous, trimmed]);
  };

  const applyCameraSystemPreset = (preset: { name: string; backs: string[] }) => {
    setCameraSystemMode('new');
    setSelectedExistingCameraSystemId('');
    setCameraSystemName(preset.name);
    setCameraBackNames(preset.backs);
  };

  const applyCameraPreset = (preset: CommonCameraPreset) => {
    const currentName = (newCamera.name || '').trim();
    const suffix = currentName.startsWith(preset.brand) &&
      currentName !== preset.brand &&
      !currentName.startsWith(`${preset.brand} ${preset.model}`)
      ? currentName.slice(preset.brand.length).trim()
      : '';
    setNewCamera(previous => ({
      ...previous,
      name: `${preset.brand} ${preset.model}${suffix ? ` ${suffix}` : ''}`,
      type: preset.type,
      format: preset.format,
      backType: preset.backType || (preset.format === '120' ? 'fixed' : undefined),
    }));
    setSelectedCameraModel(preset.model);
    if (preset.cameraSystemName) {
      setCameraSystemMode('new');
      setSelectedExistingCameraSystemId('');
      setCameraSystemName(preset.cameraSystemName);
      setCameraBackNames(preset.backs?.length ? preset.backs : ['Back 1']);
    } else if (preset.format === '120') {
      setCameraSystemName('');
      setCameraBackNames(['Back 1']);
    }
  };

  const renderAvatarEditor = (
    id: string | null,
    type: GearAvatarTableName,
    avatarUrl: string | null | undefined,
    label: string,
    placeholder: string,
  ) => (
    <GearAvatarEditor
      id={id}
      type={type}
      avatarUrl={avatarUrl}
      label={label}
      placeholder={placeholder}
      uploading={uploadingEntityId === id}
      t={t}
      onPreview={url => onPreview(url)}
      onUpload={onUpload}
      onRemove={onRemoveAvatar}
    />
  );

  const handleArchiveFilmBack = (id: string) => gearActions.archiveFilmBack(id);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
    <h3>{editingCameraId ? t('gear.editCamera') : t('gear.addCamera')}</h3>
    <form className="gear-modal-form" onSubmit={handleSaveCamera}>
    {!editingCameraId && (
    <div className="gear-preset-panel camera-builder-panel">
    <div className="builder-panel-heading">
    <div>
    <strong>{t('gear.quickAddCameraTitle')}</strong>
    <p>{t('gear.quickAddCameraHelp')}</p>
    </div>
    <span className="builder-status-pill">{cameraTypeLabel} · {cameraFormatLabels[newCamera.format || '135'] || newCamera.format}</span>
    </div>

    {selectedCameraModel && newCamera.name ? (
    <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary">
    <span>{newCamera.name}</span>
    <small>{cameraTypeLabel} · {cameraFormatLabels[newCamera.format || '135'] || newCamera.format}</small>
    <button
    type="button"
    className="secondary btn-sm"
    onClick={() => setSelectedCameraModel('')}
    >
    {t('gear.reselectCamera')}
    </button>
    </div>
    ) : (
    <>
    <div className="builder-step">
    <div className="builder-step-label">1. {t('gear.cameraType')}</div>
    <div className="preset-chip-grid">
    {[
    { value: 'film' as const, label: t('gear.filmCamera') },
    { value: 'digital' as const, label: t('gear.digitalCamera') },
    ].map(option => (
    <button
    key={option.value}
    type="button"
    className={`preset-chip ${newCamera.type === option.value ? 'active' : ''}`}
    onClick={() => {
    setNewCamera({
    ...newCamera,
    type: option.value,
    format: option.value === 'digital' ? 'digital' : '135',
    backType: undefined,
    name: ''
    });
    setSelectedCameraModel('');
    setCameraSystemName('');
    setCameraBackNames(['Back 1']);
    }}
    >
    {option.label}
    </button>
    ))}
    </div>
    </div>

    <div className="builder-step">
    <div className="builder-step-label">2. {t('gear.formatStep')}</div>
    <div className="preset-chip-grid">
    {availableCameraFormats.map(format => (
    <button
    key={format}
    type="button"
    className={`preset-chip ${newCamera.format === format ? 'active' : ''}`}
    onClick={() => {
    setNewCamera({
    ...newCamera,
    format,
    backType: format === '120' ? 'fixed' : undefined,
    name: ''
    });
    setSelectedCameraModel('');
    setCameraSystemName('');
    setCameraBackNames(['Back 1']);
    }}
    >
    {cameraFormatLabels[format] || format}
    </button>
    ))}
    </div>
    </div>

    <BrandModelPicker
    key={`${newCamera.type}|${newCamera.format}`}
    catalog={cameraCatalog}
    getBrand={camera => camera.brand}
    getModelKey={camera => `${camera.brand}-${camera.model}`}
    getModelSearchText={camera => `${camera.brand} ${camera.model}`}
    renderModelLabel={camera => <>{camera.model}{camera.backType === 'interchangeable' ? ` · ${t('gear.interchangeableBack')}` : ''}</>}
    popularBrands={newCamera.format === '120' ? POPULAR_120_CAMERA_BRANDS : POPULAR_CAMERA_BRANDS}
    brandStepLabel={count => <>3. {t('gear.recommendedBrand', { count })}</>}
    brandSearchPlaceholder={t('gear.searchCameraBrand')}
    noBrandMatchLabel={t('gear.noBrandMatch')}
    changeBrandLabel={t('gear.changeBrand')}
    showMoreBrandsLabel={count => t('gear.showMoreBrands', { count })}
    showFewerBrandsLabel={t('gear.showFewerBrands')}
    modelStepLabel={count => <>4. {t('gear.selectRecommendedModel', { count })}</>}
    modelSearchPlaceholder={brand => t('gear.searchCameraModel', { brand })}
    noModelMatchLabel={t('gear.noCameraModelMatch')}
    showMoreModelsLabel={count => t('gear.showMoreModels', { count })}
    showFewerModelsLabel={t('gear.showFewerModels')}
    onSelectBrand={brand => setNewCamera(prev => ({
    ...prev,
    name: prev.name?.trim() ? prev.name : brand,
    }))}
    onSelectModel={applyCameraPreset}
    />
    <div className="film-back-empty">{t('gear.cameraPresetHelp')}</div>
    </>
    )}
    </div>
    )}
    {renderAvatarEditor(
    editingCameraId,
    'cameras',
    currentEditingCamera?.avatarUrl ?? newCamera.avatarUrl,
    newCamera.name || t('gear.addCamera'),
    getPlaceholderText(newCamera.name || 'Camera')
    )}
    <div className="form-group">
    <label>{t('gear.cameraName')}</label>
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.cameraNamePlaceholder')}
    value={newCamera.name}
    onChange={e => {
    setNewCamera({...newCamera, name: e.target.value});
    setSelectedCameraModel('');
    }}
    onKeyDown={handleKeyDown}
    enterKeyHint="next"
    required
    />
    </div>
    {editingCameraId && (
    <>
    <div className="form-group">
    <label>{t('gear.cameraType')}</label>
    <select
    className="form-control"
    value={newCamera.type}
    onChange={e => {
    const nextType = e.target.value as 'film' | 'digital';
    setNewCamera({
    ...newCamera,
    type: nextType,
    format: nextType === 'digital' ? 'digital' : (newCamera.format === 'digital' ? '135' : newCamera.format),
    backType: nextType === 'digital' ? undefined : newCamera.backType,
    });
    setSelectedCameraModel('');
    }}
    onKeyDown={handleKeyDown}
    >
    <option value="film">{t('gear.filmCamera')}</option>
    <option value="digital">{t('gear.digitalCamera')}</option>
    </select>
    </div>
    <div className="form-group">
    <label>{t('gear.formatStep')}</label>
    <select
    className="form-control"
    value={newCamera.format}
    onChange={e => {
    const nextFormat = e.target.value;
    setNewCamera({
    ...newCamera,
    format: nextFormat,
    type: nextFormat === 'digital' ? 'digital' : newCamera.type,
    backType: nextFormat === '120' ? (newCamera.backType || 'fixed') : undefined,
    });
    setSelectedCameraModel('');
    }}
    onKeyDown={handleKeyDown}
    >
    <option value="135">{t('gear.format135')}</option>
    <option value="120">{t('gear.format120')}</option>
    <option value="largeFormat">{t('gear.largeFormat')}</option>
    <option value="digital">{t('gear.digitalFormat')}</option>
    </select>
    </div>
    </>
    )}

    {newCamera.format === '120' && (
    <div className="form-group">
    <label>{t('gear.backMode')}</label>
    <select
    className="form-control"
    value={newCamera.backType || 'fixed'}
    onChange={e => setNewCamera({
    ...newCamera,
    backType: e.target.value as 'fixed' | 'interchangeable'
    })}
    >
    <option value="fixed">{t('gear.fixedBackOption')}</option>
    <option value="interchangeable">{t('gear.interchangeableBackOption')}</option>
    </select>
    </div>
    )}

    {newCamera.format === '120' && newCamera.backType === 'interchangeable' && (
    <div className="form-group">
    <div className="camera-system-guide">
    <strong>{t('gear.backGuideTitle')}</strong>
    <p>{t('gear.backGuideDesc')}</p>
    </div>

    <label>{t('gear.chooseCameraSystem')}</label>
    {!editingCameraId && cameraSystems.length > 0 && (
    <div className="camera-system-mode-toggle" role="group" aria-label={t('gear.chooseCameraSystem')}>
    <button
    type="button"
    className={`system-mode-btn ${cameraSystemMode === 'new' ? 'active' : ''}`}
    aria-pressed={cameraSystemMode === 'new'}
    onClick={() => {
    setCameraSystemMode('new');
    setSelectedExistingCameraSystemId('');
    setCameraBackNames(prev => prev.length > 0 ? prev : ['Back 1']);
    }}
    >
    {t('gear.newSystem')}
    </button>
    <button
    type="button"
    className={`system-mode-btn ${cameraSystemMode === 'existing' ? 'active' : ''}`}
    aria-pressed={cameraSystemMode === 'existing'}
    onClick={() => {
    setCameraSystemMode('existing');
    setCameraBackNames([]);
    }}
    >
    {t('gear.existingSystem')}
    </button>
    </div>
    )}

    {editingCameraId || cameraSystemMode === 'new' ? (
    <>
    {!editingCameraId && (
    <div className="preset-chip-grid">
    {CAMERA_SYSTEM_PRESETS.map(preset => (
    <button
    key={preset.name}
    type="button"
    className="preset-chip"
    onClick={() => applyCameraSystemPreset(preset)}
    >
    {preset.name}
    </button>
    ))}
    </div>
    )}
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.cameraSystemPlaceholder')}
    value={cameraSystemName}
    onChange={e => setCameraSystemName(e.target.value)}
    disabled={Boolean(editingCameraId && newCamera.cameraSystemId)}
    />
    </>
    ) : (
    <select
    className="form-control"
    value={selectedExistingCameraSystemId}
    onChange={e => setSelectedExistingCameraSystemId(e.target.value)}
    >
    <option value="">{t('gear.selectExistingSystem')}</option>
    {cameraSystems.map(system => (
    <option key={system.id} value={system.id}>
    {system.name}
    </option>
    ))}
    </select>
    )}

    {!editingCameraId && (
    <div className="film-back-manager">
    {cameraSystemMode === 'existing' && selectedExistingCameraSystemId && (
    <div className="film-back-list">
    {activeSystemFilmBacks.length === 0 ? (
    <div className="film-back-empty">{t('gear.noBacksInSystem')}</div>
    ) : (
    activeSystemFilmBacks.map(back => (
    <div key={back.id} className="film-back-row">
    <span>{back.name}</span>
    <small>{t('gear.existing')}</small>
    </div>
    ))
    )}
    </div>
    )}
    <label>{t('gear.filmBackStep')}</label>
    {cameraSystemMode === 'new' && (
    <div className="preset-chip-grid">
    {COMMON_FILM_BACK_NAMES.map(name => (
    <button
    key={name}
    type="button"
    className="preset-chip"
    onClick={() => addDraftFilmBackName(name)}
    >
    + {name}
    </button>
    ))}
    </div>
    )}
    <div className="film-back-list">
    {cameraBackNames.map((name, index) => (
    <div key={`${name}-${index}`} className="film-back-row">
    <span>{name}</span>
    <button type="button" className="secondary btn-sm" onClick={() => handleRemoveDraftFilmBack(index)}>
    {t('gear.remove')}
    </button>
    </div>
    ))}
    </div>
    <div className="film-back-add-row">
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.filmBackPlaceholder')}
    value={newFilmBackName}
    onChange={e => setNewFilmBackName(e.target.value)}
    />
    <button type="button" className="secondary" onClick={handleAddFilmBack}>{t('gear.addCustomBack')}</button>
    </div>
    <div className="film-back-empty">{t('gear.backShareHint')}</div>
    </div>
    )}
    {editingCameraId && newCamera.cameraSystemId && (
    <div className="film-back-manager">
    <div className="film-back-list">
    {activeSystemFilmBacks
    .map(back => (
    <div key={back.id} className="film-back-row">
    <span>{back.name}</span>
    <button type="button" className="secondary btn-sm" onClick={() => handleArchiveFilmBack(back.id!)}>
    {t('gear.remove')}
    </button>
    </div>
    ))}
    </div>
    <div className="film-back-add-row">
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.newBackName')}
    value={newFilmBackName}
    onChange={e => setNewFilmBackName(e.target.value)}
    />
    <button type="button" className="secondary" onClick={handleAddFilmBack}>{t('gear.addBack')}</button>
    </div>
    </div>
    )}
    </div>
    )}

    <div className="form-group">
    <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
    <input
    type="number"
    className="form-control"
    placeholder={t('gear.purchasePriceCameraPlaceholder')}
    value={newCamera.purchasePrice || ''}
    onChange={e => setNewCamera({...newCamera, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
    onKeyDown={handleKeyDown}
    enterKeyHint="next"
    />
    </div>
    <div className="modal-actions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
    <input type="checkbox" checked={keepModalOpen} onChange={e => onKeepModalOpenChange(e.target.checked)} />
    {t('gear.saveAndAddNext')}
    </label>
    <div style={{ display: 'flex', gap: '8px' }}>
    <button type="button" onClick={() => onClose()}>{t('common.cancel')}</button>
    <button type="submit" className="primary">{editingCameraId ? t('gear.saveChanges') : t('gear.add')}</button>
    </div>
    </div>
    </form>
    </Modal>
  );
};
