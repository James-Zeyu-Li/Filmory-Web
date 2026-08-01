import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_EMAIL_SEND_COOLDOWN_MS,
  getAuthEmailCooldownRemainingMs,
  getAuthEmailCooldownSeconds,
  startAuthEmailCooldown,
} from '../services/authEmailCooldown';

const storage = new Map<string, string>();

describe('auth email cooldown', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => storage.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key);
    });
  });

  it('persists cooldown per scope and email', () => {
    startAuthEmailCooldown('password-recovery', 'User@Grainfolio.app', AUTH_EMAIL_SEND_COOLDOWN_MS, 1000);

    expect(getAuthEmailCooldownSeconds('password-recovery', 'user@grainfolio.app', 1000)).toBe(300);
    expect(getAuthEmailCooldownSeconds('signup-confirmation', 'user@grainfolio.app', 1000)).toBe(0);
  });

  it('returns remaining time and clears expired cooldowns', () => {
    startAuthEmailCooldown('password-recovery', 'user@grainfolio.app', AUTH_EMAIL_SEND_COOLDOWN_MS, 1000);

    expect(getAuthEmailCooldownRemainingMs('password-recovery', 'user@grainfolio.app', 31_000)).toBe(270_000);
    expect(getAuthEmailCooldownRemainingMs('password-recovery', 'user@grainfolio.app', 301_001)).toBe(0);
    expect(localStorage.removeItem).toHaveBeenCalled();
  });

  it('does not store cooldowns for empty email', () => {
    startAuthEmailCooldown('password-recovery', '', AUTH_EMAIL_SEND_COOLDOWN_MS, 1000);

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
