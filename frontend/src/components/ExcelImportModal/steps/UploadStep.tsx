import React, { useRef, useState } from 'react';
import { Download, UploadCloud, AlertCircle, X } from 'lucide-react';
import { downloadExcelTemplate, type ImportExcelTranslator } from '../../../services/importExcelData';

interface UploadStepProps {
  t: ImportExcelTranslator;
  isBusy: boolean;
  onFileSelected: (file: File) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ t, isBusy, onFileSelected }) => {
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [showInstruction, setShowInstruction] = useState(false);

  const handleDownload = () => {
    downloadExcelTemplate();
    setShowInstruction(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  return (
    <>
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
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)' }}>
            <Download size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.stepDownloadTitle')}</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{t('excel.stepDownloadDesc')}</p>
            <button className="secondary btn-sm" onClick={handleDownload} disabled={isBusy}>
              {t('excel.downloadTemplate')}
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'var(--accent)', padding: '12px', borderRadius: '8px', color: '#fff' }}>
            <UploadCloud size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.stepImportTitle')}</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{t('excel.stepImportDesc')}</p>
            <button className="primary btn-sm" onClick={() => excelInputRef.current?.click()} disabled={isBusy}>
              {isBusy ? t('common.loading') : t('excel.importButton')}
            </button>
            <input
              type="file"
              ref={excelInputRef}
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>
    </>
  );
};
