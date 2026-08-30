import React from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useLanguage } from '../../contexts/useLanguage';
import { Modal } from '../Modal';
import { useExcelImportWizard } from './useExcelImportWizard';
import { UploadStep } from './steps/UploadStep';
import { MappingStep } from './steps/MappingStep';
import { PreviewStep } from './steps/PreviewStep';
import { DuplicateStep } from './steps/DuplicateStep';
import { SuccessStep } from './steps/SuccessStep';

interface ExcelImportModalProps {
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const wizard = useExcelImportWizard(user?.id ?? '', t);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      portal
      overlayStyle={{ zIndex: 10000 }}
      style={{ maxWidth: '560px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>{t('excel.importTitle')}</h3>
        <button className="icon-btn" onClick={onClose}><X size={20} /></button>
      </div>

      {wizard.step === 'upload' && (
        <UploadStep t={t} isBusy={wizard.isBusy} onFileSelected={wizard.handleFileSelected} />
      )}

      {wizard.step === 'mapping' && wizard.preview && (
        <MappingStep
          t={t}
          preview={wizard.preview}
          pendingEdits={wizard.pendingMappingEdits}
          isBusy={wizard.isBusy}
          onChoose={wizard.updateMappingChoice}
          onConfirm={wizard.confirmMappingAndRevalidate}
        />
      )}

      {wizard.step === 'preview' && wizard.preview && (
        <PreviewStep
          t={t}
          preview={wizard.preview}
          hasVisitedMapping={wizard.hasVisitedMapping}
          onBackToMapping={wizard.goBackToMapping}
          onContinue={wizard.confirmPreview}
        />
      )}

      {wizard.step === 'duplicates' && wizard.preview && (
        <DuplicateStep
          t={t}
          preview={wizard.preview}
          duplicateChoices={wizard.duplicateChoices}
          isBusy={wizard.isBusy}
          onChoose={wizard.setDuplicateChoice}
          onConfirm={wizard.submitImport}
        />
      )}

      {wizard.step === 'submitting' && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('common.loading')}</p>
      )}

      {wizard.step === 'success' && wizard.result && (
        <SuccessStep t={t} result={wizard.result} onClose={onClose} />
      )}

      {wizard.step === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, color: 'var(--danger, #e5484d)' }}>{t('excel.wizardErrorTitle')}</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{wizard.errorMessage}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="secondary" onClick={wizard.restart}>{t('excel.cancelImport')}</button>
            <button className="primary" onClick={wizard.retryAfterError}>{t('excel.wizardErrorRetry')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
};
