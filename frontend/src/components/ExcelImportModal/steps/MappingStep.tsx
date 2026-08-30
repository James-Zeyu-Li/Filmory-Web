import React from 'react';
import type { ImportColumnMapping, ImportExcelTranslator, ImportPreview } from '../../../services/importExcelData';
import type { MappingEdit } from '../mergeColumnMapping';

interface MappingStepProps {
  t: ImportExcelTranslator;
  preview: ImportPreview;
  pendingEdits: MappingEdit[];
  isBusy: boolean;
  onChoose: (sheet: ImportColumnMapping['sheet'], expectedField: string, matchedHeader: string | null) => void;
  onConfirm: () => void;
}

const resolvedHeaderFor = (
  mapping: ImportColumnMapping,
  pendingEdits: MappingEdit[],
): string | null => {
  const edit = pendingEdits.find(e => e.sheet === mapping.sheet && e.expectedField === mapping.expectedField);
  return edit ? edit.matchedHeader : mapping.matchedHeader;
};

export const MappingStep: React.FC<MappingStepProps> = ({ t, preview, pendingEdits, isBusy, onChoose, onConfirm }) => {
  // `buildColumnMappings` only ever assigns 'needs-user-choice' to required
  // fields (an unmatched non-required field goes straight to 'skipped'), so
  // every mapping rendered here is required and none can be left unmapped.
  const unresolved = preview.mappings.filter(mapping => mapping.status === 'needs-user-choice');
  const allRequiredResolved = unresolved.every(mapping => Boolean(resolvedHeaderFor(mapping, pendingEdits)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.mappingStepTitle')}</h4>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{t('excel.mappingStepDesc')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {unresolved.map(mapping => {
          const headers = preview.actualHeadersBySheet[mapping.sheet] ?? [];
          const resolvedHeader = resolvedHeaderFor(mapping, pendingEdits);
          return (
            <div
              key={`${mapping.sheet}:${mapping.expectedField}`}
              style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <strong>{mapping.sheet} · {mapping.expectedLabel}</strong>
                <span style={{ fontSize: '11px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '0 6px' }}>
                  {t('excel.mappingFieldRequired')}
                </span>
              </div>
              <select
                className="form-control"
                value={resolvedHeader ?? ''}
                onChange={e => onChoose(mapping.sheet, mapping.expectedField, e.target.value || null)}
              >
                <option value="">{t('excel.mappingChooseHeader')}</option>
                {headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {!allRequiredResolved && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger, #e5484d)' }}>{t('excel.mappingUnresolvedError')}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="primary" onClick={onConfirm} disabled={isBusy || !allRequiredResolved}>
          {t('excel.mappingConfirmButton')}
        </button>
      </div>
    </div>
  );
};
