import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useAuth } from './useAuth';
import { TrialGateContext } from './trialGateContextCore';
import {
  TRIAL_RESOURCE_LABELS,
  canCreateTrialResource,
  getTrialLimitMessage,
  type TrialResourceKey,
} from '../services/trialPolicy';
import { AUTH_ROUTES } from '../services/authFlow';
import '../components/TrialRegistrationModal.css';

export const TrialGateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { authMode } = useAuth();
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
  const resourceLabel = blockedResource ? TRIAL_RESOURCE_LABELS[blockedResource] : '内容';

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
                <h2>注册后继续完整记录</h2>
                <p>{getTrialLimitMessage(blockedResource)}</p>
              </div>
            </div>

            <div className="trial-registration-note">
              当前试用数据保存在这台设备上。注册后我们会引导你把试用记录保存到账号，避免之后换设备时丢失。
            </div>

            <div className="trial-registration-actions">
              <button type="button" className="secondary" onClick={closeModal}>
                继续只看试用数据
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  closeModal();
                  navigate(AUTH_ROUTES.login);
                }}
              >
                登录已有账号
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  closeModal();
                  navigate(`${AUTH_ROUTES.login}?mode=signup&trial=1&resource=${encodeURIComponent(resourceLabel)}`);
                }}
              >
                注册并保留试用数据
              </button>
            </div>
          </div>
        )}
      </Modal>
    </TrialGateContext.Provider>
  );
};
