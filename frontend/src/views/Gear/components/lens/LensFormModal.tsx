import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { COMMON_LENSES, type CommonLensPreset } from '../../../../catalog/gear';
import { LensSvgAvatar } from '../../../../components/LensSvgAvatar';
import { Modal } from '../../../../components/Modal';
import { useCurrency } from '../../../../contexts/useCurrency';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Lens } from '../../../../db/schema';
import { useLenses } from '../../../../hooks/useData';
import type { GearAvatarTableName } from '../../../../services/gearAvatarService';
import { useGearActions } from '../../hooks/useGearActions';
import { GearAvatarEditor } from '../shared/GearAvatarEditor';

interface LensFormModalProps {
  isOpen: boolean;
  editingLens: Lens | null;
  keepModalOpen: boolean;
  uploadingEntityId: string | null;
  onKeepModalOpenChange: (value: boolean) => void;
  onClose: () => void;
  onPreview: (url?: string | null) => void;
  onUpload: (id: string, type: GearAvatarTableName) => void;
  onRemoveAvatar: (id: string, type: GearAvatarTableName, label: string) => void;
}

export const LensFormModal = ({
  isOpen,
  editingLens,
  keepModalOpen,
  uploadingEntityId,
  onKeepModalOpenChange,
  onClose,
  onPreview,
  onUpload,
  onRemoveAvatar,
}: LensFormModalProps) => {
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const gearActions = useGearActions();
  const allLenses = useLenses();
  const [editingLensId, setEditingLensId] = useState<string | null>(editingLens?.id || null);
  const [newLens, setNewLens] = useState<Partial<Lens>>(
    editingLens || { name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime' },
  );
  const [lensDictSearch, setLensDictSearch] = useState('');
  const [isLensDictDropdownOpen, setIsLensDictDropdownOpen] = useState(false);
  const [lensTypeFilter, setLensTypeFilter] = useState<'prime' | 'zoom'>(
    editingLens?.type === 'zoom' ? 'zoom' : 'prime',
  );
  const [lensMountFilter, setLensMountFilter] = useState(editingLens?.mountKey || 'all');
  const [lensMountSearch, setLensMountSearch] = useState('');
  const [selectedLensBrand, setSelectedLensBrand] = useState('');
  const [selectedLensModel, setSelectedLensModel] = useState('');
  const [lensBrandSearch, setLensBrandSearch] = useState('');
  const [lensModelSearch, setLensModelSearch] = useState('');

  const currentEditingLens = editingLensId
    ? allLenses.find(lens => lens.id === editingLensId) || editingLens
    : null;
  const lensMountOptions = Array.from(new Set(COMMON_LENSES.map(lens => lens.mountKey)))
    .sort((a, b) => a.localeCompare(b));
  const visibleLensMountOptions = lensMountOptions.filter(mount =>
    mount.toLowerCase().includes(lensMountSearch.trim().toLowerCase()),
  );
  const filteredLensCatalog = COMMON_LENSES.filter(lens => {
    if (lens.type !== lensTypeFilter) return false;
    if (lensMountFilter !== 'all' && lens.mountKey !== lensMountFilter) return false;
    return true;
  });
  const lensBrandOptions = Array.from(new Set(filteredLensCatalog.map(lens => lens.brand)))
    .sort((a, b) => a.localeCompare(b));
  const visibleLensBrandOptions = lensBrandOptions.filter(brand =>
    brand.toLowerCase().includes(lensBrandSearch.trim().toLowerCase()),
  );
  const lensModelOptions = selectedLensBrand
    ? filteredLensCatalog.filter(lens => lens.brand === selectedLensBrand)
    : [];
  const visibleLensModelOptions = lensModelOptions.filter(lens =>
    `${lens.brand} ${lens.model} ${lens.focalLength}mm ${lens.mountKey}`
      .toLowerCase()
      .includes(lensModelSearch.trim().toLowerCase()),
  );
  const filteredLensPresets = COMMON_LENSES.filter(lens => {
    const query = lensDictSearch.trim().toLowerCase();
    if (!query || lens.type !== lensTypeFilter) return false;
    if (lensMountFilter !== 'all' && lens.mountKey !== lensMountFilter) return false;
    return `${lens.brand} ${lens.model} ${lens.focalLength}mm ${lens.mountKey}`
      .toLowerCase()
      .includes(query);
  }).slice(0, 10);

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
    setEditingLensId(null);
    setNewLens({ name: '', focalLength: 50, maxAperture: 'f/1.8', type: 'prime', purchasePrice: undefined });
    setLensDictSearch('');
    setIsLensDictDropdownOpen(false);
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensBrandSearch('');
    setLensModelSearch('');
    setLensTypeFilter('prime');
    setLensMountFilter('all');
    setLensMountSearch('');
  };

  const applyLensPreset = (preset: CommonLensPreset) => {
    setNewLens(previous => ({
      ...previous,
      name: `${preset.brand} ${preset.model}`,
      focalLength: preset.focalLength,
      maxAperture: preset.maxAperture,
      type: preset.type,
      mountKey: preset.mountKey,
    }));
    setSelectedLensBrand(preset.brand);
    setSelectedLensModel(preset.model);
    setLensMountFilter(preset.mountKey);
    setLensTypeFilter(preset.type);
    setLensDictSearch('');
    setLensMountSearch('');
    setLensModelSearch('');
    setIsLensDictDropdownOpen(false);
  };

  const handleSaveLens = async (event: FormEvent) => {
    event.preventDefault();
    if (!newLens.name) return;
    const result = await gearActions.saveLens({
      draft: newLens,
      editingId: editingLensId,
      existingLenses: allLenses,
    });
    if (result === 'trial-blocked') {
      onClose();
      return;
    }
    if (result !== 'saved') return;
    resetForm();
    if (!keepModalOpen) onClose();
  };

  const renderAvatarEditor = (
    id: string | null,
    type: GearAvatarTableName,
    avatarUrl: string | null | undefined,
    label: string,
    placeholder: React.ReactNode,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
    <h3>{editingLensId ? t('gear.editLens') : t('gear.addLens')}</h3>
    <form className="gear-modal-form" onSubmit={handleSaveLens}>
    {!editingLensId && (
    <div className="gear-preset-panel">
    <div className="builder-panel-heading">
    <div>
    <strong>{t('gear.quickAddLensTitle')}</strong>
    <p>{t('gear.quickAddLensHelp')}</p>
    </div>
    {newLens.name && <span className="builder-status-pill">{newLens.name}</span>}
    </div>
    {selectedLensModel && newLens.name ? (
    <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary lens-builder-collapsed">
    <span>{newLens.name}</span>
    <small>{newLens.focalLength}mm · {newLens.maxAperture} · {newLens.mountKey || t('gear.noMount')}</small>
    <button
    type="button"
    className="secondary btn-sm"
    onClick={() => {
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensMountFilter('all');
    setLensBrandSearch('');
    setLensModelSearch('');
    setLensDictSearch('');
    }}
    >
    {t('gear.reselectLens')}
    </button>
    </div>
    ) : (
    <>
    <div className="builder-step">
    <div className="builder-step-label">1. {t('gear.lensType')}</div>
    <div className="preset-chip-grid">
    {[
    { value: 'prime' as const, label: t('gear.prime') },
    { value: 'zoom' as const, label: t('gear.zoom') },
    ].map(option => (
    <button
    key={option.value}
    type="button"
    className={`preset-chip ${lensTypeFilter === option.value ? 'active' : ''}`}
    onClick={() => {
    setLensTypeFilter(option.value);
    setNewLens(prev => ({ ...prev, type: option.value }));
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensModelSearch('');
    }}
    >
    {option.label}
    </button>
    ))}
    </div>
    </div>
    <div className="builder-step">
    <div className="builder-step-label">2. {t('gear.mountSystem')}</div>
    {lensMountFilter !== 'all' ? (
    <div className="selected-builder-summary">
    <span>{lensMountFilter}</span>
    <button
    type="button"
    className="secondary btn-sm"
    onClick={() => {
    setLensMountFilter('all');
    setLensMountSearch('');
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensBrandSearch('');
    setLensModelSearch('');
    }}
    >
    {t('gear.changeMount')}
    </button>
    </div>
    ) : (
    <>
    {lensMountOptions.length > 10 && (
    <input
    type="text"
    className="form-control builder-option-search"
    placeholder={t('gear.searchMount')}
    value={lensMountSearch}
    onChange={e => setLensMountSearch(e.target.value)}
    />
    )}
    <div className="preset-chip-grid compact builder-scroll-grid">
    {visibleLensMountOptions.map(mount => (
    <button
    key={mount}
    type="button"
    className="preset-chip"
    onClick={() => {
    setLensMountFilter(mount);
    setLensMountSearch('');
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensModelSearch('');
    }}
    >
    {mount}
    </button>
    ))}
    {visibleLensMountOptions.length === 0 && (
    <span className="gear-preset-empty">{t('gear.noMountMatch')}</span>
    )}
    </div>
    </>
    )}
    </div>

    <div className="builder-step">
    <div className="builder-step-label">3. {t('gear.recommendedBrand', { count: lensBrandOptions.length })}</div>
    {selectedLensBrand ? (
    <div className="selected-builder-summary">
    <span>{selectedLensBrand}</span>
    <button
    type="button"
    className="secondary btn-sm"
    onClick={() => {
    setSelectedLensBrand('');
    setSelectedLensModel('');
    setLensBrandSearch('');
    setLensModelSearch('');
    }}
    >
    {t('gear.changeBrand')}
    </button>
    </div>
    ) : (
    <>
    {lensBrandOptions.length > 10 && (
    <input
    type="text"
    className="form-control builder-option-search"
    placeholder={t('gear.searchLensBrand')}
    value={lensBrandSearch}
    onChange={e => setLensBrandSearch(e.target.value)}
    />
    )}
    <div className="preset-chip-grid builder-scroll-grid">
    {visibleLensBrandOptions.map(brand => (
    <button
    key={brand}
    type="button"
    className="preset-chip"
    onClick={() => {
    setSelectedLensBrand(brand);
    setSelectedLensModel('');
    setLensModelSearch('');
    }}
    >
    {brand}
    </button>
    ))}
    {visibleLensBrandOptions.length === 0 && (
    <span className="gear-preset-empty">{t('gear.noBrandMatch')}</span>
    )}
    </div>
    </>
    )}
    </div>

    {selectedLensBrand && (
    <div className="builder-step">
    <div className="builder-step-label">4. {t('gear.recommendedModel', { count: lensModelOptions.length })}</div>
    {lensModelOptions.length > 8 && (
    <input
    type="text"
    className="form-control builder-option-search"
    placeholder={t('gear.searchLensModel', { brand: selectedLensBrand })}
    value={lensModelSearch}
    onChange={e => setLensModelSearch(e.target.value)}
    />
    )}
    <div className="preset-chip-grid builder-scroll-grid model-grid">
    {visibleLensModelOptions.map(preset => (
    <button
    key={`${preset.brand}-${preset.model}`}
    type="button"
    className={`preset-chip ${newLens.name === `${preset.brand} ${preset.model}` ? 'active' : ''}`}
    onClick={() => applyLensPreset(preset)}
    >
    {preset.model} · {preset.focalLength}mm
    </button>
    ))}
    {visibleLensModelOptions.length === 0 && (
    <span className="gear-preset-empty">{t('gear.noLensModelMatch')}</span>
    )}
    </div>
    </div>
    )}

    <details className="builder-fallback-search">
    <summary>{t('gear.directSearchLens')}</summary>
    <div className="search-input-wrapper" style={{ position: 'relative' }}>
    <Search className="search-icon" size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
    <input
    type="text"
    className="form-control"
    style={{ paddingLeft: 36, backgroundColor: 'var(--bg-secondary)' }}
    placeholder={t('gear.searchLensPlaceholder')}
    value={lensDictSearch}
    onChange={e => {
    setLensDictSearch(e.target.value);
    setIsLensDictDropdownOpen(true);
    }}
    onFocus={() => setIsLensDictDropdownOpen(true)}
    onBlur={() => setTimeout(() => setIsLensDictDropdownOpen(false), 200)}
    />
    {isLensDictDropdownOpen && lensDictSearch && (
    <ul className="custom-dropdown-menu gear-preset-dropdown">
    {filteredLensPresets.length === 0 ? (
    <li className="gear-preset-empty">{t('gear.noPresetFound')}</li>
    ) : (
    filteredLensPresets.map((preset, idx) => (
    <li key={`${preset.brand}-${preset.model}-${idx}`} onClick={() => applyLensPreset(preset)}>
    <div style={{ fontWeight: 700 }}>{preset.brand} {preset.model}</div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
    {preset.focalLength}mm · {preset.maxAperture} · {preset.type === 'prime' ? t('gear.prime') : t('gear.zoom')} · {preset.mountKey}
    </div>
    </li>
    ))
    )}
    </ul>
    )}
    </div>
    </details>
    </>
    )}
    <div className="film-back-empty">{t('gear.presetDraftOnly')}</div>
    </div>
    )}
    {renderAvatarEditor(
    editingLensId,
    'lenses',
    currentEditingLens?.avatarUrl ?? newLens.avatarUrl,
    newLens.name || t('gear.addLens'),
    <LensSvgAvatar focalLength={Number(newLens.focalLength) || 50} type={newLens.type || 'prime'} size={72} />
    )}
    <div className="form-group">
    <label>{t('gear.lensModel')}</label>
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.lensModelPlaceholder')}
    value={newLens.name}
    onChange={e => {
    setNewLens({...newLens, name: e.target.value});
    setSelectedLensModel('');
    }}
    onKeyDown={handleKeyDown}
    enterKeyHint="next"
    required
    />
    </div>
    <div className="form-group">
    <label>{t('gear.focalLength')} (mm)</label>
    <input
    type="number"
    className="form-control"
    value={newLens.focalLength}
    onChange={e => setNewLens({...newLens, focalLength: Number(e.target.value)})}
    onKeyDown={handleKeyDown}
    enterKeyHint="next"
    required
    />
    </div>
    <div className="form-group">
    <label>{t('gear.maxAperture')}</label>
    <input
    type="text"
    className="form-control"
    placeholder={t('gear.aperturePlaceholder')}
    value={newLens.maxAperture}
    onChange={e => setNewLens({...newLens, maxAperture: e.target.value})}
    onKeyDown={handleKeyDown}
    enterKeyHint="next"
    required
    />
    </div>
    {editingLensId && (
    <div className="form-group">
    <label>{t('gear.lensType')}</label>
    <select
    className="form-control"
    value={newLens.type}
    onChange={e => setNewLens({...newLens, type: e.target.value})}
    onKeyDown={handleKeyDown}
    >
    <option value="prime">{t('gear.prime')}</option>
    <option value="zoom">{t('gear.zoom')}</option>
    </select>
    </div>
    )}
    <div className="form-group">
    <label>{t('gear.purchasePrice', { symbol: currencySymbol })}</label>
    <input
    type="number"
    className="form-control"
    placeholder={t('gear.purchasePriceLensPlaceholder')}
    value={newLens.purchasePrice || ''}
    onChange={e => setNewLens({...newLens, purchasePrice: e.target.value ? Number(e.target.value) : undefined})}
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
    <button type="submit" className="primary">{editingLensId ? t('gear.saveChanges') : t('gear.add')}</button>
    </div>
    </div>
    </form>
    </Modal>
  );
};
