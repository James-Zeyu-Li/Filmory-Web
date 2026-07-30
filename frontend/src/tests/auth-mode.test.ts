import { describe, expect, it } from 'vitest';
import {
  createTrialUser,
  createDevBypassUser,
  DEV_BYPASS_USER_ID,
  getConfiguredEmailRole,
  getMetadataRole,
} from '../services/authMode';
import { TRIAL_USER_ID } from '../services/trialPolicy';

describe('auth mode helpers', () => {
  it('creates a local dev bypass user with admin metadata', () => {
    const user = createDevBypassUser();

    expect(user.id).toBe(DEV_BYPASS_USER_ID);
    expect(user.app_metadata.role).toBe('admin');
    expect(getMetadataRole(user)).toBe('admin');
  });

  it('does not mark normal users as admin by default', () => {
    expect(getMetadataRole(null)).toBe('user');
    expect(getConfiguredEmailRole('someone@example.com')).toBe('user');
  });

  it('creates a local trial user without admin privileges', () => {
    const user = createTrialUser();

    expect(user.id).toBe(TRIAL_USER_ID);
    expect(user.app_metadata.provider).toBe('trial');
    expect(user.app_metadata.role).toBe('user');
    expect(getMetadataRole(user)).toBe('user');
  });
});
