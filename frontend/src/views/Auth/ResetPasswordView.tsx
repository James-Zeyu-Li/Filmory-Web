import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  clearPasswordRecoveryIntent,
  getAuthErrorMessage,
  getAuthErrorTranslationKey,
  hasPasswordRecoveryIntent,
  getPasswordValidationMessage,
  PASSWORD_POLICY,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { AuthPasswordField } from './AuthPasswordField';
import { PasswordPolicyHint } from './PasswordPolicyHint';
import { useLanguage } from '../../contexts/useLanguage';
import './LoginView.css';

export const ResetPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;

    const verifyRecoverySession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const currentUserId = data.session?.user.id;
        const isValidRecovery = !error && currentUserId !== undefined && hasPasswordRecoveryIntent(currentUserId);

        if (!isValidRecovery) {
          clearPasswordRecoveryIntent();
        }

        if (!cancelled) {
          setRecoveryState(isValidRecovery ? 'ready' : 'invalid');
        }
      } catch {
        clearPasswordRecoveryIntent();
        if (!cancelled) setRecoveryState('invalid');
      }
    };

    void verifyRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const passwordValidationMessage = getPasswordValidationMessage(password, t);
    if (passwordValidationMessage) {
      setErrorMsg(t('auth.passwordPolicyError', { min: PASSWORD_POLICY.minLength }));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(t('auth.newPasswordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      clearPasswordRecoveryIntent();
      await logout();
      setSuccessMsg(t('auth.resetSuccess'));
    } catch (error) {
      const key = getAuthErrorTranslationKey(error, 'reset-password');
      setErrorMsg(key ? t(key, { min: PASSWORD_POLICY.minLength }) : getAuthErrorMessage(error, 'reset-password', t('auth.resetFallbackError'), t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
      backTo={AUTH_ROUTES.login}
      backLabel={t('auth.backToLogin')}
      footer={successMsg ? (
        <button
          type="button"
          className="primary login-btn"
          onClick={() => navigate(AUTH_ROUTES.login, { replace: true })}
        >
          {t('auth.backToLogin')}
        </button>
      ) : undefined}
    >
      {errorMsg && (
        <div className="alert-box error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {recoveryState === 'checking' ? (
        <div className="auth-state-panel auth-processing-panel">
          <LoaderCircle size={24} className="auth-spinner" />
          <p>{t('auth.callbackProcessing')}</p>
        </div>
      ) : recoveryState === 'invalid' && !successMsg ? (
        <div className="auth-state-panel">
          <h3>{t('auth.resetInvalidTitle')}</h3>
          <p>{t('auth.resetInvalidDesc')}</p>
          <Link to={AUTH_ROUTES.forgotPassword} className="primary auth-state-cta">
            {t('auth.resetRequestAgain')}
          </Link>
        </div>
      ) : !successMsg ? (
        <form className="login-form" onSubmit={handleSubmit}>
          <AuthPasswordField
            id="reset-password"
            label={t('auth.newPasswordLabel')}
            value={password}
            onChange={setPassword}
            placeholder={t('auth.newPasswordPlaceholder')}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
          />

          <AuthPasswordField
            id="reset-password-confirm"
            label={t('auth.confirmNewPasswordLabel')}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t('auth.confirmNewPasswordPlaceholder')}
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
          />

          <PasswordPolicyHint password={password} />

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            <KeyRound size={18} />
            <span>{loading ? t('auth.resetUpdating') : t('auth.resetSubmit')}</span>
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
};
