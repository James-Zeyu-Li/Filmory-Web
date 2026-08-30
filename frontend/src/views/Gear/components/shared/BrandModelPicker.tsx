import { useState, type ReactNode } from 'react';

interface BrandModelPickerProps<T> {
  /** Already filtered by whatever pre-step the caller applies (format, camera type, lens mount...). */
  catalog: readonly T[];
  getBrand: (item: T) => string;
  getModelKey: (item: T) => string;
  getModelSearchText: (item: T) => string;
  renderModelLabel: (item: T) => ReactNode;
  /** Shown collapsed by default; the full brand list is one click (or a search) away. */
  popularBrands: readonly string[];

  brandStepLabel: (brandCount: number) => ReactNode;
  brandSearchPlaceholder: string;
  noBrandMatchLabel: ReactNode;
  changeBrandLabel: string;
  showMoreBrandsLabel: (hiddenCount: number) => string;
  showFewerBrandsLabel: string;
  /** Brand search box only shows once there are more than this many brands. */
  brandSearchThreshold?: number;

  modelStepLabel: (modelCount: number) => ReactNode;
  modelSearchPlaceholder: (brand: string) => string;
  noModelMatchLabel: ReactNode;
  showMoreModelsLabel: (hiddenCount: number) => string;
  showFewerModelsLabel: string;
  /** Model list collapses to this many entries (plus a "show all") once it's longer. */
  visibleModelCount?: number;

  onSelectModel: (item: T) => void;
  /** Optional side effect (e.g. Camera pre-filling the name field) when a brand is picked. */
  onSelectBrand?: (brand: string) => void;
  manualEntryLabel?: string;
  onRequestManualEntry?: () => void;
}

/**
 * Brand -> model picker shared by the gear "quick add" flows. Renders its
 * own brand/model search + selection state internally; give it a fresh
 * `key` when the caller's pre-filter (format, type, mount...) changes so
 * the picker resets instead of holding a stale selection.
 */
export function BrandModelPicker<T>({
  catalog,
  getBrand,
  getModelKey,
  getModelSearchText,
  renderModelLabel,
  popularBrands,
  brandStepLabel,
  brandSearchPlaceholder,
  noBrandMatchLabel,
  changeBrandLabel,
  showMoreBrandsLabel,
  showFewerBrandsLabel,
  brandSearchThreshold = 10,
  modelStepLabel,
  modelSearchPlaceholder,
  noModelMatchLabel,
  showMoreModelsLabel,
  showFewerModelsLabel,
  visibleModelCount = 8,
  onSelectModel,
  onSelectBrand,
  manualEntryLabel,
  onRequestManualEntry,
}: BrandModelPickerProps<T>) {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

  const brandOptions = Array.from(new Set(catalog.map(getBrand))).sort((a, b) => a.localeCompare(b));
  const matchedBrandOptions = brandOptions.filter(brand =>
    brand.toLowerCase().includes(brandSearch.trim().toLowerCase()),
  );
  // Collapsing to "popular" only pays off once the full list is long enough
  // that showing everything would be unwieldy; a short catalog (e.g. digital
  // camera brands) should just show everything directly.
  const isBrandListCollapsed = !brandSearch.trim() && !showAllBrands
    && brandOptions.length > brandSearchThreshold;
  const visibleBrandOptions = isBrandListCollapsed
    ? popularBrands.filter(brand => matchedBrandOptions.includes(brand))
    : matchedBrandOptions;
  const hiddenBrandCount = matchedBrandOptions.length - visibleBrandOptions.length;

  const modelOptions = selectedBrand ? catalog.filter(item => getBrand(item) === selectedBrand) : [];
  const matchedModelOptions = modelOptions.filter(item =>
    getModelSearchText(item).toLowerCase().includes(modelSearch.trim().toLowerCase()),
  );
  const isModelListCollapsed = !modelSearch.trim() && !showAllModels
    && matchedModelOptions.length > visibleModelCount;
  const visibleModelOptions = isModelListCollapsed
    ? matchedModelOptions.slice(0, visibleModelCount)
    : matchedModelOptions;
  const hiddenModelCount = matchedModelOptions.length - visibleModelOptions.length;

  const selectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setModelSearch('');
    setShowAllModels(false);
    onSelectBrand?.(brand);
  };

  const changeBrand = () => {
    setSelectedBrand('');
    setBrandSearch('');
    setModelSearch('');
    setShowAllModels(false);
  };

  return (
    <>
      <div className="builder-step">
        <div className="builder-step-label">{brandStepLabel(brandOptions.length)}</div>
        {selectedBrand ? (
          <div className="selected-builder-summary">
            <span>{selectedBrand}</span>
            <button type="button" className="secondary btn-sm" onClick={changeBrand}>
              {changeBrandLabel}
            </button>
          </div>
        ) : (
          <>
            {brandOptions.length > brandSearchThreshold && (
              <input
                type="text"
                className="form-control builder-option-search"
                placeholder={brandSearchPlaceholder}
                value={brandSearch}
                onChange={event => setBrandSearch(event.target.value)}
              />
            )}
            <div className="preset-chip-grid builder-scroll-grid gear-picker-grid">
              {visibleBrandOptions.map(brand => (
                <button
                  key={brand}
                  type="button"
                  className="preset-chip"
                  onClick={() => selectBrand(brand)}
                >
                  {brand}
                </button>
              ))}
              {visibleBrandOptions.length === 0 && (
                <div className="gear-preset-empty">
                  <span>{noBrandMatchLabel}</span>
                  {onRequestManualEntry && (
                    <button type="button" className="text-btn btn-sm" onClick={onRequestManualEntry}>
                      {manualEntryLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
            {isBrandListCollapsed && hiddenBrandCount > 0 && (
              <button type="button" className="text-btn btn-sm" onClick={() => setShowAllBrands(true)}>
                {showMoreBrandsLabel(hiddenBrandCount)}
              </button>
            )}
            {!isBrandListCollapsed && showAllBrands && !brandSearch.trim() && (
              <button type="button" className="text-btn btn-sm" onClick={() => setShowAllBrands(false)}>
                {showFewerBrandsLabel}
              </button>
            )}
          </>
        )}
      </div>

      {selectedBrand && (
        <div className="builder-step">
          <div className="builder-step-label">{modelStepLabel(modelOptions.length)}</div>
          {modelOptions.length > visibleModelCount && (
            <input
              type="text"
              className="form-control builder-option-search"
              placeholder={modelSearchPlaceholder(selectedBrand)}
              value={modelSearch}
              onChange={event => setModelSearch(event.target.value)}
            />
          )}
          <div className="preset-chip-grid builder-scroll-grid model-grid gear-picker-grid">
            {visibleModelOptions.map(item => (
              <button
                key={getModelKey(item)}
                type="button"
                className="preset-chip"
                onClick={() => onSelectModel(item)}
              >
                {renderModelLabel(item)}
              </button>
            ))}
            {visibleModelOptions.length === 0 && (
              <div className="gear-preset-empty">
                <span>{noModelMatchLabel}</span>
                {onRequestManualEntry && (
                  <button type="button" className="text-btn btn-sm" onClick={onRequestManualEntry}>
                    {manualEntryLabel}
                  </button>
                )}
              </div>
            )}
          </div>
          {isModelListCollapsed && hiddenModelCount > 0 && (
            <button type="button" className="text-btn btn-sm" onClick={() => setShowAllModels(true)}>
              {showMoreModelsLabel(hiddenModelCount)}
            </button>
          )}
          {!isModelListCollapsed && showAllModels && !modelSearch.trim() && (
            <button type="button" className="text-btn btn-sm" onClick={() => setShowAllModels(false)}>
              {showFewerModelsLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
