import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../db/schema';
import type { AccountRole } from './authMode';
import type { TranslationKey } from '../i18n/translations';

export const DISPLAY_NAME_MAX_LENGTH = 40;

const USER_PROFILE_SEMANTIC_FIELDS = [
  'id',
  'userId',
  'tier',
  'role',
  'displayName',
  'highResQuotaUsed',
  'membershipRequestStatus',
  'membershipRequestedAt',
  'membershipContactEmail',
  'membershipRequestNote',
  'membershipRequestSource',
] as const satisfies readonly (keyof UserProfile)[];

type UserProfileTranslator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const normalizeDisplayName = (value?: string | null) => (
  value
    ?.replace(/\s+/g, ' ')
    .trim() || ''
);

export const getDisplayNameValidationMessage = (value: string, t?: UserProfileTranslator) => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    if (t) return t('auth.displayNameRequired');
    return 'Enter a display name so this Grainfolio workspace is clearly labeled.';
  }
  if (normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    if (t) return t('auth.displayNameTooLong', { max: DISPLAY_NAME_MAX_LENGTH });
    return `Keep the display name within ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }
  return '';
};

export const getUserMetadataDisplayName = (user: User | null | undefined) => {
  if (!user?.user_metadata) return '';

  const candidates = [
    user.user_metadata.display_name,
    user.user_metadata.displayName,
    user.user_metadata.name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDisplayName(
      typeof candidate === 'string' ? candidate : undefined
    );
    if (normalized) return normalized;
  }

  return '';
};

export const resolveUserProfileDisplayName = ({
  user,
  existingProfile,
  nextDisplayName,
}: {
  user?: User | null;
  existingProfile?: UserProfile;
  nextDisplayName?: string;
}) => {
  const explicitName = normalizeDisplayName(nextDisplayName);
  if (explicitName) return explicitName;

  const existingName = normalizeDisplayName(existingProfile?.displayName);
  if (existingName) return existingName;

  return getUserMetadataDisplayName(user);
};

export const hasUserProfileSemanticChanges = (
  existingProfile: UserProfile | undefined,
  nextProfile: UserProfile,
) => (
  !existingProfile || USER_PROFILE_SEMANTIC_FIELDS.some(
    field => existingProfile[field] !== nextProfile[field]
  )
);

export const buildLocalUserProfile = ({
  userId,
  role = 'user',
  existingProfile,
  displayName,
}: {
  userId: string;
  role?: AccountRole;
  existingProfile?: UserProfile;
  displayName?: string;
}): UserProfile => {
  const normalizedDisplayName = normalizeDisplayName(displayName);

  return {
    id: userId,
    userId,
    tier: existingProfile?.tier ?? 'regular',
    role: existingProfile?.role ?? role,
    displayName: normalizedDisplayName || undefined,
    highResQuotaUsed: existingProfile?.highResQuotaUsed ?? 0,
    membershipRequestStatus: existingProfile?.membershipRequestStatus,
    membershipRequestedAt: existingProfile?.membershipRequestedAt,
    membershipContactEmail: existingProfile?.membershipContactEmail,
    membershipRequestNote: existingProfile?.membershipRequestNote,
    membershipRequestSource: existingProfile?.membershipRequestSource,
    updatedAt: Date.now(),
  };
};
