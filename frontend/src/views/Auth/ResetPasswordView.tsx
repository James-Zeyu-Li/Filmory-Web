import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  getAuthErrorMessage,
  getPasswordValidationMessage,
  PASSWORD_POLICY,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { AuthPasswordField } from './AuthPasswordField';
import { PasswordPolicyHint } from './PasswordPolicyHint';
import './LoginView.css';

export const ResetPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const { session, user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canResetPassword = Boolean(session?.user || user);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const passwordValidationMessage = getPasswordValidationMessage(password);
    if (passwordValidationMessage) {
      setErrorMsg(passwordValidationMessage);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('两次输入的新密码不一致，请重新确认。');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await logout();
      setSuccessMsg('密码已更新。请使用新密码重新登录。');
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error, 'reset-password', '重设密码失败，请重新打开邮件中的链接后再试。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="重设密码"
      subtitle="为你的 Filmory 账号设置一个新的登录密码。"
      backTo={AUTH_ROUTES.login}
      backLabel="返回登录"
      footer={successMsg ? (
        <button
          type="button"
          className="primary login-btn"
          onClick={() => navigate(AUTH_ROUTES.login, { replace: true })}
        >
          返回登录
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

      {!canResetPassword && !successMsg ? (
        <div className="auth-state-panel">
          <h3>链接已失效或不可用</h3>
          <p>当前页面没有可用的重设密码会话。请重新请求一封重设密码邮件，再通过邮件里的链接返回。</p>
          <Link to={AUTH_ROUTES.forgotPassword} className="primary auth-state-cta">
            重新获取重设密码邮件
          </Link>
        </div>
      ) : !successMsg ? (
        <form className="login-form" onSubmit={handleSubmit}>
          <AuthPasswordField
            id="reset-password"
            label="新密码"
            value={password}
            onChange={setPassword}
            placeholder="至少 8 位，包含大小写字母和数字"
            visible={showPassword}
            onToggleVisibility={() => setShowPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
          />

          <AuthPasswordField
            id="reset-password-confirm"
            label="确认新密码"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="请再次输入新密码"
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
          />

          <PasswordPolicyHint password={password} />

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            <KeyRound size={18} />
            <span>{loading ? '更新中...' : '确认更新密码'}</span>
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
};
