import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildPasswordRecoveryRedirectUrl,
  getAuthErrorMessage,
  isAuthEmailRateLimitError,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { useLanguage } from '../../contexts/useLanguage';
import { useAuthEmailCooldown } from '../../hooks/useAuthEmailCooldown';
import {
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
  AUTH_EMAIL_SEND_COOLDOWN_MS,
} from '../../services/authEmailCooldown';
import './LoginView.css';

export const ForgotPasswordView: React.FC = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const normalizedEmail = email.trim().toLowerCase();
  const {
    remainingSeconds,
    isCoolingDown,
    startCooldown,
  } = useAuthEmailCooldown('password-recovery', normalizedEmail);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCoolingDown) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: buildPasswordRecoveryRedirectUrl(),
      });
      if (error) throw error;

      startCooldown(AUTH_EMAIL_SEND_COOLDOWN_MS);
      setSuccessMsg(t('auth.forgotSuccess', {
        email: normalizedEmail,
        hint: t('auth.mailpitHint'),
      }));
    } catch (error) {
      if (isAuthEmailRateLimitError(error)) {
        startCooldown(AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorMsg(getAuthErrorMessage(error, 'forgot-password', t('auth.forgotFallbackError'), t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      backTo={AUTH_ROUTES.login}
      backLabel={t('auth.backToLogin')}
      footer={(
        <div className="toggle-mode auth-centered-footer">
          <span style={{ color: 'var(--text-muted)' }}>{t('auth.forgotRemembered')}</span>
          <Link to={AUTH_ROUTES.login} className="auth-inline-link">{t('auth.backToLogin')}</Link>
        </div>
      )}
    >
      {errorMsg && (
        <div className="alert-box error">
          <Mail size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box success">
          <Send size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="forgot-email">{t('auth.emailLabel')}</label>
          <input
            id="forgot-email"
            type="email"
            className="form-control"
            placeholder={t('auth.forgotEmailPlaceholder')}
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
          {isCoolingDown && (
            <p className="auth-cooldown-note">
              {t('auth.emailCooldownNote', { seconds: remainingSeconds })}
            </p>
          )}
        </div>

        <button type="submit" className="btn-primary login-btn" disabled={loading || isCoolingDown}>
          <Send size={18} />
          <span>
            {loading
              ? t('auth.forgotSending')
              : isCoolingDown
                ? t('auth.emailCooldownButton', { seconds: remainingSeconds })
                : t('auth.forgotSubmit')}
          </span>
        </button>
      </form>
    </AuthShell>
  );
};
