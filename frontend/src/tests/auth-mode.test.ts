import { describe, expect, it } from 'vitest';
import {
  createDevBypassUser,
  DEV_BYPASS_USER_ID,
  getConfiguredEmailRole,
  getMetadataRole,
} from '../services/authMode';

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
});
