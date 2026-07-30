import type { UserProfile } from '../db/schema';
import type { LanguageCode } from '../i18n/translations';

export type MembershipRequestTrigger = 'roll-limit' | 'generic';

export interface MembershipRequestDraft {
  userId: string;
  accountEmail?: string | null;
  contactEmail: string;
  note?: string;
  trigger: MembershipRequestTrigger;
}

export interface MembershipRequestCopy {
  subject: string;
  greeting: string;
  accountEmail: string;
  contactEmail: string;
  userId: string;
  trigger: string;
  note: string;
  noValue: string;
  notProvided: string;
  rollLimitTrigger: string;
  genericTrigger: string;
  closing: string;
}

const DEFAULT_SUPPORT_EMAIL = 'filmory@example.com';
export const MEMBERSHIP_SUPPORT_EMAIL = String(
  import.meta.env.VITE_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
).trim() || DEFAULT_SUPPORT_EMAIL;
const normalizeMultiline = (value?: string) => (
  value
    ?.replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim() || ''
);

const DEFAULT_MEMBERSHIP_REQUEST_COPY: MembershipRequestCopy = {
  subject: 'Filmory VIP 升级申请',
  greeting: '您好，我想申请升级为 Filmory VIP。',
  accountEmail: '账号邮箱',
  contactEmail: '联系邮箱',
  userId: '用户 ID',
  trigger: '触发场景',
  note: '补充说明',
  noValue: '无',
  notProvided: '未提供',
  rollLimitTrigger: '已达到免费版进行中拍摄卷上限',
  genericTrigger: '主动咨询 VIP 升级',
  closing: '请告知下一步付款或人工开通方式，谢谢。',
};

export const buildMembershipRequestSubject = (
  copy: MembershipRequestCopy = DEFAULT_MEMBERSHIP_REQUEST_COPY
) => copy.subject;

export const buildMembershipRequestMessage = (
  {
    userId,
    accountEmail,
    contactEmail,
    note,
    trigger,
  }: MembershipRequestDraft,
  copy: MembershipRequestCopy = DEFAULT_MEMBERSHIP_REQUEST_COPY
) => {
  const triggerLabel = trigger === 'roll-limit'
    ? copy.rollLimitTrigger
    : copy.genericTrigger;

  const normalizedNote = normalizeMultiline(note);

  return [
    copy.greeting,
    '',
    `${copy.accountEmail}: ${accountEmail || copy.notProvided}`,
    `${copy.contactEmail}: ${contactEmail}`,
    `${copy.userId}: ${userId}`,
    `${copy.trigger}: ${triggerLabel}`,
    `${copy.note}: ${normalizedNote || copy.noValue}`,
    '',
    copy.closing,
  ].join('\n');
};

export const buildMembershipMailtoHref = (
  draft: MembershipRequestDraft,
  copy: MembershipRequestCopy = DEFAULT_MEMBERSHIP_REQUEST_COPY
) => {
  const params = new URLSearchParams({
    subject: buildMembershipRequestSubject(copy),
    body: buildMembershipRequestMessage(draft, copy),
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
  displayName: existingProfile?.displayName,
  highResQuotaUsed: existingProfile?.highResQuotaUsed ?? 0,
  membershipRequestStatus: 'pending',
  membershipRequestedAt: requestedAt,
  membershipContactEmail: contactEmail.trim(),
  membershipRequestNote: normalizeMultiline(note) || undefined,
  membershipRequestSource: trigger,
  updatedAt: requestedAt,
});

export const formatMembershipRequestTime = (
  timestamp?: number,
  locale: LanguageCode = 'zh-CN'
) => {
  if (!timestamp) return '';

  return new Intl.DateTimeFormat(locale, {
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
