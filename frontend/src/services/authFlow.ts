import type { TranslationKey } from '../i18n/translations';

type AuthTranslator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const AUTH_ROUTES = {
  login: '/auth/login',
  signup: '/auth/signup',
  legacyLogin: '/login',
  callback: '/auth/callback',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  checkEmail: '/auth/check-email',
  verified: '/auth/verified',
} as const;

type AuthIntent = 'signup' | 'recovery' | 'oauth';

const PASSWORD_RECOVERY_INTENT_KEY = 'grainfolio:password-recovery-user-id';
export const PASSWORD_RECOVERY_INTENT_TTL_MS = 15 * 60 * 1000;

interface PasswordRecoveryIntent {
  userId: string;
  issuedAt: number;
  flow: 'recovery';
}

const buildCallbackUrl = (intent: AuthIntent, nextPath: string) => {
  const callbackUrl = new URL(AUTH_ROUTES.callback, window.location.origin);
  callbackUrl.searchParams.set('auth_intent', intent);
  callbackUrl.searchParams.set('next', nextPath);
  return callbackUrl.toString();
};

export const buildSignupEmailRedirectUrl = () => (
  buildCallbackUrl('signup', AUTH_ROUTES.verified)
);

export const buildPasswordRecoveryRedirectUrl = () => (
  buildCallbackUrl('recovery', AUTH_ROUTES.resetPassword)
);

// The marker is only a short-lived client-side route guard. Supabase owns the
// recovery-token validation, session lifetime, and password update permission.
export const markPasswordRecoveryIntent = (userId: string) => {
  const intent: PasswordRecoveryIntent = {
    userId,
    issuedAt: Date.now(),
    flow: 'recovery',
  };
  window.sessionStorage.setItem(PASSWORD_RECOVERY_INTENT_KEY, JSON.stringify(intent));
};

export const hasPasswordRecoveryIntent = (userId: string, now = Date.now()) => {
  const storedIntent = window.sessionStorage.getItem(PASSWORD_RECOVERY_INTENT_KEY);
  if (!storedIntent) return false;

  try {
    const intent = JSON.parse(storedIntent) as Partial<PasswordRecoveryIntent>;
    const isValid =
      intent.flow === 'recovery' &&
      intent.userId === userId &&
      typeof intent.issuedAt === 'number' &&
      now >= intent.issuedAt &&
      now - intent.issuedAt <= PASSWORD_RECOVERY_INTENT_TTL_MS;

    if (isValid) return true;
  } catch {
    // Invalid storage is treated as an expired recovery intent.
  }

  clearPasswordRecoveryIntent();
  return false;
};

export const clearPasswordRecoveryIntent = () => {
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_INTENT_KEY);
};

export const buildOAuthRedirectUrl = () => (
  buildCallbackUrl('oauth', '/dashboard')
);

export const buildLoginUrl = (params?: Record<string, string>) => {
  const url = new URL(AUTH_ROUTES.login, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
};

export const buildCheckEmailUrl = (email?: string) => {
  const url = new URL(AUTH_ROUTES.checkEmail, window.location.origin);
  if (email) url.searchParams.set('email', email);
  return `${url.pathname}${url.search}`;
};

export const isEmailNotConfirmedError = (message?: string) => (
  /email not confirmed|email_not_confirmed|confirm your email|尚未完成验证|先打开验证邮件/i.test(message || '')
);

export const PASSWORD_POLICY = {
  minLength: 8,
} as const;

export interface AuthCallbackParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  nextPath: string;
  intent: AuthIntent | null;
  type: string | null;
  errorDescription: string | null;
}

export const readAuthCallbackParams = (href: string): AuthCallbackParams => {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code');
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const intentParam = url.searchParams.get('auth_intent');
  const type = url.searchParams.get('type') || hash.get('type');
  const hashIntent = type === 'recovery'
    ? 'recovery'
    : type === 'signup'
      ? 'signup'
      : null;
  const intent = intentParam === 'signup' || intentParam === 'recovery' || intentParam === 'oauth'
    ? intentParam
    : hashIntent;
  const nextPath = url.searchParams.get('next') || (
    intent === 'recovery'
      ? AUTH_ROUTES.resetPassword
      : intent === 'signup'
        ? AUTH_ROUTES.verified
        : '/dashboard'
  );
  const errorDescription =
    url.searchParams.get('error_description') ||
    hash.get('error_description') ||
    url.searchParams.get('error') ||
    hash.get('error');

  return {
    code,
    accessToken,
    refreshToken,
    nextPath,
    intent,
    type,
    errorDescription,
  };
};

export const formatAuthError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

export const isAuthEmailRateLimitError = (error: unknown) => {
  const maybeAuthError = error as { status?: number; code?: string; message?: string };
  const message = formatAuthError(error, '').toLowerCase();

  return maybeAuthError?.status === 429 ||
    maybeAuthError?.code === 'over_email_send_rate_limit' ||
    /email rate limit exceeded|too many requests|over_email_send_rate_limit/.test(message);
};

export const validatePassword = (password: string) => ({
  minLength: password.length >= PASSWORD_POLICY.minLength,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /\d/.test(password),
});

export const getPasswordValidationMessage = (password: string, t?: AuthTranslator) => {
  const validation = validatePassword(password);
  if (validation.minLength && validation.hasUppercase && validation.hasLowercase && validation.hasNumber) {
    return '';
  }
  if (t) {
    return t('auth.passwordPolicyError', { min: PASSWORD_POLICY.minLength });
  }
  return `Password must be at least ${PASSWORD_POLICY.minLength} characters and include uppercase, lowercase, and a number.`;
};

type AuthMessageContext =
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'callback'
  | 'oauth'
  | 'resend-verification';

export const getAuthErrorTranslationKey = (
  error: unknown,
  context: AuthMessageContext
): TranslationKey | null => {
  const message = formatAuthError(error, '').trim().toLowerCase();

  if (/invalid login credentials/.test(message)) return 'auth.invalidCredentials';
  if (/email not confirmed|email_not_confirmed|confirm your email/.test(message)) return 'auth.emailNotConfirmed';
  if (/user already registered|already been registered/.test(message)) return 'auth.alreadyRegistered';
  if (/password should be at least|password is too short|weak password/.test(message)) return 'auth.passwordPolicyError';
  if (/same password|new password should be different/.test(message)) return 'auth.samePassword';
  if (/email rate limit exceeded|rate limit|over_email_send_rate_limit|too many requests/.test(message)) return 'auth.emailRateLimit';
  if (/signup is disabled/.test(message)) return 'auth.signupDisabled';

  if (
    context === 'callback' &&
    /expired|invalid grant|otp expired|access denied|unauthorized/.test(message)
  ) {
    return 'auth.callbackExpiredError';
  }

  if (
    context === 'reset-password' &&
    /session|token|expired|grant/.test(message)
  ) {
    return 'auth.resetSessionInvalid';
  }

  return null;
};

export const getAuthErrorMessage = (
  error: unknown,
  context: AuthMessageContext,
  fallback: string,
  t?: AuthTranslator
) => {
  const translationKey = getAuthErrorTranslationKey(error, context);
  if (translationKey && t) {
    return t(translationKey, { min: PASSWORD_POLICY.minLength });
  }

  const message = formatAuthError(error, fallback);
  const normalized = message.trim().toLowerCase();

  if (/invalid login credentials/.test(normalized)) {
    return 'Email or password is incorrect. Check them and try again.';
  }

  if (/email not confirmed|email_not_confirmed|confirm your email/.test(normalized)) {
    return 'This email has not been verified yet. Open the verification email first, then come back to log in.';
  }

  if (/user already registered|already been registered/.test(normalized)) {
    return 'This email already has an account. Log in directly or use password recovery.';
  }

  if (/password should be at least|password is too short|weak password/.test(normalized)) {
    return getPasswordValidationMessage('');
  }

  if (/same password|new password should be different/.test(normalized)) {
    return 'The new password cannot match the current password. Choose a different one.';
  }

  if (/email rate limit exceeded|rate limit/.test(normalized)) {
    return 'Emails are being sent too frequently. Try again later.';
  }

  if (/signup is disabled/.test(normalized)) {
    return 'Sign up is disabled in this environment. Contact the administrator.';
  }

  if (
    context === 'callback' &&
    /expired|invalid grant|otp expired|access denied|unauthorized/.test(normalized)
  ) {
    return 'The authentication link has expired. Start email verification or password reset again.';
  }

  if (
    context === 'reset-password' &&
    /session|token|expired|grant/.test(normalized)
  ) {
    return 'This password reset session is unavailable. Open the link in the email again and retry.';
  }

  return message;
};

const POST_AUTH_PATHS = new Set([
  '/dashboard',
  '/rolls',
  '/gear',
  '/insights',
  '/compare',
  AUTH_ROUTES.verified,
]);

const hasControlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

export const isSafeInternalPath = (nextPath: string) => {
  if (
    !nextPath.startsWith('/') ||
    nextPath.startsWith('//') ||
    nextPath.includes('\\') ||
    hasControlCharacter(nextPath)
  ) {
    return false;
  }

  try {
    const target = new URL(nextPath, window.location.origin);
    return target.origin === window.location.origin && POST_AUTH_PATHS.has(target.pathname);
  } catch {
    return false;
  }
};

export const getAuthSuccessRedirectPath = (nextPath: string) => (
  isSafeInternalPath(nextPath) ? nextPath : AUTH_ROUTES.login
);
