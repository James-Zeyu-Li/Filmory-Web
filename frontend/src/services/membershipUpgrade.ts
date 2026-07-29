import type { UserProfile } from '../db/schema';

export type MembershipRequestTrigger = 'roll-limit' | 'generic';

export interface MembershipRequestDraft {
  userId: string;
  accountEmail?: string | null;
  contactEmail: string;
  note?: string;
  trigger: MembershipRequestTrigger;
}

const DEFAULT_SUPPORT_EMAIL = 'filmory@example.com';
export const MEMBERSHIP_SUPPORT_EMAIL = String(
  import.meta.env.VITE_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
).trim() || DEFAULT_SUPPORT_EMAIL;
export const MEMBERSHIP_RESPONSE_EXPECTATION = '24 小时内';

const normalizeMultiline = (value?: string) => (
  value
    ?.replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim() || ''
);

export const buildMembershipRequestSubject = () => 'Filmory VIP 升级申请';

export const buildMembershipRequestMessage = ({
  userId,
  accountEmail,
  contactEmail,
  note,
  trigger,
}: MembershipRequestDraft) => {
  const triggerLabel = trigger === 'roll-limit'
    ? '已达到免费版进行中拍摄卷上限'
    : '主动咨询 VIP 升级';

  const normalizedNote = normalizeMultiline(note);

  return [
    '您好，我想申请升级为 Filmory VIP。',
    '',
    `账号邮箱：${accountEmail || '未提供'}`,
    `联系邮箱：${contactEmail}`,
    `用户 ID：${userId}`,
    `触发场景：${triggerLabel}`,
    `补充说明：${normalizedNote || '无'}`,
    '',
    '请告知下一步付款或人工开通方式，谢谢。',
  ].join('\n');
};

export const buildMembershipMailtoHref = (draft: MembershipRequestDraft) => {
  const params = new URLSearchParams({
    subject: buildMembershipRequestSubject(),
    body: buildMembershipRequestMessage(draft),
  });

  return `mailto:${MEMBERSHIP_SUPPORT_EMAIL}?${params.toString()}`;
};

export const buildPendingMembershipProfile = ({
  existingProfile,
  userId,
  contactEmail,
  note,
  trigger,
  requestedAt,
}: {
  existingProfile?: UserProfile;
  userId: string;
  contactEmail: string;
  note?: string;
  trigger: MembershipRequestTrigger;
  requestedAt: number;
}): UserProfile => ({
  id: userId,
  userId,
  tier: existingProfile?.tier ?? 'regular',
  role: existingProfile?.role,
  highResQuotaUsed: existingProfile?.highResQuotaUsed ?? 0,
  membershipRequestStatus: 'pending',
  membershipRequestedAt: requestedAt,
  membershipContactEmail: contactEmail.trim(),
  membershipRequestNote: normalizeMultiline(note) || undefined,
  membershipRequestSource: trigger,
  updatedAt: requestedAt,
});

export const formatMembershipRequestTime = (timestamp?: number) => {
  if (!timestamp) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
};

export const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};
