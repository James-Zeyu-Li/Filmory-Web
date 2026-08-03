import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Crown,
  LogIn,
  LogOut,
  Shield,
  UserRound,
  X,
} from 'lucide-react';
import { Modal } from './Modal';
import { UpgradeModal } from './UpgradeModal';
import { useAuth } from '../contexts/useAuth';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { db } from '../db/schema';
import { useUserProfile } from '../hooks/useData';
import { useUserTier } from '../hooks/useUserTier';
import { SyncService } from '../services/syncService';
import { AUTH_ROUTES } from '../services/authFlow';
import {
  buildLocalUserProfile,
  getUserMetadataDisplayName,
  getDisplayNameValidationMessage,
  normalizeDisplayName,
} from '../services/userProfile';
import { supabase } from '../services/supabaseClient';
import { requestImmediateSync } from '../services/syncEvents';
import './AccountCenterModal.css';

interface AccountCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountCenterModal: React.FC<AccountCenterModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { notify } = useFeedback();
  const { user, authMode, accountRole, isDevBypass, isTrial, logout } = useAuth();
  const userProfile = useUserProfile();
  const { tier, isLoading: isTierLoading, capabilities } = useUserTier();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);

  const isAuthenticatedAccount = Boolean(user && authMode === 'supabase');
  const canManageProfile = Boolean(user || isDevBypass);
  const isCloudSyncEnabled = SyncService.isAutoSyncEnabled();
  const storedDisplayName = normalizeDisplayName(userProfile?.displayName) || getUserMetadataDisplayName(user);
  const displayName = userProfile?.displayName
    || (typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '')
    || user?.email
    || (isTrial ? t('account.trialDisplayName') : t('account.guestDisplayName'));
  const displayNameInput = displayNameDraft ?? storedDisplayName;
  const emailLabel = user?.email || t('account.noEmail');
  const planLabel = isTierLoading
    ? t('account.planLoading')
    : tier === 'vip'
      ? t('account.planVip')
      : t('account.planRegular');
  const activeRollLimitLabel = capabilities.activeRollLimit === null
    ? t('account.activeRollUnlimited')
    : t('account.activeRollLimited', { limit: capabilities.activeRollLimit });

  const goToLogin = () => {
    onClose();
    navigate(AUTH_ROUTES.login);
  };

  const goToSignup = () => {
    onClose();
    navigate(`${AUTH_ROUTES.login}?mode=signup&trial=1`);
  };

  const handleDisplayNameSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) return;

    const validationMessage = getDisplayNameValidationMessage(displayNameInput, t);
    if (validationMessage) {
      notify({
        type: 'error',
        title: t('account.displayNameInvalidTitle'),
        message: validationMessage,
      });
      return;
    }

    const normalizedDisplayName = normalizeDisplayName(displayNameInput);
    const existingProfile = userProfile || await db.userProfiles.get(user.id);

    try {
      setIsSavingProfile(true);
      await db.userProfiles.put(buildLocalUserProfile({
        userId: user.id,
        role: accountRole,
        existingProfile: existingProfile || undefined,
        displayName: normalizedDisplayName,
      }));
      requestImmediateSync('profile-save');
      setDisplayNameDraft(null);

      if (!isDevBypass && !isTrial) {
        const { error } = await supabase.auth.updateUser({
          data: {
            display_name: normalizedDisplayName,
          },
        });
        if (error) throw error;
      }

      notify({
        type: 'success',
        title: t('account.displayNameSavedTitle'),
        message: t('account.displayNameSavedMessage'),
      });
    } catch (error) {
      notify({
        type: 'error',
        title: t('account.displayNameSaveFailedTitle'),
        message: error instanceof Error ? error.message : t('account.displayNameSaveFailedMessage'),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
      navigate(AUTH_ROUTES.login, { replace: true });
    } catch (error) {
      console.error('Logout failed', error);
      notify({
        type: 'error',
        title: t('account.logoutFailedTitle'),
        message: t('account.logoutFailedMessage'),
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchToRealAccount = async () => {
    await handleLogout();
  };

  const statusIcon = isTrial
    ? <AlertTriangle size={18} />
    : isDevBypass
      ? <Shield size={18} />
      : isAuthenticatedAccount
        ? <CheckCircle2 size={18} />
        : <LogIn size={18} />;

  const statusTitle = isTrial
    ? t('account.trialTitle')
    : isDevBypass
      ? t('account.devTitle')
      : isAuthenticatedAccount
        ? t('account.signedInTitle')
        : t('account.guestTitle');

  const statusDescription = isTrial
    ? t('account.trialDesc')
    : isDevBypass
      ? t('account.devDesc')
      : isAuthenticatedAccount
        ? t('account.signedInDesc')
        : t('account.guestDesc');

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        style={{ maxWidth: '560px', width: 'calc(100vw - 32px)' }}
      >
        <div className="account-center">
          <div className="modal-header account-center-header">
            <div>
              <h2>{t('account.title')}</h2>
              <p>{t('account.subtitle')}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label={t('common.cancel')}
            >
              <X size={18} />
            </button>
          </div>

          <section className={`account-status-card ${isTrial ? 'trial' : ''} ${isDevBypass ? 'dev' : ''}`}>
            <div className="account-status-icon">{statusIcon}</div>
            <div>
              <h3>{statusTitle}</h3>
              <p>{statusDescription}</p>
            </div>
          </section>

          {canManageProfile && (
            <section className="account-profile-card">
              <div className="account-avatar" aria-hidden="true">
                <UserRound size={26} />
              </div>
              <div className="account-profile-main">
                <h3>{displayName}</h3>
                <p>{emailLabel}</p>
              </div>
              <span className={`account-tier-pill ${tier === 'vip' ? 'vip' : ''}`}>
                {planLabel}
              </span>
            </section>
          )}

          {canManageProfile && (
            <section className="account-profile-editor-card">
              <div className="account-section-heading">
                <h4>{t('account.profileSection')}</h4>
                <p>{t('account.profileSectionDesc')}</p>
              </div>
              <form onSubmit={handleDisplayNameSave} className="account-profile-form">
                <input
                  type="text"
                  className="form-control"
                  value={displayNameInput}
                  onChange={event => setDisplayNameDraft(event.target.value)}
                  placeholder={t('account.displayNamePlaceholder')}
                  maxLength={40}
                />
                <button type="submit" className="secondary" disabled={isSavingProfile}>
                  {isSavingProfile ? t('common.loading') : t('account.displayNameSave')}
                </button>
              </form>
            </section>
          )}

          {canManageProfile && (
            <div className="account-detail-grid">
              <div className="account-detail-item">
                <span>{t('account.role')}</span>
                <strong>{accountRole === 'admin' ? t('account.roleAdmin') : t('account.roleUser')}</strong>
              </div>
              <div className="account-detail-item">
                <span>{t('account.activeRollLimit')}</span>
                <strong>{activeRollLimitLabel}</strong>
              </div>
              <div className="account-detail-item account-detail-wide">
                <span>{t('account.cloudSync')}</span>
                <strong className={isCloudSyncEnabled ? 'sync-enabled' : 'sync-disabled'}>
                  <Cloud size={14} />
                  {isCloudSyncEnabled ? t('account.cloudSyncOn') : t('account.cloudSyncOff')}
                </strong>
              </div>
            </div>
          )}

          {(isTrial || !user) && (
            <div className="account-trial-actions">
              <button type="button" className="primary btn-lg" onClick={goToSignup}>
                <Cloud size={16} />
                {t('account.signup')}
              </button>
              <button type="button" className="secondary btn-lg" onClick={goToLogin}>
                <LogIn size={16} />
                {t('account.login')}
              </button>
              {isTrial && (
                <button type="button" className="account-text-button" onClick={onClose}>
                  {t('account.keepTrial')}
                </button>
              )}
            </div>
          )}

          {(isAuthenticatedAccount || isDevBypass) && (
            <div className="account-actions">
              {!isTierLoading && tier !== 'vip' && (
                <button type="button" className="primary" onClick={() => setIsUpgradeModalOpen(true)}>
                  <Crown size={16} />
                  {t('account.upgradeVip')}
                </button>
              )}
              {isDevBypass && (
                <button type="button" className="secondary" onClick={handleSwitchToRealAccount} disabled={isLoggingOut}>
                  <LogIn size={16} />
                  {isLoggingOut ? t('common.loading') : t('account.switchToRealAccount')}
                </button>
              )}
              <button type="button" className="secondary" onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut size={16} />
                {isLoggingOut ? t('common.loading') : t('account.logout')}
              </button>
            </div>
          )}
        </div>
      </Modal>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        trigger="generic"
      />
    </>
  );
};
