import React, { useState } from 'react';
import { X, Check, Zap, Lock, RefreshCw, Infinity as InfinityIcon, Crown } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { db } from '../db/schema';
import type { UserProfile } from '../db/schema';
import { useAuth } from '../contexts/useAuth';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { useUserProfile } from '../hooks/useData';
import {
  buildMembershipMailtoHref,
  buildMembershipRequestMessage,
  buildPendingMembershipProfile,
  formatMembershipRequestTime,
  type MembershipRequestCopy,
  MEMBERSHIP_SUPPORT_EMAIL,
} from '../services/membershipUpgrade';
import { FREE_ACTIVE_ROLL_LIMIT } from '../services/membershipPolicy';
import { copyTextToClipboard } from '../utils/clipboard';
import { Modal } from './Modal';
import './UpgradeModal.css';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 触发场景：roll-limit = 拍摄卷到达上限 */
  trigger?: 'roll-limit' | 'generic';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  trigger = 'generic',
}) => {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const { t, language } = useLanguage();
  const userProfile = useUserProfile();

  return (
    <Modal isOpen={isOpen} onClose={onClose} style={{ maxWidth: '520px', borderRadius: '20px' }}>
      <UpgradeModalContent
        key={`${userProfile?.membershipContactEmail || user?.email || ''}:${userProfile?.membershipRequestNote || ''}:${userProfile?.membershipRequestStatus || 'none'}`}
        onClose={onClose}
        trigger={trigger}
        user={user}
        userProfile={userProfile}
        notify={notify}
        t={t}
        language={language}
      />
    </Modal>
  );
};

interface UpgradeModalContentProps {
  onClose: () => void;
  trigger: 'roll-limit' | 'generic';
  user: User | null;
  userProfile?: UserProfile;
  notify: ReturnType<typeof useFeedback>['notify'];
  t: ReturnType<typeof useLanguage>['t'];
  language: ReturnType<typeof useLanguage>['language'];
}

const UpgradeModalContent: React.FC<UpgradeModalContentProps> = ({
  onClose,
  trigger,
  user,
  userProfile,
  notify,
  t,
  language,
}) => {
  const [contactEmail, setContactEmail] = useState(userProfile?.membershipContactEmail || user?.email || '');
  const [requestNote, setRequestNote] = useState(userProfile?.membershipRequestNote || '');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const isRequestPending = userProfile?.membershipRequestStatus === 'pending';
  const requestTimestampLabel = formatMembershipRequestTime(userProfile?.membershipRequestedAt, language);
  const responseExpectation = t('upgrade.responseExpectation');
  const membershipRequestCopy: MembershipRequestCopy = {
    subject: t('upgrade.mailSubject'),
    greeting: t('upgrade.mailGreeting'),
    accountEmail: t('upgrade.mailAccountEmail'),
    contactEmail: t('upgrade.mailContactEmail'),
    userId: t('upgrade.mailUserId'),
    trigger: t('upgrade.mailTrigger'),
    note: t('upgrade.mailNote'),
    noValue: t('upgrade.mailNoValue'),
    notProvided: t('upgrade.mailNotProvided'),
    rollLimitTrigger: t('upgrade.mailRollLimitTrigger'),
    genericTrigger: t('upgrade.mailGenericTrigger'),
    closing: t('upgrade.mailClosing'),
  };
  const features = [
    {
      label: t('upgrade.featureActiveRolls'),
      free: t('upgrade.limitRegular', { limit: FREE_ACTIVE_ROLL_LIMIT }),
      vip: t('upgrade.unlimited'),
      freeIcon: <Lock size={14} />,
      vipIcon: <InfinityIcon size={14} />,
      highlight: true,
      freeLocked: true,
    },
    {
      label: t('upgrade.featureGear'),
      free: t('upgrade.unlimited'),
      vip: t('upgrade.unlimited'),
      freeIcon: <Check size={14} />,
      vipIcon: <Check size={14} />,
    },
    {
      label: t('upgrade.featureFinanceStats'),
      free: t('upgrade.complete'),
      vip: t('upgrade.complete'),
      freeIcon: <Check size={14} />,
      vipIcon: <Check size={14} />,
    },
    {
      label: t('upgrade.featureExcelExport'),
      free: t('upgrade.available'),
      vip: t('upgrade.available'),
      freeIcon: <Check size={14} />,
      vipIcon: <Check size={14} />,
    },
    {
      label: t('upgrade.featureCloudSync'),
      free: '—',
      vip: t('upgrade.available'),
      freeIcon: <Lock size={14} />,
      vipIcon: <RefreshCw size={14} />,
      highlight: true,
      freeLocked: true,
    },
    {
      label: t('upgrade.featureFilmStock'),
      free: t('upgrade.unlimited'),
      vip: t('upgrade.unlimited'),
      freeIcon: <Check size={14} />,
      vipIcon: <Check size={14} />,
    },
    {
      label: t('upgrade.featureOffline'),
      free: t('upgrade.available'),
      vip: t('upgrade.available'),
      freeIcon: <Check size={14} />,
      vipIcon: <Check size={14} />,
    },
  ];

  const validateContactEmail = () => {
    const normalizedEmail = contactEmail.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      notify({
        type: 'error',
        title: t('upgrade.emailRequiredTitle'),
        message: t('upgrade.emailRequiredMessage'),
      });
      return null;
    }
    return normalizedEmail;
  };

  const handleSubmitRequest = async () => {
    if (!user) {
      notify({
        type: 'error',
        title: t('upgrade.accountUnavailableTitle'),
        message: t('upgrade.accountUnavailableMessage'),
      });
      return;
    }

    const normalizedEmail = validateContactEmail();
    if (!normalizedEmail) return;

    const requestedAt = new Date().getTime();
    const nextProfile = buildPendingMembershipProfile({
      existingProfile: userProfile,
      userId: user.id,
      contactEmail: normalizedEmail,
      note: requestNote,
      trigger,
      requestedAt,
    });
    const mailtoHref = buildMembershipMailtoHref(
      {
        userId: user.id,
        accountEmail: user.email,
        contactEmail: normalizedEmail,
        note: requestNote,
        trigger,
      },
      membershipRequestCopy
    );

    try {
      setIsSubmittingRequest(true);
      window.open(mailtoHref, '_blank');
      await db.userProfiles.put(nextProfile);
      notify({
        type: 'success',
        title: t('upgrade.requestStoredTitle'),
        message: t('upgrade.requestStoredMessage', { time: responseExpectation }),
      });
    } catch (error) {
      notify({
        type: 'error',
        title: t('upgrade.requestFailedTitle'),
        message: error instanceof Error ? error.message : t('upgrade.retryLater'),
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCopyRequest = async () => {
    if (!user) {
      notify({
        type: 'error',
        title: t('upgrade.accountUnavailableTitle'),
        message: t('upgrade.accountUnavailableMessage'),
      });
      return;
    }

    const normalizedEmail = validateContactEmail();
    if (!normalizedEmail) return;

    try {
      await copyTextToClipboard(buildMembershipRequestMessage(
        {
          userId: user.id,
          accountEmail: user.email,
          contactEmail: normalizedEmail,
          note: requestNote,
          trigger,
        },
        membershipRequestCopy
      ));
      notify({
        type: 'success',
        title: t('upgrade.copySuccessTitle'),
        message: t('upgrade.copySuccessMessage', { email: MEMBERSHIP_SUPPORT_EMAIL }),
      });
    } catch (error) {
      notify({
        type: 'error',
        title: t('upgrade.copyFailedTitle'),
        message: error instanceof Error ? error.message : t('upgrade.copyRetryMessage'),
      });
    }
  };

  return (
    <>
      {/* Close */}
      <button className="upgrade-close icon-btn" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Header */}
        <div className="upgrade-header">
          <div className="upgrade-crown-icon">
            <Crown size={28} />
          </div>
	          {trigger === 'roll-limit' ? (
	            <>
	              <h2>{t('upgrade.limitReachedTitle')}</h2>
	              <p>{t('upgrade.limitReachedDesc', { limit: FREE_ACTIVE_ROLL_LIMIT })}</p>
	            </>
	          ) : (
	            <>
	              <h2>{t('upgrade.genericTitle')}</h2>
	              <p>{t('upgrade.genericDesc')}</p>
	            </>
	          )}
        </div>

        {/* Pricing */}
        <div className="upgrade-pricing-row">
          <div className="upgrade-plan free">
            <span className="plan-name">{t('upgrade.freePlan')}</span>
            <span className="plan-price">¥0</span>
            <span className="plan-cycle">{t('upgrade.forever')}</span>
          </div>
          <div className="upgrade-plan vip">
            <div className="plan-badge">{t('upgrade.recommended')}</div>
            <span className="plan-name">VIP</span>
            <div className="plan-price-group">
              <span className="plan-price">¥68</span>
              <span className="plan-cycle">{t('upgrade.yearlyCycle')}</span>
            </div>
            <span className="plan-unit">{t('upgrade.monthlyApprox')}</span>
          </div>
        </div>

        {/* Feature Table */}
        <div className="upgrade-feature-table">
          <div className="upgrade-feature-header">
            <span>{t('upgrade.featureColumn')}</span>
            <span>{t('upgrade.freeColumn')}</span>
            <span>VIP</span>
          </div>
          {features.map(feature => (
            <div
              key={feature.label}
              className={`upgrade-feature-row ${feature.highlight ? 'highlight' : ''}`}
            >
              <span className="feature-label">{feature.label}</span>
              <span className={`feature-cell free ${feature.freeLocked ? 'locked' : ''}`}>
                {feature.freeIcon}
                {feature.free}
              </span>
              <span className="feature-cell vip">
                {feature.vipIcon}
                {feature.vip}
              </span>
            </div>
          ))}
        </div>

        <div className="upgrade-request-panel">
          <div className="upgrade-request-header">
            <h3>{t('upgrade.manualRequestTitle')}</h3>
            <p>
              {t('upgrade.manualRequestBeforeEmail')}
              {' '}
              <a href={`mailto:${MEMBERSHIP_SUPPORT_EMAIL}`}>{MEMBERSHIP_SUPPORT_EMAIL}</a>
              {' '}
              {t('upgrade.manualRequestAfterEmail', { time: responseExpectation })}
            </p>
          </div>

          {isRequestPending && (
            <div className="upgrade-request-status">
              <strong>{t('upgrade.pendingTitle')}</strong>
              <p>
                {requestTimestampLabel ? t('upgrade.pendingTime', { time: requestTimestampLabel }) : ''}
                {userProfile?.membershipContactEmail ? t('upgrade.pendingContact', { email: userProfile.membershipContactEmail }) : ''}
                {t('upgrade.pendingDisclaimer')}
              </p>
            </div>
          )}

          <div className="upgrade-request-fields">
            <label className="upgrade-request-field">
              <span>{t('upgrade.contactEmail')}</span>
              <input
                className="form-control"
                type="email"
                value={contactEmail}
                onChange={event => setContactEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="upgrade-request-field">
              <span>{t('upgrade.noteLabel')}</span>
              <textarea
                className="form-control upgrade-request-textarea"
                rows={3}
                value={requestNote}
                onChange={event => setRequestNote(event.target.value)}
                placeholder={t('upgrade.notePlaceholder')}
              />
            </label>
          </div>
        </div>

        {/* CTA */}
        <div className="upgrade-cta">
          <button
            className="primary upgrade-btn"
            onClick={handleSubmitRequest}
            disabled={isSubmittingRequest}
          >
            <Zap size={16} />
            {isRequestPending ? t('upgrade.reopenRequestEmail') : t('upgrade.openRequestEmail')}
          </button>
          <button
            className="secondary upgrade-secondary-btn"
            onClick={handleCopyRequest}
            disabled={isSubmittingRequest}
          >
            <Check size={16} />
            {t('upgrade.copyRequest')}
          </button>
          <p className="upgrade-cta-note">
            {t('upgrade.localPendingNote')}
          </p>
        </div>
    </>
  );
};
