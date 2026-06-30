import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { AlertTriangle, Info } from 'lucide-react';
import { ConfirmContext, type ConfirmOptions } from './confirmContextCore';

interface ConfirmProviderProps {
  children: ReactNode;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<(value: boolean) => void>(() => () => {});

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
        <Modal isOpen={isOpen} onClose={handleCancel} style={{ maxWidth: '400px' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {options.isDanger ? (
                <AlertTriangle size={20} color="var(--danger-color)" />
              ) : (
                <Info size={20} color="var(--accent)" />
              )}
              <h3 style={{ margin: 0, fontSize: '18px' }}>{options.title}</h3>
            </div>
          </div>
          <div className="modal-body" style={{ margin: '16px 0', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {options.message}
          </div>
          <div className="modal-footer" style={{ marginTop: '24px' }}>
            <button className="secondary" onClick={handleCancel}>
              {options.cancelText || '取消'}
            </button>
            <button 
              className={options.isDanger ? 'primary danger' : 'primary'} 
              onClick={handleConfirm}
            >
              {options.confirmText || '确认'}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
};
