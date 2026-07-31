import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabaseClient';
import type { Provider } from '@supabase/supabase-js';
import { LogIn, UserPlus, AlertCircle, ArrowLeft, MailPlus, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isDevBypassEnabled } from '../../services/authMode';
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
import {
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
  AUTH_EMAIL_SEND_COOLDOWN_MS,
} from '../../services/authEmailCooldown';
import './LoginView.css';

export const LoginView: React.FC = () => {
  const { signInMock } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDevBypass = isDevBypassEnabled();
  const isTrialSignupIntent = searchParams.get('trial') === '1';
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'signup');
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
  const normalizedEmail = email.trim().toLowerCase();
  const {
    remainingSeconds: resendCooldownSeconds,
    isCoolingDown: isResendCoolingDown,
    startCooldown: startResendCooldown,
  } = useAuthEmailCooldown('signup-confirmation', normalizedEmail);
  const prefixedMessage = useMemo(() => searchParams.get('message') || '', [searchParams]);
  const authTitle = isRegister ? t('auth.titleSignup') : t('auth.titleLogin');
  const authSubtitle = isRegister
    ? t('auth.subtitleSignup')
    : t('auth.subtitleLogin');
  const shouldShowPasswordHint = isRegister && (isPasswordFocused || password.length > 0);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setNeedsEmailVerification(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isRegister) {
        const normalizedDisplayName = normalizeDisplayName(displayName);
        const displayNameValidationMessage = getDisplayNameValidationMessage(normalizedDisplayName, t);
        if (displayNameValidationMessage) {
          setErrorMsg(displayNameValidationMessage);
          return;
        }

        const passwordValidationMessage = getPasswordValidationMessage(password, t);
        if (passwordValidationMessage) {
          setErrorMsg(passwordValidationMessage);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMsg(t('auth.passwordMismatch'));
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
        setErrorMsg(t('auth.emailNotConfirmed'));
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: Provider) => {
    setLoading(true);
    setErrorMsg('');
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
      setErrorMsg(t('auth.emptyEmailForResend'));
      return;
    }

    if (isResendCoolingDown) return;

    setIsResendingVerification(true);
    setErrorMsg('');
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
    <div className="login-container">
      <div className={`login-glass-card auth-glass-card ${isRegister ? 'register-mode' : ''}`}>
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={16} /> {t('auth.home')}
        </Link>
        <div className="login-header">
          <img src="/logo.png" alt="Filmory Logo" className="login-logo-img" />
          <h2>{authTitle}</h2>
          <p>{authSubtitle}</p>
        </div>

        {prefixedMessage && (
          <div className="alert-box success">
            <span>{prefixedMessage}</span>
          </div>
        )}

        {isTrialSignupIntent && isRegister && (
          <div className="alert-box success">
            <span>{t('auth.trialSignupNotice')}</span>
          </div>
        )}

        {errorMsg && (
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box success">
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
                id="login-display-name"
                type="text"
                className="form-control"
                placeholder={t('auth.displayNamePlaceholder')}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={40}
                autoComplete="nickname"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email">{t('auth.emailLabel')}</label>
            <input 
              id="login-email"
              type="email" 
              className="form-control" 
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required 
            />
          </div>
          <AuthPasswordField
            id="login-password"
            label={t('auth.passwordLabel')}
            value={password}
            onChange={setPassword}
            placeholder={isRegister ? t('auth.passwordSignupPlaceholder') : t('auth.passwordLoginPlaceholder')}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            onFocus={() => setIsPasswordFocused(true)}
            onBlur={() => setIsPasswordFocused(false)}
          />

          {isRegister && (
            <>
              <AuthPasswordField
                id="login-password-confirm"
                label={t('auth.confirmPasswordLabel')}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword(current => !current)}
                minLength={PASSWORD_POLICY.minLength}
                autoComplete="new-password"
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

        <div className="toggle-mode" style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
          </span>
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', marginLeft: '8px' }}
            onClick={() => {
              setIsRegister(!isRegister);
              setDisplayName('');
              setPassword('');
              setConfirmPassword('');
              setShowPassword(false);
              setShowConfirmPassword(false);
              setErrorMsg('');
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

        <div className="login-divider">
          <span>{t('auth.socialDivider')}</span>
        </div>

        <div className="login-social-actions auth-social-actions-compact">
          <button 
            type="button" 
            className="btn-social" 
            onClick={() => handleOAuth('google')}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google</span>
          </button>
          
          <button 
            type="button" 
            className="btn-social" 
            onClick={() => handleOAuth('github')}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="currentColor"/>
            </svg>
            <span>GitHub</span>
          </button>
        </div>

        {showDevBypass && (
          <>
            <div className="login-divider" style={{ marginTop: '24px' }}>
              <span>{t('auth.devDivider')}</span>
            </div>

            <div className="login-social-actions">
              <button type="button" className="btn-social" onClick={signInMock} style={{ opacity: 0.6 }}>
                <span>{t('auth.devLogin')}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
