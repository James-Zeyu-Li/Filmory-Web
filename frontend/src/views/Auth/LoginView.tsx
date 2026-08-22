import React, { useRef, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabaseClient';
import { LogIn, UserPlus, AlertCircle, MailPlus, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getEnabledOAuthProviders,
  isDevBypassEnabled,
  type EnabledOAuthProvider,
} from '../../services/authMode';
import {
  AUTH_ROUTES,
  buildCheckEmailUrl,
  buildOAuthRedirectUrl,
  buildSignupEmailRedirectUrl,
  getAuthErrorMessage,
  getAuthErrorTranslationKey,
  getPasswordValidationMessage,
  isAuthEmailRateLimitError,
  isEmailNotConfirmedError,
  PASSWORD_POLICY,
} from '../../services/authFlow';
import { AuthPasswordField } from './AuthPasswordField';
import { PasswordPolicyHint } from './PasswordPolicyHint';
import { useLanguage } from '../../contexts/useLanguage';
import {
  getDisplayNameValidationMessage,
  normalizeDisplayName,
} from '../../services/userProfile';
import { useAuthEmailCooldown } from '../../hooks/useAuthEmailCooldown';
import { AuthShell } from './AuthShell';
import { OAuthButtons } from './OAuthButtons';
import {
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
  AUTH_EMAIL_SEND_COOLDOWN_MS,
} from '../../services/authEmailCooldown';
import './LoginView.css';

type AuthFieldName = 'displayName' | 'email' | 'password' | 'confirmPassword';

interface AuthFieldError {
  field: AuthFieldName;
  message: string;
}

export const LoginView: React.FC = () => {
  const { signInMock } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const showDevBypass = isDevBypassEnabled();
  const enabledOAuthProviders = getEnabledOAuthProviders();
  const isTrialSignupIntent = searchParams.get('trial') === '1';
  const isRegister = location.pathname === AUTH_ROUTES.signup || searchParams.get('mode') === 'signup';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [fieldError, setFieldError] = useState<AuthFieldError | null>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const {
    remainingSeconds: resendCooldownSeconds,
    isCoolingDown: isResendCoolingDown,
    startCooldown: startResendCooldown,
  } = useAuthEmailCooldown('signup-confirmation', normalizedEmail);
  const prefixedMessage = searchParams.get('message') || '';
  const authTitle = isRegister ? t('auth.titleSignup') : t('auth.titleLogin');
  const authSubtitle = isRegister
    ? t('auth.subtitleSignup')
    : t('auth.subtitleLogin');
  const shouldShowPasswordHint = isRegister && (isPasswordFocused || password.length > 0);

  const focusField = (field: AuthFieldName) => {
    if (field === 'displayName') displayNameRef.current?.focus();
    if (field === 'email') emailRef.current?.focus();
    if (field === 'password') passwordRef.current?.focus();
    if (field === 'confirmPassword') confirmPasswordRef.current?.focus();
  };

  const showFieldError = (field: AuthFieldName, message: string) => {
    setErrorMsg('');
    setFieldError({ field, message });
    focusField(field);
  };

  const clearFieldError = (field: AuthFieldName) => {
    setFieldError(current => current?.field === field ? null : current);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setFieldError(null);
    setSuccessMsg('');
    setNeedsEmailVerification(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isRegister) {
        const normalizedDisplayName = normalizeDisplayName(displayName);
        const displayNameValidationMessage = getDisplayNameValidationMessage(normalizedDisplayName, t);
        if (displayNameValidationMessage) {
          showFieldError('displayName', displayNameValidationMessage);
          return;
        }

        const passwordValidationMessage = getPasswordValidationMessage(password, t);
        if (passwordValidationMessage) {
          showFieldError('password', passwordValidationMessage);
          return;
        }

        if (password !== confirmPassword) {
          showFieldError('confirmPassword', t('auth.passwordMismatch'));
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              display_name: normalizedDisplayName,
            },
            emailRedirectTo: buildSignupEmailRedirectUrl(),
          },
        });
        if (error) throw error;
        navigate(buildCheckEmailUrl(normalizedEmail));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      const errorKey = getAuthErrorTranslationKey(error, isRegister ? 'signup' : 'login');
      const message = getAuthErrorMessage(
        error,
        isRegister ? 'signup' : 'login',
        isRegister ? t('auth.signupFallbackError') : t('auth.loginFallbackError'),
        t
      );
      if (!isRegister && (errorKey === 'auth.emailNotConfirmed' || isEmailNotConfirmedError(message))) {
        setNeedsEmailVerification(true);
        showFieldError('email', t('auth.emailNotConfirmed'));
      } else if (errorKey === 'auth.invalidCredentials') {
        showFieldError('password', message);
      } else if (errorKey === 'auth.alreadyRegistered') {
        showFieldError('email', message);
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: EnabledOAuthProvider) => {
    setLoading(true);
    setErrorMsg('');
    setFieldError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildOAuthRedirectUrl(),
        }
      });
      if (error) throw error;
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error, 'oauth', t('auth.oauthFallbackError'), t));
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!normalizedEmail) {
      showFieldError('email', t('auth.emptyEmailForResend'));
      return;
    }

    if (isResendCoolingDown) return;

    setIsResendingVerification(true);
    setErrorMsg('');
    setFieldError(null);
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: buildSignupEmailRedirectUrl(),
        },
      });
      if (error) throw error;

      startResendCooldown(AUTH_EMAIL_SEND_COOLDOWN_MS);
      setSuccessMsg(t('auth.resendSuccess', { email: normalizedEmail, hint: t('auth.mailpitHint') }));
    } catch (error) {
      if (isAuthEmailRateLimitError(error)) {
        startResendCooldown(AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorMsg(getAuthErrorMessage(error, 'resend-verification', t('auth.resendFallbackError'), t));
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <AuthShell
      title={authTitle}
      subtitle={authSubtitle}
      cardClassName={isRegister ? 'register-mode' : undefined}
    >

        {prefixedMessage && (
          <div className="alert-box success" role="status" aria-live="polite">
            <span>{prefixedMessage}</span>
          </div>
        )}

        {isTrialSignupIntent && isRegister && (
          <div className="alert-box success" role="status" aria-live="polite">
            <span>{t('auth.trialSignupNotice')}</span>
          </div>
        )}

        {errorMsg && (
          <div className="alert-box error" role="alert" aria-live="assertive">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box success" role="status" aria-live="polite">
            <span>{successMsg}</span>
          </div>
        )}

        {needsEmailVerification && (
          <div className="auth-inline-panel">
            <p>{t('auth.emailNotConfirmedHelp')}</p>
            <div className="auth-inline-actions">
              <button
                type="button"
                className="secondary auth-inline-button"
                onClick={handleResendVerification}
                disabled={isResendingVerification || isResendCoolingDown}
              >
                <MailPlus size={16} />
                {isResendingVerification
                  ? t('auth.resending')
                  : isResendCoolingDown
                    ? t('auth.emailCooldownButton', { seconds: resendCooldownSeconds })
                    : t('auth.resendVerification')}
              </button>
              <Link to={buildCheckEmailUrl(email)} className="auth-inline-link">
                {t('auth.viewInstructions')}
              </Link>
            </div>
            {isResendCoolingDown && (
              <p className="auth-cooldown-note">
                {t('auth.emailCooldownNote', { seconds: resendCooldownSeconds })}
              </p>
            )}
          </div>
        )}

        <form className="login-form" onSubmit={handleAuth}>
          {isRegister && (
            <div className="form-group">
              <label htmlFor="login-display-name">{t('auth.displayNameLabel')}</label>
              <input
                ref={displayNameRef}
                id="login-display-name"
                type="text"
                className="form-control"
                placeholder={t('auth.displayNamePlaceholder')}
                value={displayName}
                onChange={e => {
                  setDisplayName(e.target.value);
                  clearFieldError('displayName');
                }}
                maxLength={40}
                autoComplete="nickname"
                required
                aria-invalid={fieldError?.field === 'displayName' ? 'true' : undefined}
                aria-describedby={fieldError?.field === 'displayName' ? 'login-display-name-error' : undefined}
              />
              {fieldError?.field === 'displayName' && (
                <p id="login-display-name-error" className="auth-field-error" role="alert" aria-live="assertive">
                  {fieldError.message}
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email">{t('auth.emailLabel')}</label>
            <input 
              ref={emailRef}
              id="login-email"
              type="email" 
              className="form-control" 
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              autoComplete="email"
              required
              aria-invalid={fieldError?.field === 'email' ? 'true' : undefined}
              aria-describedby={fieldError?.field === 'email' ? 'login-email-error' : undefined}
            />
            {fieldError?.field === 'email' && (
              <p id="login-email-error" className="auth-field-error" role="alert" aria-live="assertive">
                {fieldError.message}
              </p>
            )}
          </div>
          <AuthPasswordField
            id="login-password"
            label={t('auth.passwordLabel')}
            value={password}
            onChange={value => {
              setPassword(value);
              clearFieldError('password');
            }}
            placeholder={isRegister ? t('auth.passwordSignupPlaceholder') : t('auth.passwordLoginPlaceholder')}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => setIsPasswordFocused(false)}
            inputRef={passwordRef}
            errorMessage={fieldError?.field === 'password' ? fieldError.message : undefined}
          />

          {isRegister && (
            <>
              <AuthPasswordField
                id="login-password-confirm"
                label={t('auth.confirmPasswordLabel')}
                value={confirmPassword}
                onChange={value => {
                  setConfirmPassword(value);
                  clearFieldError('confirmPassword');
                }}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword(current => !current)}
                minLength={PASSWORD_POLICY.minLength}
                autoComplete="new-password"
                inputRef={confirmPasswordRef}
                errorMessage={fieldError?.field === 'confirmPassword' ? fieldError.message : undefined}
              />
              {shouldShowPasswordHint && <PasswordPolicyHint password={password} />}
              <div className="auth-helper-note">
                <ShieldCheck size={16} />
                <span>{t('auth.securityNotice')}</span>
              </div>
            </>
          )}
          
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            <span>{loading ? t('common.loading') : (isRegister ? t('auth.submitSignup') : t('auth.submitLogin'))}</span>
          </button>
        </form>

        <div className="toggle-mode auth-mode-toggle">
          <span className="auth-muted-text">
            {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
          </span>
          <button 
            type="button" 
            className="auth-mode-button"
            onClick={() => {
              const nextPath = isRegister ? AUTH_ROUTES.login : AUTH_ROUTES.signup;
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('mode');
              if (isRegister) nextParams.delete('trial');
              const nextSearch = nextParams.toString();
              navigate(`${nextPath}${nextSearch ? `?${nextSearch}` : ''}`);
              setDisplayName('');
              setPassword('');
              setConfirmPassword('');
              setShowPassword(false);
              setShowConfirmPassword(false);
              setErrorMsg('');
              setFieldError(null);
              setSuccessMsg('');
              setNeedsEmailVerification(false);
            }}
          >
            {isRegister ? t('auth.backToLogin') : t('auth.signupNow')}
          </button>
        </div>

        {!isRegister && (
          <div className="auth-secondary-row">
            <Link to={AUTH_ROUTES.forgotPassword} className="auth-inline-link">
              {t('auth.forgotPassword')}
            </Link>
          </div>
        )}

        <OAuthButtons
          providers={enabledOAuthProviders}
          disabled={loading}
          onSelect={handleOAuth}
        />

        {showDevBypass && (
          <>
            <div className="login-divider auth-dev-divider">
              <span>{t('auth.devDivider')}</span>
            </div>

            <div className="login-social-actions">
              <button type="button" className="btn-social auth-dev-button" onClick={signInMock}>
                <span>{t('auth.devLogin')}</span>
              </button>
            </div>
          </>
        )}
    </AuthShell>
  );
};
