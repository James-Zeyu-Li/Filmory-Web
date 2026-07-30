import { describe, expect, it } from 'vitest';
import {
  buildLocalUserProfile,
  getDisplayNameValidationMessage,
  getUserMetadataDisplayName,
  normalizeDisplayName,
  resolveUserProfileDisplayName,
} from '../services/userProfile';

describe('user profile helpers', () => {
  it('normalizes display names before saving', () => {
    expect(normalizeDisplayName('  James   Chan  ')).toBe('James Chan');
  });

  it('validates empty and too-long display names', () => {
    expect(getDisplayNameValidationMessage('   ')).toContain('Enter a display name');
    expect(getDisplayNameValidationMessage('a'.repeat(41))).toContain('40');
    expect(getDisplayNameValidationMessage('Film Photographer')).toBe('');
  });

  it('reads display name from Supabase user metadata', () => {
    const user = {
      user_metadata: {
        display_name: 'Analog James',
      },
    } as any;

    expect(getUserMetadataDisplayName(user)).toBe('Analog James');
  });

  it('prefers explicit display name over existing profile and auth metadata', () => {
    const user = {
      user_metadata: {
        display_name: 'Metadata Name',
      },
    } as any;

    expect(resolveUserProfileDisplayName({
      user,
      existingProfile: { id: '1', userId: '1', tier: 'regular', highResQuotaUsed: 0, displayName: 'Stored Name' },
      nextDisplayName: 'Fresh Name',
    })).toBe('Fresh Name');
  });

  it('builds a local user profile while preserving membership state', () => {
    const profile = buildLocalUserProfile({
      userId: 'user-1',
      role: 'admin',
      existingProfile: {
        id: 'user-1',
        userId: 'user-1',
        tier: 'vip',
        role: 'admin',
        displayName: 'Old Name',
        highResQuotaUsed: 12,
        membershipRequestStatus: 'pending',
        membershipRequestedAt: 123,
      },
      displayName: 'New Name',
    });

    expect(profile).toMatchObject({
      id: 'user-1',
      userId: 'user-1',
      tier: 'vip',
      role: 'admin',
      displayName: 'New Name',
      highResQuotaUsed: 12,
      membershipRequestStatus: 'pending',
      membershipRequestedAt: 123,
    });
  });
});
