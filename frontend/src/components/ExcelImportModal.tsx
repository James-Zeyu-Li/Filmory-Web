import React, { useRef, useState } from 'react';
import { Download, UploadCloud, X, AlertCircle } from 'lucide-react';
import { parseAndValidateExcelImport, commitExcelImport, downloadExcelTemplate } from '../services/importExcelData';
import type { ImportExcelTranslator, ImportRowResult } from '../services/importExcelData';
import { useAuth } from '../contexts/useAuth';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { Modal } from './Modal';

// Stage A keeps this Modal's existing single-step UX unchanged (no mapping/
// preview/duplicate-choice UI yet — that's Stage B). Every duplicate choice
// defaults to 'skip', matching the previous "skip exact-name duplicates"
// behavior; the only thing that changed underneath is that the write is now
// genuinely atomic (see services/importExcelData/commitImport.ts).
const flattenRejectedRowErrors = (rows: ImportRowResult[], t: ImportExcelTranslator): string[] => (
  rows
    .filter(row => row.status === 'rejected')
    .flatMap(row => row.issues.map(rowIssue => t('excel.rowError', {
      sheet: row.sheet,
      row: row.rowNumber,
      field: rowIssue.field,
      reason: t(rowIssue.reasonKey, rowIssue.reasonValues),
    })))
);

interface ExcelImportModalProps {
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const { t } = useLanguage();
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [showInstruction, setShowInstruction] = useState(false);

  const handleDownload = () => {
    downloadExcelTemplate();
    setShowInstruction(true);
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsProcessing(true);
    setProcessMessage(t('excel.processingRead'));
    try {
      const preview = await parseAndValidateExcelImport(file, user.id, t);
      const result = await commitExcelImport(preview, {}, user.id, t);
      const errors = [
        ...flattenRejectedRowErrors(preview.rows.cameras, t),
        ...flattenRejectedRowErrors(preview.rows.lenses, t),
        ...flattenRejectedRowErrors(preview.rows.filmStocks, t),
        ...flattenRejectedRowErrors(preview.rows.rolls, t),
      ];
      let msg = `${t('excel.summaryCameras')}: ${result.createdCounts.camera}\n${t('excel.summaryLenses')}: ${result.createdCounts.lens}\n${t('excel.summaryFilms')}: ${result.createdCounts.filmStock}\n${t('excel.summaryRolls')}: ${result.createdCounts.roll}`;
      if (errors.length > 0) {
        msg += `\n\n${t('excel.summaryIssues', { count: errors.length })}\n` + errors.slice(0, 5).join('\n');
        if (errors.length > 5) msg += `\n${t('excel.summaryMore')}`;
      }
      notify({
        type: errors.length > 0 ? 'info' : 'success',
        title: t('excel.importCompleteTitle'),
        message: msg,
        durationMs: 6000
      });
      onClose();
    } catch (err) {
      notify({
        type: 'error',
        title: t('excel.importFailedTitle'),
        message: err instanceof Error ? err.message : t('excel.parseFallback'),
        durationMs: 6000
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} overlayStyle={{ zIndex: 10000 }} style={{ maxWidth: '500px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3>{t('excel.importTitle')}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {showInstruction && (
          <div style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent)', padding: '16px', borderRadius: '8px', marginBottom: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertCircle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{t('excel.templateDownloadedTitle')}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t('excel.templateDownloadedDesc')}<strong>{t('excel.templateSheets')}</strong>{t('excel.templateDownloadedSuffix')}
                </p>
              </div>
            </div>
            <button 
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={() => setShowInstruction(false)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step 1 */}
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)' }}>
              <Download size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.stepDownloadTitle')}</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{t('excel.stepDownloadDesc')}</p>
              <button className="secondary btn-sm" onClick={handleDownload} disabled={isProcessing}>
                {t('excel.downloadTemplate')}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--accent)', padding: '12px', borderRadius: '8px', color: '#fff' }}>
              <UploadCloud size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.stepImportTitle')}</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{t('excel.stepImportDesc')}</p>
              <button className="primary btn-sm" onClick={() => excelInputRef.current?.click()} disabled={isProcessing}>
                {isProcessing ? processMessage || t('common.loading') : t('excel.importButton')}
              </button>
              <input 
                type="file" 
                ref={excelInputRef} 
                accept=".xlsx, .xls" 
                style={{ display: 'none' }} 
                onChange={handleExcelFileUpload}
              />
            </div>
          </div>
        </div>
    </Modal>
  );
};
