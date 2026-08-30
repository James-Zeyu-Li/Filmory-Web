import React from 'react';
import type { DuplicateChoice, DuplicateChoiceMap, ImportExcelTranslator, ImportPreview } from '../../../services/importExcelData';

interface DuplicateStepProps {
  t: ImportExcelTranslator;
  preview: ImportPreview;
  duplicateChoices: DuplicateChoiceMap;
  isBusy: boolean;
  onChoose: (groupId: string, choice: DuplicateChoice) => void;
  onConfirm: () => void;
}

const CHOICES: DuplicateChoice[] = ['skip', 'import-as-new', 'update'];

const labelKeyFor: Record<DuplicateChoice, 'excel.duplicateChoiceSkip' | 'excel.duplicateChoiceImportAsNew' | 'excel.duplicateChoiceUpdate'> = {
  skip: 'excel.duplicateChoiceSkip',
  'import-as-new': 'excel.duplicateChoiceImportAsNew',
  update: 'excel.duplicateChoiceUpdate',
};

export const DuplicateStep: React.FC<DuplicateStepProps> = ({ t, preview, duplicateChoices, isBusy, onChoose, onConfirm }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <div>
      <h4 style={{ margin: '0 0 4px 0' }}>{t('excel.duplicateStepTitle')}</h4>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{t('excel.duplicateStepDesc')}</p>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {preview.duplicateGroups.map(group => {
        const choice = duplicateChoices[group.id] ?? 'skip';
        return (
          <div key={group.id} style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <div style={{ marginBottom: '8px', fontSize: '13px' }}>
              <strong>{t('excel.duplicateExistingLabel', { label: group.existing.label })}</strong>
              <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>
                {t('excel.duplicateIncomingCount', { count: group.incomingRowRefs.length })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CHOICES.map(option => {
                const isUpdate = option === 'update';
                return (
                  <label
                    key={option}
                    title={isUpdate ? t('excel.reasonUpdateNotSupported') : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                      opacity: isUpdate ? 0.5 : 1, cursor: isUpdate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`duplicate-${group.id}`}
                      value={option}
                      checked={choice === option}
                      disabled={isUpdate}
                      onChange={() => onChoose(group.id, option)}
                    />
                    {t(labelKeyFor[option])}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>

    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button className="primary" onClick={onConfirm} disabled={isBusy}>
        {t('excel.duplicateConfirmButton')}
      </button>
    </div>
  </div>
);
