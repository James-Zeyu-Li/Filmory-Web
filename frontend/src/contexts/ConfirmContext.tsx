import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { AlertTriangle, Info } from 'lucide-react';
import { ConfirmContext, type ConfirmOptions } from './confirmContextCore';
import { useLanguage } from './useLanguage';

interface ConfirmProviderProps {
  children: ReactNode;
}

// Confirmation dialogs must remain actionable above regular modal workflows.
const CONFIRM_OVERLAY_Z_INDEX = 10000;

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<(value: boolean) => void>(() => () => {});
  const { t } = useLanguage();

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleConfirm = () => {
    resolver(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolver(false);
    setIsOpen(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <Modal
          isOpen={isOpen}
          onClose={handleCancel}
          style={{ maxWidth: '400px' }}
          overlayStyle={{ zIndex: CONFIRM_OVERLAY_Z_INDEX }}
          portal
        >
          <div className="confirm-dialog">
            <div className="modal-header confirm-dialog-header">
              {options.isDanger ? (
                <span className="confirm-dialog-icon danger" aria-hidden="true"><AlertTriangle size={19} /></span>
              ) : (
                <span className="confirm-dialog-icon" aria-hidden="true"><Info size={19} /></span>
              )}
              <h2>{options.title}</h2>
            </div>
            <div className="modal-body confirm-dialog-body">{options.message}</div>
            <div className="modal-footer confirm-dialog-actions">
              <button className="secondary" onClick={handleCancel}>
                {options.cancelText || t('common.cancel')}
              </button>
              <button
                className={options.isDanger ? 'primary danger' : 'primary'}
                onClick={handleConfirm}
              >
                {options.confirmText || t('common.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
};
