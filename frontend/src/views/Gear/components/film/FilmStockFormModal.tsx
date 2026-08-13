import { useState, type FormEvent, type KeyboardEvent, type WheelEvent } from 'react';
import { Search } from 'lucide-react';
import { COMMON_FILM_STOCKS, type CommonFilmStockPreset } from '../../../../catalog/gear';
import { FilmSvgAvatar } from '../../../../components/FilmSvgAvatar';
import { Modal } from '../../../../components/Modal';
import { useCurrency } from '../../../../contexts/useCurrency';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { FilmStock } from '../../../../db/schema';
import type { GearAvatarTableName } from '../../../../services/gearAvatarService';
import { useGearActions } from '../../hooks/useGearActions';
import { GearAvatarEditor } from '../shared/GearAvatarEditor';

interface FilmStockFormModalProps {
  isOpen: boolean;
  editingFilmStock: FilmStock | null;
  filmStocks: readonly FilmStock[];
  keepModalOpen: boolean;
  uploadingEntityId: string | null;
  onKeepModalOpenChange: (value: boolean) => void;
  onClose: () => void;
  onPreview: (url?: string | null) => void;
  onUpload: (id: string, type: GearAvatarTableName) => void;
  onRemoveAvatar: (id: string, type: GearAvatarTableName, label: string) => void;
}

type FilmFormat = '135' | '120';

const createDefaultDraft = (format: FilmFormat = '135'): Partial<FilmStock> => ({
  brand: '',
  name: '',
  iso: 400,
  colorType: 'color',
  format,
  stockCount: 1,
  pricePerRoll: undefined,
});

export const FilmStockFormModal = ({
  isOpen,
  editingFilmStock,
  filmStocks,
  keepModalOpen,
  uploadingEntityId,
  onKeepModalOpenChange,
  onClose,
  onPreview,
  onUpload,
  onRemoveAvatar,
}: FilmStockFormModalProps) => {
  const { currencySymbol } = useCurrency();
  const { t } = useLanguage();
  const gearActions = useGearActions();
  const [editingFilmId, setEditingFilmId] = useState<string | null>(editingFilmStock?.id || null);
  const [draft, setDraft] = useState<Partial<FilmStock>>(editingFilmStock || createDefaultDraft());
  const [dictionarySearch, setDictionarySearch] = useState('');
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<FilmFormat>(
    editingFilmStock?.format === '120' ? '120' : '135',
  );
  const [selectedBrand, setSelectedBrand] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  const currentEditingFilm = editingFilmId
    ? filmStocks.find(film => film.id === editingFilmId) || editingFilmStock
    : null;
  const catalog = COMMON_FILM_STOCKS.filter(film => film.format === formatFilter);
  const brandOptions = Array.from(new Set(catalog.map(film => film.brand)))
    .sort((a, b) => a.localeCompare(b));
  const visibleBrandOptions = brandOptions.filter(brand =>
    brand.toLowerCase().includes(brandSearch.trim().toLowerCase()),
  );
  const modelOptions = selectedBrand
    ? catalog.filter(film => film.brand === selectedBrand)
    : [];
  const visibleModelOptions = modelOptions.filter(film =>
    `${film.brand} ${film.name} ${film.iso}`.toLowerCase().includes(modelSearch.trim().toLowerCase()),
  );
  const dictionaryResults = dictionarySearch
    ? COMMON_FILM_STOCKS
        .filter(film => `${film.brand} ${film.name} ${film.format}`
          .toLowerCase()
          .includes(dictionarySearch.toLowerCase()))
        .slice(0, 10)
    : [];
  const hasSelectedPreset = !editingFilmId && Boolean(draft.brand && draft.name);

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

  const preventNumberInputWheelChange = (event: WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  const resetForm = () => {
    setEditingFilmId(null);
    setDraft(createDefaultDraft());
    setDictionarySearch('');
    setIsDictionaryOpen(false);
    setFormatFilter('135');
    setSelectedBrand('');
    setBrandSearch('');
    setModelSearch('');
    setShowManualForm(false);
  };

  const applyPreset = (preset: CommonFilmStockPreset) => {
    setDraft(previous => ({
      ...previous,
      brand: preset.brand,
      name: preset.name,
      iso: preset.iso,
      colorType: preset.colorType,
      format: preset.format,
    }));
    setFormatFilter(preset.format);
    setSelectedBrand(preset.brand);
    setDictionarySearch('');
    setModelSearch('');
    setIsDictionaryOpen(false);
    setShowManualForm(false);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.brand || !draft.name) return;

    const result = await gearActions.saveFilmStock({
      draft,
      editingId: editingFilmId,
      existingFilmStocks: filmStocks,
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
      <h3>{editingFilmId ? t('gear.editFilmStock') : t('gear.stockFilm')}</h3>
      <form className="gear-modal-form" onSubmit={handleSave}>
        <GearAvatarEditor
          id={editingFilmId}
          type="filmStocks"
          avatarUrl={currentEditingFilm?.avatarUrl ?? draft.avatarUrl}
          label={`${draft.brand || ''} ${draft.name || t('common.unknownFilm')}`.trim()}
          placeholder={(
            <FilmSvgAvatar
              brand={draft.brand || 'Film'}
              name={draft.name || 'Stock'}
              format={draft.format || '135'}
              size={72}
            />
          )}
          uploading={uploadingEntityId === editingFilmId}
          t={t}
          onPreview={url => onPreview(url)}
          onUpload={onUpload}
          onRemove={onRemoveAvatar}
        />

        {!editingFilmId && (
          <div className="gear-preset-panel">
            <div className="builder-panel-heading">
              <div>
                <strong>{t('gear.quickAddFilmTitle')}</strong>
                <p>{t('gear.quickAddFilmHelp')}</p>
              </div>
              {draft.brand && draft.name && (
                <span className="builder-status-pill">{draft.brand} {draft.name}</span>
              )}
            </div>

            {draft.brand && draft.name ? (
              <div className="selected-builder-summary selected-gear-summary builder-collapsed-summary">
                <span>{draft.brand} {draft.name}</span>
                <small>
                  ISO {draft.iso} · {draft.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {draft.format}
                </small>
                <button
                  type="button"
                  className="secondary btn-sm"
                  onClick={() => {
                    setDraft({
                      ...createDefaultDraft(formatFilter),
                      stockCount: draft.stockCount,
                      pricePerRoll: draft.pricePerRoll,
                    });
                    setSelectedBrand('');
                    setBrandSearch('');
                    setModelSearch('');
                    setShowManualForm(false);
                  }}
                >
                  {t('gear.reselectFilm')}
                </button>
              </div>
            ) : (
              <>
                <div className="builder-step">
                  <div className="builder-step-label">1. {t('gear.formatStep')}</div>
                  <div className="preset-chip-grid">
                    {(['135', '120'] as const).map(format => (
                      <button
                        key={format}
                        type="button"
                        className={`preset-chip ${formatFilter === format ? 'active' : ''}`}
                        onClick={() => {
                          setFormatFilter(format);
                          setDraft(previous => ({ ...previous, format }));
                          setSelectedBrand('');
                          setBrandSearch('');
                          setModelSearch('');
                          setDictionarySearch('');
                          if (!draft.brand || !draft.name) setShowManualForm(false);
                        }}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="builder-step">
                  <div className="builder-step-label">
                    2. {t('gear.recommendedBrand', { count: brandOptions.length })}
                  </div>
                  {selectedBrand ? (
                    <div className="selected-builder-summary">
                      <span>{selectedBrand}</span>
                      <button
                        type="button"
                        className="secondary btn-sm"
                        onClick={() => {
                          setSelectedBrand('');
                          setBrandSearch('');
                          setModelSearch('');
                        }}
                      >
                        {t('gear.changeBrand')}
                      </button>
                    </div>
                  ) : (
                    <>
                      {brandOptions.length > 10 && (
                        <input
                          type="text"
                          className="form-control builder-option-search"
                          placeholder={t('gear.searchFilmBrand')}
                          value={brandSearch}
                          onChange={event => setBrandSearch(event.target.value)}
                        />
                      )}
                      <div className="preset-chip-grid builder-scroll-grid">
                        {visibleBrandOptions.map(brand => (
                          <button
                            key={brand}
                            type="button"
                            className="preset-chip"
                            onClick={() => {
                              setSelectedBrand(brand);
                              setModelSearch('');
                            }}
                          >
                            {brand}
                          </button>
                        ))}
                        {visibleBrandOptions.length === 0 && (
                          <span className="gear-preset-empty">{t('gear.noBrandMatch')}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {selectedBrand && (
                  <div className="builder-step">
                    <div className="builder-step-label">
                      3. {t('gear.recommendedModel', { count: modelOptions.length })}
                    </div>
                    {modelOptions.length > 8 && (
                      <input
                        type="text"
                        className="form-control builder-option-search"
                        placeholder={t('gear.searchFilmModel', { brand: selectedBrand })}
                        value={modelSearch}
                        onChange={event => setModelSearch(event.target.value)}
                      />
                    )}
                    <div className="preset-chip-grid builder-scroll-grid model-grid">
                      {visibleModelOptions.map(film => (
                        <button
                          key={`${film.brand}-${film.name}-${film.format}`}
                          type="button"
                          className="preset-chip"
                          onClick={() => applyPreset(film)}
                        >
                          {film.name} · ISO {film.iso}
                        </button>
                      ))}
                      {visibleModelOptions.length === 0 && (
                        <span className="gear-preset-empty">{t('gear.noFilmModelMatch')}</span>
                      )}
                    </div>
                  </div>
                )}

                <details className="builder-fallback-search">
                  <summary>{t('gear.directSearchFilm')}</summary>
                  <div className="search-input-wrapper">
                    <Search
                      className="search-icon"
                      size={16}
                      style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      style={{ paddingLeft: 36, backgroundColor: 'var(--bg-tertiary)' }}
                      placeholder={t('gear.searchFilmPlaceholder')}
                      value={dictionarySearch}
                      onChange={event => {
                        setDictionarySearch(event.target.value);
                        setIsDictionaryOpen(true);
                      }}
                      onFocus={() => setIsDictionaryOpen(true)}
                      onBlur={() => setTimeout(() => setIsDictionaryOpen(false), 200)}
                    />
                  </div>
                  {isDictionaryOpen && dictionarySearch && (
                    <ul className="custom-dropdown-menu gear-preset-dropdown">
                      {dictionaryResults.map(film => (
                        <li
                          key={`${film.brand}-${film.name}-${film.format}`}
                          style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                          onClick={() => applyPreset(film)}
                        >
                          <div style={{ fontWeight: 600 }}>{film.brand} {film.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            ISO {film.iso} · {film.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {film.format}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="film-stock-count">
            {editingFilmId ? t('gear.stockCount') : t('gear.addStockCount')}
          </label>
          <input
            id="film-stock-count"
            type="number"
            className="form-control"
            min={editingFilmId ? '0' : '1'}
            placeholder={editingFilmId ? t('gear.stockCountPlaceholder') : t('gear.addStockCountPlaceholder')}
            value={draft.stockCount === undefined ? '' : draft.stockCount}
            onChange={event => setDraft(previous => ({
              ...previous,
              stockCount: event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10),
            }))}
            onWheel={preventNumberInputWheelChange}
            onKeyDown={handleKeyDown}
            enterKeyHint="next"
          />
        </div>
        <div className="form-group">
          <label>{t('gear.averagePricePerRoll', { symbol: currencySymbol })}</label>
          <input
            type="number"
            className="form-control"
            placeholder={t('gear.pricePerRollPlaceholder')}
            value={draft.pricePerRoll || ''}
            onChange={event => setDraft(previous => ({
              ...previous,
              pricePerRoll: event.target.value ? Number(event.target.value) : undefined,
            }))}
            onWheel={preventNumberInputWheelChange}
            onKeyDown={handleKeyDown}
            enterKeyHint="next"
          />
        </div>

        {(!editingFilmId && !showManualForm) ? (
          hasSelectedPreset ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('gear.manualFilmConfig')}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {draft.brand} {draft.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    ISO {draft.iso} · {draft.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {draft.format}
                  </div>
                </div>
                <button type="button" className="text-btn" onClick={() => setShowManualForm(true)}>
                  {t('gear.customizeFilmDetails')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', margin: '8px 0 24px 0' }}>
              <button type="button" className="text-btn" onClick={() => setShowManualForm(true)}>
                {t('gear.manualFilmToggle')}
              </button>
            </div>
          )
        ) : (editingFilmId && !showManualForm) ? (
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {t('gear.manualFilmConfig')}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {draft.brand} {draft.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ISO {draft.iso} · {draft.colorType === 'color' ? t('gear.color') : t('gear.bw')} · {draft.format}
                </div>
              </div>
              <button type="button" className="text-btn" onClick={() => setShowManualForm(true)}>
                {t('gear.customizeFilmDetails')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('gear.manualFilmConfig')}
              </span>
              <button type="button" className="text-btn" style={{ fontSize: '12px' }} onClick={() => setShowManualForm(false)}>
                {t('gear.collapse')}
              </button>
            </div>
            <div className="form-group">
              <label>{t('gear.brandMaker')}</label>
              <input
                type="text"
                className="form-control"
                placeholder={t('rolls.filmBrandPlaceholder')}
                value={draft.brand || ''}
                onChange={event => setDraft(previous => ({ ...previous, brand: event.target.value }))}
                onKeyDown={handleKeyDown}
                enterKeyHint="next"
                required
              />
            </div>
            <div className="form-group">
              <label>{t('gear.modelName')}</label>
              <input
                type="text"
                className="form-control"
                placeholder={t('rolls.filmModelPlaceholder')}
                value={draft.name || ''}
                onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))}
                onKeyDown={handleKeyDown}
                enterKeyHint="next"
                required
              />
            </div>
            <div className="form-group">
              <label>{t('gear.isoSpeed')}</label>
              <input
                type="number"
                className="form-control"
                value={draft.iso || ''}
                onChange={event => setDraft(previous => ({ ...previous, iso: Number(event.target.value) }))}
                onKeyDown={handleKeyDown}
                enterKeyHint="next"
                required
              />
            </div>
            <div className="form-group">
              <label>{t('gear.colorType')}</label>
              <select
                className="form-control"
                value={draft.colorType || 'color'}
                onChange={event => setDraft(previous => ({
                  ...previous,
                  colorType: event.target.value as FilmStock['colorType'],
                }))}
                onKeyDown={handleKeyDown}
              >
                <option value="color">{t('gear.colorFilm')}</option>
                <option value="bw">{t('gear.bwFilm')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('gear.formatSize')}</label>
              <select
                className="form-control"
                value={draft.format || '135'}
                onChange={event => {
                  const format = event.target.value as FilmFormat;
                  setDraft(previous => ({ ...previous, format }));
                  if (!editingFilmId) setFormatFilter(format);
                }}
                onKeyDown={handleKeyDown}
              >
                <option value="135">{t('gear.format135')}</option>
                <option value="120">{t('gear.format120')}</option>
              </select>
            </div>
          </div>
        )}

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
              {editingFilmId ? t('gear.saveChanges') : t('gear.add')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
