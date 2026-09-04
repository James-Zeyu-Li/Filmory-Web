import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { useAuth } from '../../contexts/useAuth';
import { useLanguage } from '../../contexts/useLanguage';
import { AccountTab } from './AccountTab';
import { InterfaceTab } from './InterfaceTab';
import { DataTab } from './DataTab';
import './SettingsView.css';

export type SettingsTabId = 'account' | 'interface' | 'data';

interface SettingsViewProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  onClose: () => void;
  enableFilmMode: boolean;
  setEnableFilmMode: (enabled: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeTab,
  onTabChange,
  onClose,
  enableFilmMode,
  setEnableFilmMode,
}) => {
  const { user, isDevBypass } = useAuth();
  const { t } = useLanguage();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      style={{ maxWidth: '620px', width: '92%', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      overlayStyle={{ zIndex: 9999 }}
    >
      <div className="settings-view">
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
            <button className="icon-btn" onClick={onClose} aria-label={t('common.cancel')}><X size={18} /></button>
          </div>
        </header>

        <PageTabs
          className="settings-tabs"
          tabs={[
            { id: 'account', label: t('settings.tabAccount') },
            { id: 'interface', label: t('settings.tabInterface') },
            { id: 'data', label: t('settings.tabData') },
          ] as const}
          activeId={activeTab}
          onChange={onTabChange}
          ariaLabel={t('settings.title')}
          idPrefix="settings"
        />

        <div
          id={`settings-${activeTab}-panel`}
          className="view-body modal-shell-body settings-body"
          role="tabpanel"
          aria-labelledby={`settings-${activeTab}-tab`}
        >
          {activeTab === 'account' && <AccountTab onCloseSettings={onClose} />}
          {activeTab === 'interface' && (
            <InterfaceTab
              enableFilmMode={enableFilmMode}
              setEnableFilmMode={setEnableFilmMode}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              setProcessMessage={setProcessMessage}
            />
          )}
          {activeTab === 'data' && (
            <DataTab
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              setProcessMessage={setProcessMessage}
              onDeleted={onClose}
            />
          )}
        </div>

        {isProcessing && (
          <div className="processing-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'white' }}>{processMessage}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
