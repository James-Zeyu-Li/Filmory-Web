export const AUTH_ROUTES = {
  login: '/login',
  callback: '/auth/callback',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  checkEmail: '/auth/check-email',
  verified: '/auth/verified',
} as const;

type AuthIntent = 'signup' | 'recovery' | 'oauth';

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
  nextPath: string;
  intent: AuthIntent | null;
  type: string | null;
  errorDescription: string | null;
}

export const readAuthCallbackParams = (href: string): AuthCallbackParams => {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code');
  const intentParam = url.searchParams.get('auth_intent');
  const intent = intentParam === 'signup' || intentParam === 'recovery' || intentParam === 'oauth'
    ? intentParam
    : null;
  const nextPath = url.searchParams.get('next') || (
    intent === 'recovery' ? AUTH_ROUTES.resetPassword : '/dashboard'
  );
  const type = url.searchParams.get('type') || hash.get('type');
  const errorDescription =
    url.searchParams.get('error_description') ||
    hash.get('error_description') ||
    url.searchParams.get('error') ||
    hash.get('error');

  return {
    code,
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

export const validatePassword = (password: string) => ({
  minLength: password.length >= PASSWORD_POLICY.minLength,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /\d/.test(password),
});

export const getPasswordValidationMessage = (password: string) => {
  const validation = validatePassword(password);
  if (validation.minLength && validation.hasUppercase && validation.hasLowercase && validation.hasNumber) {
    return '';
  }
  return `密码至少 ${PASSWORD_POLICY.minLength} 位，且必须包含大写字母、小写字母和数字。`;
};

export const getPasswordPolicyDescription = () => (
  `至少 ${PASSWORD_POLICY.minLength} 位，包含大写字母、小写字母和数字。`
);

type AuthMessageContext =
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'callback'
  | 'oauth'
  | 'resend-verification';

export const getAuthErrorMessage = (
  error: unknown,
  context: AuthMessageContext,
  fallback: string
) => {
  const message = formatAuthError(error, fallback);
  const normalized = message.trim().toLowerCase();

  if (/invalid login credentials/.test(normalized)) {
    return '邮箱或密码不正确，请重新检查后再试。';
  }

  if (/email not confirmed|email_not_confirmed|confirm your email/.test(normalized)) {
    return '该邮箱尚未完成验证。请先打开验证邮件完成确认后，再回来登录。';
  }

  if (/user already registered|already been registered/.test(normalized)) {
    return '这个邮箱已经注册过账号，请直接登录或使用找回密码。';
  }

  if (/password should be at least|password is too short|weak password/.test(normalized)) {
    return getPasswordValidationMessage('');
  }

  if (/same password|new password should be different/.test(normalized)) {
    return '新密码不能与当前密码相同，请换一个新的密码。';
  }

  if (/email rate limit exceeded|rate limit/.test(normalized)) {
    return '邮件发送过于频繁，请稍后再试。';
  }

  if (/signup is disabled/.test(normalized)) {
    return '当前环境暂未开放注册，请联系管理员。';
  }

  if (
    context === 'callback' &&
    /expired|invalid grant|otp expired|access denied|unauthorized/.test(normalized)
  ) {
    return '认证链接已过期，请重新发起邮箱验证或密码重设流程。';
  }

  if (
    context === 'reset-password' &&
    /session|token|expired|grant/.test(normalized)
  ) {
    return '当前重设密码会话不可用，请重新打开邮件中的链接后再试。';
  }

  return message;
};

export const getMailpitHint = () => (
  '如果你正在本地 Supabase + Mailpit 环境中测试，验证邮件和重设密码邮件会出现在本地开发邮箱里。'
);

export const getAuthSuccessRedirectPath = (nextPath: string) => (
  nextPath.startsWith('/') ? nextPath : AUTH_ROUTES.login
);
