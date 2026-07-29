import { describe, expect, it } from 'vitest';
import {
  FREE_ACTIVE_ROLL_LIMIT,
  canCreateActiveRoll,
  getActiveRollLimitLabel,
  getMembershipCapabilities,
} from '../services/membershipPolicy';

describe('membershipPolicy', () => {
  it('limits only regular active rolls and leaves VIP active rolls unlimited', () => {
    expect(FREE_ACTIVE_ROLL_LIMIT).toBe(5);
    expect(canCreateActiveRoll('regular', 4)).toBe(true);
    expect(canCreateActiveRoll('regular', 5)).toBe(false);
    expect(canCreateActiveRoll('vip', 50)).toBe(true);
  });

  it('keeps core catalog features unlimited while reserving cloud features for VIP', () => {
    expect(getMembershipCapabilities('regular')).toMatchObject({
      activeRollLimit: 5,
      cloudSyncEnabled: false,
      photoStorageQuotaMb: null,
      highResUploadEnabled: false,
    });
    expect(getMembershipCapabilities('vip')).toMatchObject({
      activeRollLimit: null,
      cloudSyncEnabled: true,
      photoStorageQuotaMb: null,
      highResUploadEnabled: true,
    });
    expect(getActiveRollLimitLabel('regular')).toBe('最多 5 个');
    expect(getActiveRollLimitLabel('vip')).toBe('无限');
  });
});
