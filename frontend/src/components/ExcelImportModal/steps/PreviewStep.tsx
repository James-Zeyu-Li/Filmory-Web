import React from 'react';
import type { ImportExcelTranslator, ImportPreview, ImportRowResult } from '../../../services/importExcelData';

interface PreviewStepProps {
  t: ImportExcelTranslator;
  preview: ImportPreview;
  hasVisitedMapping: boolean;
  onBackToMapping: () => void;
  onContinue: () => void;
}

const allRows = (preview: ImportPreview): ImportRowResult[] => ([
  ...preview.rows.cameras,
  ...preview.rows.lenses,
  ...preview.rows.filmStocks,
  ...preview.rows.rolls,
]);

const issueRows = (rows: ImportRowResult[], status: 'warning' | 'rejected') => rows.filter(row => row.status === status);

export const PreviewStep: React.FC<PreviewStepProps> = ({ t, preview, hasVisitedMapping, onBackToMapping, onContinue }) => {
  const rows = allRows(preview);
  const rejected = issueRows(rows, 'rejected');
  const warnings = issueRows(rows, 'warning');
  const canContinue = preview.counts.valid > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 style={{ margin: 0 }}>{t('excel.previewStepTitle')}</h4>

      <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
        <span style={{ color: 'var(--accent)' }}>{t('excel.previewValidCount', { count: preview.counts.valid })}</span>
        {preview.counts.warning > 0 && (
          <span style={{ color: 'var(--text-secondary)' }}>{t('excel.previewWarningCount', { count: preview.counts.warning })}</span>
        )}
        {preview.counts.rejected > 0 && (
          <span style={{ color: 'var(--danger, #e5484d)' }}>{t('excel.previewRejectedCount', { count: preview.counts.rejected })}</span>
        )}
      </div>

      {!canContinue && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--danger, #e5484d)' }}>{t('excel.previewNoValidRows')}</p>
      )}

      {(rejected.length > 0 || warnings.length > 0) && (
        <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[...rejected, ...warnings].map(row => (
            row.issues.map((issue, index) => (
              <p
                key={`${row.rowRef}:${index}`}
                style={{ margin: 0, fontSize: '12px', color: row.status === 'rejected' ? 'var(--danger, #e5484d)' : 'var(--text-secondary)' }}
              >
                {t('excel.rowError', {
                  sheet: row.sheet,
                  row: row.rowNumber,
                  field: issue.field,
                  reason: t(issue.reasonKey, issue.reasonValues),
                })}
              </p>
            ))
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {hasVisitedMapping ? (
          <button className="secondary" onClick={onBackToMapping}>{t('excel.previewBackToMapping')}</button>
        ) : <span />}
        <button className="primary" onClick={onContinue} disabled={!canContinue}>
          {t('excel.previewContinueButton')}
        </button>
      </div>
    </div>
  );
};
