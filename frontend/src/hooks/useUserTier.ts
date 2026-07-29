import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useAuth } from '../contexts/useAuth';
import {
  FREE_ACTIVE_ROLL_LIMIT,
  getMembershipCapabilities,
  type MembershipCapabilities,
  type MembershipTier,
} from '../services/membershipPolicy';

export interface UserTierState {
  tier: MembershipTier;
  isLoading: boolean;
  capabilities: MembershipCapabilities;
}

/**
 * 读取当前用户的会员等级 (tier)。
 * - 'vip'     : 付费会员，无限胶卷记录
 * - 'regular' : 免费用户，最多 5 个进行中胶卷记录
 * - isLoading : 当前资料仍在读取中，调用方不应在此阶段放行会员限制逻辑
 */
export const useUserTier = (): UserTierState => {
  const { user } = useAuth();

  const profile = useLiveQuery(
    () => (user ? db.userProfiles.get(user.id) : undefined),
    [user]
  );

  if (!user) {
    return { tier: 'regular', isLoading: false, capabilities: getMembershipCapabilities('regular') };
  }

  if (profile === undefined) {
    return { tier: 'regular', isLoading: true, capabilities: getMembershipCapabilities('regular') };
  }

  const tier = profile?.tier ?? 'regular';
  return { tier, isLoading: false, capabilities: getMembershipCapabilities(tier) };
};

export const FREE_ROLL_LIMIT = FREE_ACTIVE_ROLL_LIMIT;
