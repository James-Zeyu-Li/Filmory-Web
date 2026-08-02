import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildLoginUrl,
  clearPasswordRecoveryIntent,
  getAuthErrorMessage,
  getAuthErrorTranslationKey,
  getAuthSuccessRedirectPath,
  markPasswordRecoveryIntent,
  readAuthCallbackParams,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { useLanguage } from '../../contexts/useLanguage';
import './LoginView.css';

export const AuthCallbackView: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const resolveAuthCallback = async () => {
      const {
        code,
        accessToken,
        refreshToken,
        intent,
        errorDescription,
        nextPath,
      } = readAuthCallbackParams(window.location.href);

      if (errorDescription) {
        if (!cancelled) {
          const key = getAuthErrorTranslationKey(errorDescription, 'callback');
          setErrorMsg(key ? t(key) : getAuthErrorMessage(errorDescription, 'callback', t('auth.callbackFallbackError'), t));
        }
        return;
      }

      try {
        let recoveryUserId: string | undefined;
        const hasCallbackCredential = Boolean(code || (accessToken && refreshToken));

        if (intent === 'recovery' && !hasCallbackCredential) {
          throw new Error('Authentication link expired');
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          recoveryUserId = data.session?.user.id;
        } else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          recoveryUserId = data.session?.user.id;
        }

        if (intent === 'recovery') {
          if (!recoveryUserId) {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            recoveryUserId = data.session?.user.id;
          }

          if (!recoveryUserId) {
            throw new Error('Authentication link expired');
          }

          markPasswordRecoveryIntent(recoveryUserId);
        } else {
          clearPasswordRecoveryIntent();
        }

        if (!cancelled) {
          navigate(
            intent === 'recovery'
              ? AUTH_ROUTES.resetPassword
              : getAuthSuccessRedirectPath(nextPath),
            { replace: true }
          );
        }
      } catch (error) {
        if (!cancelled) {
          const key = getAuthErrorTranslationKey(error, 'callback');
          setErrorMsg(key ? t(key) : getAuthErrorMessage(error, 'callback', t('auth.callbackFallbackError'), t));
        }
      }
    };

    void resolveAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  return (
    <AuthShell
      title={t('auth.callbackTitle')}
      subtitle={t('auth.callbackSubtitle')}
      backTo={AUTH_ROUTES.login}
      backLabel={t('auth.backToLogin')}
    >
      {errorMsg ? (
        <div className="auth-state-panel">
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <Link to={buildLoginUrl()} className="primary auth-state-cta">
            {t('auth.backToLoginPage')}
          </Link>
        </div>
      ) : (
        <div className="auth-state-panel auth-processing-panel">
          <LoaderCircle size={24} className="auth-spinner" />
          <p>{t('auth.callbackProcessing')}</p>
        </div>
      )}
    </AuthShell>
  );
};
