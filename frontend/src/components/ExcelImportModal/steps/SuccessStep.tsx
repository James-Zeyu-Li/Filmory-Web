import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportExcelTranslator, ImportResult } from '../../../services/importExcelData';

interface SuccessStepProps {
  t: ImportExcelTranslator;
  result: ImportResult;
  onClose: () => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({ t, result, onClose }) => {
  const navigate = useNavigate();
  const { instantArchive } = result;

  const handleViewRolls = () => {
    onClose();
    navigate('/rolls?tab=all');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 style={{ margin: 0 }}>{t('excel.successTitle')}</h4>

      <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {t('excel.successRollCount', { count: instantArchive.importedRollCount })}
        </p>

        {instantArchive.isFallbackSummary ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {t('excel.successFallbackMessage')}
          </p>
        ) : (
          <>
            {instantArchive.dateRange && (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('excel.successDateRange', {
                  earliest: new Date(instantArchive.dateRange.earliest).toLocaleDateString(),
                  latest: new Date(instantArchive.dateRange.latest).toLocaleDateString(),
                })}
              </p>
            )}
            {instantArchive.topCamera && (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('excel.successTopCamera', { name: instantArchive.topCamera.name, count: instantArchive.topCamera.count })}
              </p>
            )}
            {instantArchive.topFilmStock && (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('excel.successTopFilmStock', { label: instantArchive.topFilmStock.label, count: instantArchive.topFilmStock.count })}
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="secondary" onClick={onClose}>{t('excel.successDismiss')}</button>
        <button className="primary" onClick={handleViewRolls}>{t('excel.successViewRolls')}</button>
      </div>
    </div>
  );
};
