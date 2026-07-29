export type MembershipTier = 'regular' | 'vip';

export interface MembershipCapabilities {
  activeRollLimit: number | null;
  cloudSyncEnabled: boolean;
  photoStorageQuotaMb: number | null;
  highResUploadEnabled: boolean;
}

export const FREE_ACTIVE_ROLL_LIMIT = 5;

const MEMBERSHIP_CAPABILITIES: Record<MembershipTier, MembershipCapabilities> = {
  regular: {
    activeRollLimit: FREE_ACTIVE_ROLL_LIMIT,
    cloudSyncEnabled: false,
    photoStorageQuotaMb: null,
    highResUploadEnabled: false,
  },
  vip: {
    activeRollLimit: null,
    cloudSyncEnabled: true,
    photoStorageQuotaMb: null,
    highResUploadEnabled: true,
  },
};

export const getMembershipCapabilities = (tier: MembershipTier): MembershipCapabilities => (
  MEMBERSHIP_CAPABILITIES[tier] ?? MEMBERSHIP_CAPABILITIES.regular
);

export const getActiveRollLimitLabel = (tier: MembershipTier) => {
  const limit = getMembershipCapabilities(tier).activeRollLimit;
  return limit === null ? '无限' : `最多 ${limit} 个`;
};

export const canCreateActiveRoll = (tier: MembershipTier, activeRollCount: number) => {
  const limit = getMembershipCapabilities(tier).activeRollLimit;
  return limit === null || activeRollCount < limit;
};
