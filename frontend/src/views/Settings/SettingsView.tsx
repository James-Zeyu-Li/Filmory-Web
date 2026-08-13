import React, { useState } from 'react';
import { BackupService } from '../../services/backupService';
import { Shield, Download, X, Sun, Moon, Monitor, Coins, Film, ArrowUp, ArrowDown, Folder, Languages, ChevronDown, CloudUpload } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';
import { Modal } from '../../components/Modal';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { CURRENCY_OPTIONS, type CurrencyCode } from '../../contexts/currencyContextCore';
import { useLanguage } from '../../contexts/useLanguage';
import { LANGUAGE_OPTIONS, type LanguageCode } from '../../i18n/translations';
import { convertCurrentUserMoney } from '../../services/currencyConversionService';
import { repairPendingPhotoUploads } from '../../services/photoUploadRecoveryService';
import { SyncService } from '../../services/syncService';
import { requestImmediateSync } from '../../services/syncEvents';
import { usePhotoAssets } from '../../hooks/useData';
import {
  readRollsCollectionsTabEnabled,
  readRollsTabOrder,
  writeRollsCollectionsTabEnabled,
  writeRollsTabOrder,
  type RollsTabId,
} from '../../services/workspacePreferences';
import './SettingsView.css';

interface SettingsViewProps {
  enableFilmMode: boolean;
  setEnableFilmMode: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ enableFilmMode, setEnableFilmMode, onClose }) => {
  const { user, isDevBypass } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, currencySymbol } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const photoAssets = usePhotoAssets();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [isCurrencyConversionOpen, setIsCurrencyConversionOpen] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(() => (
    currency === 'CNY' ? 'USD' : 'CNY'
  ));
  const [conversionRate, setConversionRate] = useState('');
  const [rollsTabOrder, setRollsTabOrder] = useState<RollsTabId[]>(() => readRollsTabOrder());
  const [rollsCollectionsEnabled, setRollsCollectionsEnabled] = useState<boolean>(() => readRollsCollectionsTabEnabled());
  const [isRollTabLayoutExpanded, setIsRollTabLayoutExpanded] = useState(false);
  const pendingPhotoUploadCount = user && SyncService.isAutoSyncEnabled()
    ? photoAssets.filter(photo => Boolean(photo.id && photo.blob && !photo.storageKey)).length
    : 0;

  const rollsTabLabels: Record<RollsTabId, string> = {
    collections: t('settings.rollTabCollections'),
    all: t('settings.rollTabAll'),
    loose: t('settings.rollTabLoose'),
  };
  const visibleRollTabSummary = rollsTabOrder
    .filter(tab => tab === 'all' || !enableFilmMode || rollsCollectionsEnabled)
    .map(tab => rollsTabLabels[tab])
    .join(' / ');

  const handleFilmModeChange = (nextEnabled: boolean) => {
    setEnableFilmMode(nextEnabled);
  };

  const moveRollsTab = (tab: RollsTabId, direction: 'up' | 'down') => {
    const currentIndex = rollsTabOrder.indexOf(tab);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rollsTabOrder.length) return;

    const nextOrder = [...rollsTabOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    setRollsTabOrder(nextOrder);
    writeRollsTabOrder(nextOrder);
  };

  const handleRollsCollectionsEnabledChange = (enabled: boolean) => {
    const nextEnabled = !enableFilmMode ? true : enabled;
    setRollsCollectionsEnabled(nextEnabled);
    writeRollsCollectionsTabEnabled(nextEnabled);
  };

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      setProcessMessage(t('settings.exporting'));
      await BackupService.exportDatabaseToExcel(user?.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.unknownError');
      notify({
        type: 'error',
        title: t('settings.exportFailedTitle'),
        message
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleRepairPendingPhotos = async () => {
    if (!user || pendingPhotoUploadCount === 0) return;

    try {
      setIsProcessing(true);
      setProcessMessage(t('settings.repairingPhotos'));
      const result = await repairPendingPhotoUploads(user.id);

      if (result.uploaded > 0) {
        requestImmediateSync('photo-upload-recovery');
      }

      if (result.failed > 0) {
        notify({
          type: result.uploaded > 0 ? 'info' : 'error',
          title: t(result.uploaded > 0 ? 'settings.repairPhotosPartialTitle' : 'settings.repairPhotosFailedTitle'),
          message: result.uploaded > 0
            ? t('settings.repairPhotosPartialMessage', { uploaded: result.uploaded, failed: result.failed })
            : t('settings.repairPhotosFailedMessage'),
        });
        return;
      }

      notify({
        type: 'success',
        title: t('settings.repairPhotosDoneTitle'),
        message: t('settings.repairPhotosDoneMessage', { uploaded: result.uploaded }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.unknownError');
      notify({
        type: 'error',
        title: t('settings.repairPhotosFailedTitle'),
        message,
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleCurrencyConversion = async (event: React.FormEvent) => {
    event.preventDefault();

    const rate = Number(conversionRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      notify({
        type: 'error',
        title: t('settings.invalidRateTitle'),
        message: t('settings.invalidRateMessage')
      });
      return;
    }

    if (targetCurrency === currency) {
      notify({
        type: 'error',
        title: t('settings.sameCurrencyTitle'),
        message: t('settings.sameCurrencyMessage')
      });
      return;
    }

    const targetOption = CURRENCY_OPTIONS.find(option => option.code === targetCurrency);
    const confirmed = await confirm({
      title: t('settings.conversionConfirmTitle'),
      message: t('settings.conversionConfirmMessage', {
        from: currency,
        rate,
        to: targetCurrency,
        target: targetOption ? t(`currency.${targetOption.code}` as any) : targetCurrency,
      }),
      confirmText: t('settings.conversionConfirmAction'),
      cancelText: t('common.cancel'),
      isDanger: true
    });

    if (!confirmed) return;

    const userId = user?.id || 'offline';
    try {
      setIsProcessing(true);
      setProcessMessage(t('settings.converting'));
      await convertCurrentUserMoney(userId, rate);

      setCurrency(targetCurrency);
      setIsCurrencyConversionOpen(false);
      setConversionRate('');
      notify({
        type: 'success',
        title: t('settings.conversionDoneTitle'),
        message: t('settings.conversionDoneMessage', { target: targetOption?.label || targetCurrency })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.unknownError');
      notify({
        type: 'error',
        title: t('settings.conversionFailedTitle'),
        message
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      style={{ maxWidth: '620px', width: '92%', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      overlayStyle={{ zIndex: 9999 }}
    >
      <header className="modal-shell-header settings-modal-header">
        <div className="modal-shell-header-left settings-modal-header-left">
          <div className="modal-shell-icon settings-modal-icon">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="modal-shell-title settings-modal-title">{t('settings.title')}</h2>
            <p className="modal-shell-subtitle settings-modal-subtitle">{user?.email || (isDevBypass ? t('settings.devMode') : t('settings.notLoggedIn'))}</p>
          </div>
        </div>
        <div className="modal-shell-header-right settings-modal-header-right">
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="view-body modal-shell-body settings-body">
        {/* UI Preferences Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>{t('settings.uiPreferences')}</h3>
          </div>
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Languages size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.language')}</h4>
                  <p>{t('settings.languageDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action settings-inline-actions">
                <select
                  className="form-control"
                  value={language}
                  onChange={e => setLanguage(e.target.value as LanguageCode)}
                  aria-label={t('settings.language')}
                >
                  {LANGUAGE_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-list-item settings-theme-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Sun size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.theme')}</h4>
                  <p>{t('settings.themeDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action">
                <div className="theme-segmented-control">
                <button
                  className={`theme-segment-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={16} /> {t('settings.themeLight')}
                </button>
                <button
                  className={`theme-segment-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={16} /> {t('settings.themeDark')}
                </button>
                <button
                  className={`theme-segment-btn ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  <Monitor size={16} /> {t('settings.themeSystem')}
                </button>
                </div>
              </div>
            </div>

            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Film size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.filmMode')}</h4>
                  <p>{t('settings.filmModeDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action compact-toggle">
                <input 
                  type="checkbox" 
                  id="filmModeToggle" 
                  aria-label={t('settings.filmMode')}
                  checked={enableFilmMode}
                  onChange={(e) => handleFilmModeChange(e.target.checked)}
                />
                <label htmlFor="filmModeToggle"></label>
              </div>
            </div>

            <div className="settings-sub-card">
              <div className="settings-sub-card-header settings-sub-card-header-collapsible">
                <div className="settings-sub-card-copy">
                  <div className="settings-item-icon safe"><Folder size={16} /></div>
                  <div className="settings-item-text">
                    <h4>{t('settings.rollTabLayout')}</h4>
                    <p>{t('settings.rollTabLayoutDesc')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`settings-disclosure-button ${isRollTabLayoutExpanded ? 'expanded' : ''}`}
                  onClick={() => setIsRollTabLayoutExpanded(expanded => !expanded)}
                  aria-expanded={isRollTabLayoutExpanded}
                  aria-controls="settings-roll-tab-layout-panel"
                >
                  <span>{isRollTabLayoutExpanded ? t('settings.collapseSection') : t('settings.expandSection')}</span>
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="settings-sub-card-summary">
                <span>{t('settings.currentRollTabOrder')}</span>
                <strong>{visibleRollTabSummary}</strong>
              </div>
              {isRollTabLayoutExpanded && (
              <div className="settings-sub-card-body" id="settings-roll-tab-layout-panel">
                <div className="settings-rolls-toggle-row">
                  <div>
                    <strong>{t('settings.showCollectionsTab')}</strong>
                    <p>{enableFilmMode ? t('settings.collectionsEnabledDesc') : t('settings.collectionsLockedDesc')}</p>
                  </div>
                  <div className="compact-toggle">
                    <input
                      type="checkbox"
                      id="rollsCollectionsToggle"
                      aria-label={t('settings.showCollectionsTab')}
                      checked={enableFilmMode ? rollsCollectionsEnabled : true}
                      disabled={!enableFilmMode}
                      onChange={(e) => handleRollsCollectionsEnabledChange(e.target.checked)}
                    />
                    <label htmlFor="rollsCollectionsToggle"></label>
                  </div>
                </div>

	                <div className="settings-rolls-order-list">
	                  {rollsTabOrder.map((tab, index) => {
	                    const collectionsLocked = tab === 'collections' && !enableFilmMode;
	                    const collectionsHidden = enableFilmMode && !rollsCollectionsEnabled && (tab === 'collections' || tab === 'loose');
	                    return (
	                      <div key={tab} className={`settings-rolls-order-item ${collectionsLocked ? 'locked' : ''} ${collectionsHidden ? 'hidden-tab' : ''}`}>
	                        <div className="settings-rolls-order-copy">
	                          <span>{rollsTabLabels[tab]}</span>
	                          {collectionsLocked && <small>{t('settings.collectionsLocked')}</small>}
	                          {collectionsHidden && <small>{t('settings.collectionsHidden')}</small>}
	                        </div>
                        <div className="settings-rolls-order-actions">
                          <button
                            type="button"
                            className="secondary btn-sm"
                            onClick={() => moveRollsTab(tab, 'up')}
                            disabled={index === 0}
                            aria-label={t('settings.moveUp', { label: rollsTabLabels[tab] })}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="secondary btn-sm"
                            onClick={() => moveRollsTab(tab, 'down')}
                            disabled={index === rollsTabOrder.length - 1}
                            aria-label={t('settings.moveDown', { label: rollsTabLabels[tab] })}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>

            <div className="settings-list-item settings-currency-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Coins size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.currency')}</h4>
                  <p>{t('settings.currencyDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action settings-inline-actions">
                <select
                  className="form-control"
                  value={currency}
                  onChange={e => setCurrency(e.target.value as CurrencyCode)}
                >
                  {CURRENCY_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.symbol} {t(`currency.${option.code}` as any)}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() => {
                    setTargetCurrency(currency === 'CNY' ? 'USD' : 'CNY');
                    setConversionRate('');
                    setIsCurrencyConversionOpen(true);
                  }}
                  disabled={isProcessing}
                >
                  {t('settings.batchConvert')}
                </button>
              </div>
            </div>
            {pendingPhotoUploadCount > 0 && (
              <div className="settings-list-item">
                <div className="settings-item-content">
                  <div className="settings-item-icon safe"><CloudUpload size={18} /></div>
                  <div className="settings-item-text">
                    <h4>{t('settings.repairPhotosTitle')}</h4>
                    <p>{t('settings.repairPhotosDesc', { count: pendingPhotoUploadCount })}</p>
                  </div>
                </div>
                <div className="settings-item-action">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleRepairPendingPhotos}
                    disabled={isProcessing}
                  >
                    {t('settings.repairPhotosAction', { count: pendingPhotoUploadCount })}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3>{t('settings.dataOwnership')}</h3>
          </div>
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Download size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.exportMetadataTitle')}</h4>
                  <p>{t('settings.exportMetadataDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action">
                <button 
                  className="primary" 
                  onClick={handleExport}
                  disabled={isProcessing}
                >
                  {isProcessing ? t('common.loading') : t('settings.exportMetadataAction')}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="processing-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '16px', color: 'white' }}>{processMessage}</p>
        </div>
      )}

      <Modal
        isOpen={isCurrencyConversionOpen}
        onClose={() => setIsCurrencyConversionOpen(false)}
        style={{ maxWidth: '520px', width: '90%' }}
        overlayStyle={{ zIndex: 10001 }}
      >
        <h3>{t('settings.manualConversionTitle')}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
          {t('settings.manualConversionDescription', { currency })}
        </p>
        <form onSubmit={handleCurrencyConversion}>
          <div className="form-group">
            <label>{t('settings.targetCurrency')}</label>
            <select
              className="form-control"
              value={targetCurrency}
              onChange={e => setTargetCurrency(e.target.value as CurrencyCode)}
              required
            >
              {CURRENCY_OPTIONS.map(option => (
                <option key={option.code} value={option.code}>
                  {option.symbol} {t(`currency.${option.code}` as any)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.manualRateLabel', { currency, target: targetCurrency })}</label>
            <input
              type="number"
              className="form-control"
              min="0"
              step="0.000001"
              placeholder={t('settings.manualRatePlaceholder', {
                symbol: currencySymbol,
                target: targetCurrency,
                currency,
              })}
              value={conversionRate}
              onChange={e => setConversionRate(e.target.value)}
              required
            />
          </div>
          <p style={{ color: 'var(--danger)', fontSize: '12px', lineHeight: 1.5 }}>
            {t('settings.manualConversionWarning')}
          </p>
          <div className="modal-actions">
            <button type="button" onClick={() => setIsCurrencyConversionOpen(false)}>{t('settings.cancelConversion')}</button>
            <button type="submit" className="warning">{t('settings.confirmConversion')}</button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
};
