import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildPasswordRecoveryRedirectUrl,
  getAuthErrorMessage,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { useLanguage } from '../../contexts/useLanguage';
import './LoginView.css';

export const ForgotPasswordView: React.FC = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: buildPasswordRecoveryRedirectUrl(),
      });
      if (error) throw error;

      setSuccessMsg(t('auth.forgotSuccess', {
        email: normalizedEmail,
        hint: t('auth.mailpitHint'),
      }));
    } catch (error) {
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
        </div>

        <button type="submit" className="btn-primary login-btn" disabled={loading}>
          <Send size={18} />
          <span>{loading ? t('auth.forgotSending') : t('auth.forgotSubmit')}</span>
        </button>
      </form>
    </AuthShell>
  );
};
