import React, { useState } from 'react';
import { X, Check, Zap, Lock, RefreshCw, Infinity as InfinityIcon, Crown } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { db } from '../db/schema';
import type { UserProfile } from '../db/schema';
import { useAuth } from '../contexts/useAuth';
import { useFeedback } from '../contexts/useFeedback';
import { useUserProfile } from '../hooks/useData';
import {
  buildMembershipMailtoHref,
  buildMembershipRequestMessage,
  buildPendingMembershipProfile,
  copyTextToClipboard,
  formatMembershipRequestTime,
  MEMBERSHIP_RESPONSE_EXPECTATION,
  MEMBERSHIP_SUPPORT_EMAIL,
} from '../services/membershipUpgrade';
import { FREE_ACTIVE_ROLL_LIMIT, getActiveRollLimitLabel } from '../services/membershipPolicy';
import './UpgradeModal.css';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 触发场景：roll-limit = 拍摄卷到达上限 */
  trigger?: 'roll-limit' | 'generic';
}

const FEATURES = [
  {
    label: '进行中胶卷记录',
    free: getActiveRollLimitLabel('regular'),
    vip: getActiveRollLimitLabel('vip'),
    freeIcon: <Lock size={14} />,
    vipIcon: <InfinityIcon size={14} />,
    highlight: true,
  },
  {
    label: '器材库',
    free: '不限量',
    vip: '不限量',
    freeIcon: <Check size={14} />,
    vipIcon: <Check size={14} />,
  },
  {
    label: '财务记录 & 统计',
    free: '完整',
    vip: '完整',
    freeIcon: <Check size={14} />,
    vipIcon: <Check size={14} />,
  },
  {
    label: 'Excel 导出',
    free: '✓',
    vip: '✓',
    freeIcon: <Check size={14} />,
    vipIcon: <Check size={14} />,
  },
  {
    label: '数据云同步（多设备）',
    free: '—',
    vip: '可用',
    freeIcon: <Lock size={14} />,
    vipIcon: <RefreshCw size={14} />,
    highlight: true,
  },
  {
    label: '胶卷库存记录',
    free: '不限量',
    vip: '不限量',
    freeIcon: <Check size={14} />,
    vipIcon: <Check size={14} />,
  },
  {
    label: '本地离线使用',
    free: '✓',
    vip: '✓',
    freeIcon: <Check size={14} />,
    vipIcon: <Check size={14} />,
  },
];

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  trigger = 'generic',
}) => {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const userProfile = useUserProfile();

  if (!isOpen) return null;

  return (
    <UpgradeModalContent
      key={`${userProfile?.membershipContactEmail || user?.email || ''}:${userProfile?.membershipRequestNote || ''}:${userProfile?.membershipRequestStatus || 'none'}`}
      onClose={onClose}
      trigger={trigger}
      user={user}
      userProfile={userProfile}
      notify={notify}
    />
  );
};

interface UpgradeModalContentProps {
  onClose: () => void;
  trigger: 'roll-limit' | 'generic';
  user: User | null;
  userProfile?: UserProfile;
  notify: ReturnType<typeof useFeedback>['notify'];
}

const UpgradeModalContent: React.FC<UpgradeModalContentProps> = ({
  onClose,
  trigger,
  user,
  userProfile,
  notify,
}) => {
  const [contactEmail, setContactEmail] = useState(userProfile?.membershipContactEmail || user?.email || '');
  const [requestNote, setRequestNote] = useState(userProfile?.membershipRequestNote || '');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const isRequestPending = userProfile?.membershipRequestStatus === 'pending';
  const requestTimestampLabel = formatMembershipRequestTime(userProfile?.membershipRequestedAt);

  const validateContactEmail = () => {
    const normalizedEmail = contactEmail.trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      notify({
        type: 'error',
        title: '请填写联系邮箱',
        message: '用于人工开通确认的邮箱地址不能为空，并且需要包含 @。',
      });
      return null;
    }
    return normalizedEmail;
  };

  const handleSubmitRequest = async () => {
    if (!user) {
      notify({
        type: 'error',
        title: '账号信息不可用',
        message: '当前无法读取登录用户信息，请重新登录后再试。',
      });
      return;
    }

    const normalizedEmail = validateContactEmail();
    if (!normalizedEmail) return;

    const requestedAt = Date.now();
    const nextProfile = buildPendingMembershipProfile({
      existingProfile: userProfile,
      userId: user.id,
      contactEmail: normalizedEmail,
      note: requestNote,
      trigger,
      requestedAt,
    });
    const mailtoHref = buildMembershipMailtoHref({
      userId: user.id,
      accountEmail: user.email,
      contactEmail: normalizedEmail,
      note: requestNote,
      trigger,
    });

    try {
      setIsSubmittingRequest(true);
      window.open(mailtoHref, '_blank');
      await db.userProfiles.put(nextProfile);
      notify({
        type: 'success',
        title: '升级申请已记录',
        message: `本机已保存你的升级申请状态，并尝试打开邮件草稿。我们通常会在 ${MEMBERSHIP_RESPONSE_EXPECTATION} 内人工确认。`,
      });
    } catch (error) {
      notify({
        type: 'error',
        title: '记录申请失败',
        message: error instanceof Error ? error.message : '请稍后重试。',
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCopyRequest = async () => {
    if (!user) {
      notify({
        type: 'error',
        title: '账号信息不可用',
        message: '当前无法读取登录用户信息，请重新登录后再试。',
      });
      return;
    }

    const normalizedEmail = validateContactEmail();
    if (!normalizedEmail) return;

    try {
      await copyTextToClipboard(buildMembershipRequestMessage({
        userId: user.id,
        accountEmail: user.email,
        contactEmail: normalizedEmail,
        note: requestNote,
        trigger,
      }));
      notify({
        type: 'success',
        title: '申请内容已复制',
        message: `你现在可以把申请内容发送到 ${MEMBERSHIP_SUPPORT_EMAIL}。`,
      });
    } catch (error) {
      notify({
        type: 'error',
        title: '复制失败',
        message: error instanceof Error ? error.message : '请手动复制后重试。',
      });
    }
  };

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>

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
	              <h2>已达到免费版上限</h2>
	              <p>你已有 {FREE_ACTIVE_ROLL_LIMIT} 个进行中的胶卷记录。归档旧记录可释放名额，或升级 VIP 无限使用。</p>
	            </>
	          ) : (
	            <>
	              <h2>升级 Filmory VIP</h2>
	              <p>解锁无限进行中胶卷记录，以及后续多设备云同步和云端图片能力。</p>
	            </>
	          )}
        </div>

        {/* Pricing */}
        <div className="upgrade-pricing-row">
          <div className="upgrade-plan free">
            <span className="plan-name">免费版</span>
            <span className="plan-price">¥0</span>
            <span className="plan-cycle">永久</span>
          </div>
          <div className="upgrade-plan vip">
            <div className="plan-badge">推荐</div>
            <span className="plan-name">VIP</span>
            <div className="plan-price-group">
              <span className="plan-price">¥68</span>
              <span className="plan-cycle">/ 年</span>
            </div>
            <span className="plan-unit">约 ¥5.7 / 月</span>
          </div>
        </div>

        {/* Feature Table */}
        <div className="upgrade-feature-table">
          <div className="upgrade-feature-header">
            <span>功能</span>
            <span>免费</span>
            <span>VIP</span>
          </div>
          {FEATURES.map(feature => (
            <div
              key={feature.label}
              className={`upgrade-feature-row ${feature.highlight ? 'highlight' : ''}`}
            >
              <span className="feature-label">{feature.label}</span>
              <span className={`feature-cell free ${feature.highlight && feature.free !== '✓' && feature.free !== '完整' && feature.free !== '无限' ? 'locked' : ''}`}>
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
            <h3>人工开通申请</h3>
            <p>
              当前版本尚未接入在线支付。你可以直接生成邮件草稿，我们会通过
              {' '}
              <a href={`mailto:${MEMBERSHIP_SUPPORT_EMAIL}`}>{MEMBERSHIP_SUPPORT_EMAIL}</a>
              {' '}
              在 {MEMBERSHIP_RESPONSE_EXPECTATION} 内人工确认。
            </p>
          </div>

          {isRequestPending && (
            <div className="upgrade-request-status">
              <strong>当前设备已记录为申请中</strong>
              <p>
                {requestTimestampLabel ? `最近一次记录时间：${requestTimestampLabel}。` : ''}
                {userProfile?.membershipContactEmail ? ` 联系邮箱：${userProfile.membershipContactEmail}。` : ''}
                正式会员开通仍以人工确认结果为准。
              </p>
            </div>
          )}

          <div className="upgrade-request-fields">
            <label className="upgrade-request-field">
              <span>联系邮箱</span>
              <input
                className="form-control"
                type="email"
                value={contactEmail}
                onChange={event => setContactEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="upgrade-request-field">
              <span>补充说明（可选）</span>
              <textarea
                className="form-control upgrade-request-textarea"
                rows={3}
                value={requestNote}
                onChange={event => setRequestNote(event.target.value)}
                placeholder="例如：希望本周开通，用于整理当前进行中的拍摄项目。"
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
            {isRequestPending ? '重新打开申请邮件' : '打开邮件申请'}
          </button>
          <button
            className="secondary upgrade-secondary-btn"
            onClick={handleCopyRequest}
            disabled={isSubmittingRequest}
          >
            <Check size={16} />
            复制申请内容
          </button>
          <p className="upgrade-cta-note">
            当前“申请中”状态只保存在这个浏览器里，用于避免重复填写；真正的会员开通仍以人工确认邮件为准。
          </p>
        </div>

      </div>
    </div>
  );
};
