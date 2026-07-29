import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildLoginUrl,
  getAuthErrorMessage,
  getAuthSuccessRedirectPath,
  readAuthCallbackParams,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import './LoginView.css';

export const AuthCallbackView: React.FC = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const resolveAuthCallback = async () => {
      const { code, errorDescription, nextPath } = readAuthCallbackParams(window.location.href);

      if (errorDescription) {
        if (!cancelled) {
          setErrorMsg(getAuthErrorMessage(errorDescription, 'callback', '认证回跳失败，请重新发起登录或密码重设流程。'));
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
          setErrorMsg(getAuthErrorMessage(error, 'callback', '认证回跳失败，请重新发起登录或密码重设流程。'));
        }
      }
    };

    void resolveAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuthShell
      title="正在完成认证"
      subtitle="请稍候，我们正在校验你的登录状态并跳转到下一步。"
      backTo={AUTH_ROUTES.login}
      backLabel="返回登录"
    >
      {errorMsg ? (
        <div className="auth-state-panel">
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <Link to={buildLoginUrl()} className="primary auth-state-cta">
            返回登录页
          </Link>
        </div>
      ) : (
        <div className="auth-state-panel auth-processing-panel">
          <LoaderCircle size={24} className="auth-spinner" />
          <p>正在处理认证回调，请不要关闭当前页面。</p>
        </div>
      )}
    </AuthShell>
  );
};
