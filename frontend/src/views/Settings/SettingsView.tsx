import React, { useState } from 'react';
import { BackupService } from '../../services/backupService';
import { Shield, Download, X, LogOut, UserX, Sun, Moon, Monitor, Coins, Film, BadgeCheck, ArrowUp, ArrowDown, Folder, Languages, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';
import { deleteCurrentAccount } from '../../services/accountService';
import { Modal } from '../../components/Modal';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { CURRENCY_OPTIONS, type CurrencyCode } from '../../contexts/currencyContextCore';
import { useLanguage } from '../../contexts/useLanguage';
import { LANGUAGE_OPTIONS, type LanguageCode } from '../../i18n/translations';
import { convertCurrentUserMoney } from '../../services/currencyConversionService';
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
  const { user, logout, completeSignedOutTransition, accountRole, isDevBypass, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, currencySymbol } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isCurrencyConversionOpen, setIsCurrencyConversionOpen] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(() => (
    currency === 'CNY' ? 'USD' : 'CNY'
  ));
  const [conversionRate, setConversionRate] = useState('');
  const [rollsTabOrder, setRollsTabOrder] = useState<RollsTabId[]>(() => readRollsTabOrder());
  const [rollsCollectionsEnabled, setRollsCollectionsEnabled] = useState<boolean>(() => readRollsCollectionsTabEnabled());
  const [isRollTabLayoutExpanded, setIsRollTabLayoutExpanded] = useState(false);

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

  const handleLogout = async () => {
    try {
      setIsProcessing(true);
      setProcessMessage(t('settings.processingLogout'));
      await logout();
      onClose();
    } catch (e) {
      console.error(e);
      notify({
        type: 'error',
        title: t('settings.logoutFailedTitle'),
        message: e instanceof Error ? e.message : t('settings.retryLater')
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      setDeleteError('');
      return;
    }
    
    if (deleteConfirmationStep === 1) {
      if (deleteInput !== 'DELETE') {
        setDeleteError(t('settings.deleteInputError'));
        return;
      }
      
      const finalConfirm = await confirm({
        title: t('settings.deleteFinalTitle'),
        message: t('settings.deleteFinalMessage'),
        confirmText: t('settings.deleteFinalConfirm'),
        cancelText: t('common.cancel'),
        isDanger: true
      });
      if (!finalConfirm) {
        setDeleteConfirmationStep(0);
        setDeleteInput('');
        setDeleteError('');
        return;
      }
      
      try {
        setIsProcessing(true);
        setProcessMessage(t('settings.deletingAccount'));
        
        // Dev bypass is local-only; real Supabase users use the account deletion RPC.
        if (!isDevBypass) {
          await deleteCurrentAccount();
        }
        
        completeSignedOutTransition('deletingAccount');
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : t('settings.unknownError');
        notify({
          type: 'error',
          title: t('settings.deleteFailedTitle'),
          message
        });
        setIsProcessing(false);
        setProcessMessage('');
      }
    }
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
        target: targetOption?.label || targetCurrency,
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
      style={{ maxWidth: '620px', width: '92%', padding: 0, overflow: 'hidden' }}
      overlayStyle={{ zIndex: 9999 }}
    >
      <header className="settings-modal-header">
        <div className="settings-modal-header-left">
          <div className="settings-modal-icon">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="settings-modal-title">{t('settings.title')}</h2>
            <p className="settings-modal-subtitle">{user?.email || (isDevBypass ? t('settings.devMode') : t('settings.notLoggedIn'))}</p>
          </div>
        </div>
        <div className="settings-modal-header-right">
          <span className={`account-role-badge ${isAdmin ? 'admin' : ''}`}>
            <BadgeCheck size={12} />
            {isDevBypass ? t('settings.testAdmin') : accountRole === 'admin' ? t('settings.admin') : t('settings.normalAccount')}
          </span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="view-body settings-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
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

            <div className="settings-list-item settings-list-item-vertical">
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

            <div className="settings-list-item settings-list-item-vertical">
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
                      {option.symbol} {option.label}
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

        {/* Account Management Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>{t('settings.accountSecurity')}</h3>
          </div>
          
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon"><LogOut size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.logoutTitle')}</h4>
                  <p>{t('settings.logoutDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action">
                <button className="secondary" onClick={handleLogout} disabled={isProcessing}>
                  {t('settings.logoutAction')}
                </button>
              </div>
            </div>

            <div className={`settings-list-item danger-zone ${deleteConfirmationStep === 1 ? 'settings-list-item-vertical' : ''}`}>
              <div className="settings-item-content">
                <div className="settings-item-icon danger"><UserX size={18} /></div>
                <div className="settings-item-text">
                  <h4>{t('settings.deleteTitle')}</h4>
                  <p>{t('settings.deleteDesc')}</p>
                </div>
              </div>
              <div className="settings-item-action settings-danger-action">
                {deleteConfirmationStep === 0 ? (
                    <button className="danger" onClick={handleDeleteAccount} disabled={isProcessing}>
                      {t('settings.deleteStart')}
                    </button>
                ) : (
                  <div className="delete-account-confirm-panel">
                    <div className="delete-account-confirm-copy">
                      <strong>{t('settings.deleteConfirmTitle')}</strong>
                      <p>
                        {t('settings.deleteConfirmDescPrefix')} <code>DELETE</code> {t('settings.deleteConfirmDescSuffix')}
                      </p>
                    </div>
                    {deleteError && (
                      <p className="delete-account-error">
                        {deleteError}
                      </p>
                    )}
                    <input 
                      type="text" 
                      placeholder="DELETE"
                      aria-label={t('settings.deleteInputAria')}
                      value={deleteInput}
                      onChange={(e) => {
                        setDeleteInput(e.target.value);
                        if (deleteError) setDeleteError('');
                      }}
                    />
                    <div className="delete-account-confirm-actions">
                      <button className="danger delete-account-confirm-primary" onClick={handleDeleteAccount} disabled={isProcessing}>
                        {t('settings.deleteConfirmAction')}
                      </button>
                      <button className="secondary delete-account-confirm-secondary" onClick={() => {
                        setDeleteConfirmationStep(0);
                        setDeleteInput('');
                        setDeleteError('');
                      }}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
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
        <h3>手动汇率批量换算</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
          当前记账货币为 {currency}。请输入手动汇率，将当前账号里的器材价格、胶卷单价、胶卷记录成本、冲洗费和收支金额一次性换算到目标货币。
        </p>
        <form onSubmit={handleCurrencyConversion}>
          <div className="form-group">
            <label>目标货币</label>
            <select
              className="form-control"
              value={targetCurrency}
              onChange={e => setTargetCurrency(e.target.value as CurrencyCode)}
              required
            >
              {CURRENCY_OPTIONS.map(option => (
                <option key={option.code} value={option.code}>
                  {option.symbol} {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>手动汇率：1 {currency} = ? {targetCurrency}</label>
            <input
              type="number"
              className="form-control"
              min="0"
              step="0.000001"
              placeholder={`例如：当前 ${currencySymbol}1 换算成多少 ${targetCurrency}`}
              value={conversionRate}
              onChange={e => setConversionRate(e.target.value)}
              required
            />
          </div>
          <p style={{ color: 'var(--danger)', fontSize: '12px', lineHeight: 1.5 }}>
            注意：这是一次性批量修改现有金额数值，不会保存原币种，也不会联网获取汇率。
          </p>
          <div className="modal-actions">
            <button type="button" onClick={() => setIsCurrencyConversionOpen(false)}>取消</button>
            <button type="submit" className="warning">确认换算</button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
};
