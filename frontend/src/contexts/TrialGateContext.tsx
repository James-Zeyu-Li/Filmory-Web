import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useAuth } from './useAuth';
import { useLanguage } from './useLanguage';
import { TrialGateContext } from './trialGateContextCore';
import {
  TRIAL_RESOURCE_LABEL_KEYS,
  canCreateTrialResource,
  getTrialLimitMessage,
  type TrialResourceKey,
} from '../services/trialPolicy';
import { AUTH_ROUTES } from '../services/authFlow';
import './TrialGate.css';

export const TrialGateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { authMode } = useAuth();
  const { t } = useLanguage();
  const [blockedResource, setBlockedResource] = useState<TrialResourceKey | null>(null);

  const requireRegistration = useCallback((resource: TrialResourceKey) => {
    setBlockedResource(resource);
  }, []);

  const guardTrialResource = useCallback(({
    resource,
    currentCount,
  }: {
    resource: TrialResourceKey;
    currentCount: number;
  }) => {
    if (authMode !== 'trial') return true;
    if (canCreateTrialResource(currentCount)) return true;

    setBlockedResource(resource);
    return false;
  }, [authMode]);

  const closeModal = () => setBlockedResource(null);
  const resourceLabel = blockedResource ? t(TRIAL_RESOURCE_LABEL_KEYS[blockedResource]) : t('trial.resource.content');

  return (
    <TrialGateContext.Provider value={{ guardTrialResource, requireRegistration }}>
      {children}
      <Modal
        isOpen={Boolean(blockedResource)}
        onClose={closeModal}
        style={{ maxWidth: 520, width: 'calc(100vw - 32px)' }}
      >
        {blockedResource && (
          <div className="trial-registration-modal">
            <div className="trial-registration-hero">
              <span className="trial-registration-icon">
                <LockKeyhole size={20} />
              </span>
              <div className="trial-registration-copy">
                <h2>{t('trial.registrationTitle')}</h2>
                <p>{getTrialLimitMessage(blockedResource, t)}</p>
              </div>
            </div>

            <div className="trial-registration-note">
              {t('trial.registrationNote')}
            </div>

            <div className="trial-registration-actions">
              <button type="button" className="secondary" onClick={closeModal}>
                {t('trial.keepTrial')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  closeModal();
                  navigate(AUTH_ROUTES.login);
                }}
              >
                {t('trial.loginExisting')}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  closeModal();
                  navigate(`${AUTH_ROUTES.login}?mode=signup&trial=1&resource=${encodeURIComponent(resourceLabel)}`);
                }}
              >
                {t('trial.signupKeepData')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </TrialGateContext.Provider>
  );
};
