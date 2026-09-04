import React, { useState } from 'react';
import { Cloud, CloudUpload, Download, UploadCloud, UserX } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { ExcelImportModal } from '../../components/ExcelImportModal';
import { BackupService } from '../../services/backupService';
import { deleteCurrentAccount } from '../../services/accountService';
import { useAuth } from '../../contexts/useAuth';
import { useFeedback } from '../../contexts/useFeedback';
import { useLanguage } from '../../contexts/useLanguage';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { usePhotoAssets } from '../../hooks/useData';
import { SyncService } from '../../services/syncService';
import { requestImmediateSync } from '../../services/syncEvents';
import {
  countPendingPhotoRepairs,
  repairPendingPhotoUploads,
} from '../../services/photoUploadRecoveryService';
import './DataTab.css';

interface DataTabProps {
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  setProcessMessage: (message: string) => void;
  onDeleted: () => void;
}

export const DataTab: React.FC<DataTabProps> = ({ isProcessing, setIsProcessing, setProcessMessage, onDeleted }) => {
  const { user, isDevBypass, isTrial, completeSignedOutTransition } = useAuth();
  const { t } = useLanguage();
  const { notify } = useFeedback();
  const syncStatus = useSyncStatus();
  const photoAssets = usePhotoAssets();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const pendingPhotoRepairCount = user && SyncService.isAutoSyncEnabled()
    ? countPendingPhotoRepairs(photoAssets)
    : 0;

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
    if (!user || pendingPhotoRepairCount === 0) return;

    try {
      setIsProcessing(true);
      setProcessMessage(t('settings.repairingPhotos'));
      const result = await repairPendingPhotoUploads(user.id);
      const completed = result.uploaded + result.cleaned;

      if (completed > 0) {
        requestImmediateSync('photo-upload-recovery');
      }

      if (result.failed > 0) {
        notify({
          type: completed > 0 ? 'info' : 'error',
          title: t(completed > 0 ? 'settings.repairPhotosPartialTitle' : 'settings.repairPhotosFailedTitle'),
          message: completed > 0
            ? t('settings.repairPhotosPartialMessage', { completed, failed: result.failed })
            : t('settings.repairPhotosFailedMessage'),
        });
        return;
      }

      notify({
        type: 'success',
        title: t('settings.repairPhotosDoneTitle'),
        message: t('settings.repairPhotosDoneMessage', { completed }),
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

  const closeDeleteConfirmation = () => {
    setDeleteConfirmationStep(0);
    setDeleteInput('');
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      setDeleteInput('');
      setDeleteError('');
      return;
    }

    if (deleteConfirmationStep === 1) {
      if (deleteInput.trim() !== 'DELETE') {
        setDeleteError(t('settings.deleteInputError'));
        return;
      }

      try {
        setIsDeletingAccount(true);
        // Neither dev bypass nor trial has a real Supabase session to call
        // delete_user against — deleteCurrentAccount() would throw for both.
        if (!isDevBypass && !isTrial) {
          await deleteCurrentAccount();
        }
        completeSignedOutTransition('deletingAccount');
        onDeleted();
      } catch (error) {
        const message = error instanceof Error ? error.message : t('settings.unknownError');
        notify({
          type: 'error',
          title: t('settings.deleteFailedTitle'),
          message
        });
      } finally {
        setIsDeletingAccount(false);
      }
    }
  };

  return (
    <>
    <div className="settings-section">
    <div className="settings-list-group">
      <div className="account-detail-grid">
        <div className="account-detail-item">
          <span>{t('account.cloudSync')}</span>
          <strong className={`sync-${syncStatus}`}>
            <Cloud size={14} />
            {t(`syncStatus.${syncStatus === 'needs_attention' ? 'needsAttention' : syncStatus}` as any)}
          </strong>
        </div>
      </div>

      {pendingPhotoRepairCount > 0 && (
        <div className="settings-list-item settings-stack-on-mobile">
          <div className="settings-item-content">
            <div className="settings-item-icon safe"><CloudUpload size={18} /></div>
            <div className="settings-item-text">
              <h4>{t('settings.repairPhotosTitle')}</h4>
              <p>{t('settings.repairPhotosDesc', { count: pendingPhotoRepairCount })}</p>
            </div>
          </div>
          <div className="settings-item-action">
            <button
              type="button"
              className="secondary"
              onClick={handleRepairPendingPhotos}
              disabled={isProcessing}
            >
              {t('settings.repairPhotosAction', { count: pendingPhotoRepairCount })}
            </button>
          </div>
        </div>
      )}

      <div className="settings-list-item settings-stack-on-mobile">
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

      <div className="settings-list-item settings-stack-on-mobile">
        <div className="settings-item-content">
          <div className="settings-item-icon safe"><UploadCloud size={18} /></div>
          <div className="settings-item-text">
            <h4>{t('settings.batchImportTitle')}</h4>
            <p>{t('settings.batchImportDesc')}</p>
          </div>
        </div>
        <div className="settings-item-action">
          <button
            className="primary"
            onClick={() => setIsImportModalOpen(true)}
            disabled={isProcessing}
          >
            {t('settings.batchImportAction')}
          </button>
        </div>
      </div>
    </div>
    </div>

    {(user || isDevBypass) && (
      <div className="settings-section">
        <div className="section-header">
          <h3>{t('settings.accountSecurity')}</h3>
        </div>
        <div className="settings-list-group">
          <div className="settings-list-item settings-stack-on-mobile danger-zone">
            <div className="settings-item-content">
              <div className="settings-item-icon danger"><UserX size={18} /></div>
              <div className="settings-item-text">
                <h4>{isDevBypass ? t('account.devDeleteTitle') : isTrial ? t('account.trialDeleteTitle') : t('settings.deleteTitle')}</h4>
                <p>{isDevBypass ? t('account.devDeleteDesc') : isTrial ? t('account.trialDeleteDesc') : t('settings.deleteDesc')}</p>
              </div>
            </div>
            <div className="settings-item-action">
              <button
                type="button"
                className={`${isDevBypass || isTrial ? 'secondary' : 'danger'} btn-sm`}
                onClick={handleDeleteAccount}
                disabled={isProcessing || isDeletingAccount}
                aria-haspopup="dialog"
              >
                {isDevBypass ? t('account.devDeleteAction') : isTrial ? t('account.trialDeleteAction') : t('settings.deleteStart')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {isImportModalOpen && <ExcelImportModal onClose={() => setIsImportModalOpen(false)} />}

      <Modal
        isOpen={deleteConfirmationStep === 1}
        onClose={closeDeleteConfirmation}
        style={{ maxWidth: '420px', width: 'calc(100vw - 32px)' }}
        overlayStyle={{ zIndex: 10001 }}
      >
        <section className="account-delete-dialog" aria-labelledby="delete-account-dialog-title">
          <h3 id="delete-account-dialog-title">
            {isDevBypass ? t('account.devDeleteTitle') : isTrial ? t('account.trialDeleteTitle') : t('settings.deleteConfirmTitle')}
          </h3>
          <p>
            {isDevBypass || isTrial
              ? (isDevBypass ? t('account.devDeleteDesc') : t('account.trialDeleteDesc'))
              : <>{t('settings.deleteConfirmDescPrefix')} <code>DELETE</code> {t('settings.deleteConfirmDescSuffix')}</>}
          </p>
          <label htmlFor="delete-account-confirmation">{t('settings.deleteInputAria')}</label>
          <input
            id="delete-account-confirmation"
            type="text"
            placeholder="DELETE"
            value={deleteInput}
            onChange={(event) => {
              setDeleteInput(event.target.value);
              if (deleteError) setDeleteError('');
            }}
            aria-invalid={Boolean(deleteError)}
            aria-describedby={deleteError ? 'delete-account-error' : undefined}
            autoFocus
          />
          {deleteError && <p id="delete-account-error" className="account-delete-error" role="alert">{deleteError}</p>}
          <div className="account-delete-dialog-actions">
            <button type="button" className="secondary" onClick={closeDeleteConfirmation} disabled={isDeletingAccount}>
              {t('common.cancel')}
            </button>
            <button type="button" className="danger" onClick={handleDeleteAccount} disabled={isDeletingAccount}>
              {t('settings.deleteConfirmAction')}
            </button>
          </div>
        </section>
      </Modal>
    </>
  );
};
