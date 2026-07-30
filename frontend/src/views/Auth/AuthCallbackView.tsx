import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildLoginUrl,
  getAuthErrorMessage,
  getAuthErrorTranslationKey,
  getAuthSuccessRedirectPath,
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
      const { code, errorDescription, nextPath } = readAuthCallbackParams(window.location.href);

      if (errorDescription) {
        if (!cancelled) {
          const key = getAuthErrorTranslationKey(errorDescription, 'callback');
          setErrorMsg(key ? t(key) : getAuthErrorMessage(errorDescription, 'callback', t('auth.callbackFallbackError'), t));
        }
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (!cancelled) {
          navigate(getAuthSuccessRedirectPath(nextPath), { replace: true });
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
