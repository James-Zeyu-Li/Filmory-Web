export type AuthEmailCooldownScope = 'password-recovery' | 'signup-confirmation';

export const AUTH_EMAIL_SEND_COOLDOWN_MS = 5 * 60 * 1000;
export const AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS = AUTH_EMAIL_SEND_COOLDOWN_MS;

const STORAGE_PREFIX = 'filmory_auth_email_cooldown';

const getCooldownKey = (scope: AuthEmailCooldownScope, email: string) => (
  `${STORAGE_PREFIX}:${scope}:${encodeURIComponent(email.trim().toLowerCase())}`
);

export const getAuthEmailCooldownRemainingMs = (
  scope: AuthEmailCooldownScope,
  email: string,
  now = Date.now()
) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return 0;

  const expiresAt = Number(localStorage.getItem(getCooldownKey(scope, normalizedEmail)) || 0);
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) {
    localStorage.removeItem(getCooldownKey(scope, normalizedEmail));
    return 0;
  }

  return remainingMs;
};

export const startAuthEmailCooldown = (
  scope: AuthEmailCooldownScope,
  email: string,
  durationMs = AUTH_EMAIL_SEND_COOLDOWN_MS,
  now = Date.now()
) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  localStorage.setItem(getCooldownKey(scope, normalizedEmail), String(now + durationMs));
};

export const getAuthEmailCooldownSeconds = (
  scope: AuthEmailCooldownScope,
  email: string,
  now = Date.now()
) => Math.ceil(getAuthEmailCooldownRemainingMs(scope, email, now) / 1000);
