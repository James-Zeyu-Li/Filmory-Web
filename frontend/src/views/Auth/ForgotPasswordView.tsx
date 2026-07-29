import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  AUTH_ROUTES,
  buildPasswordRecoveryRedirectUrl,
  getAuthErrorMessage,
  getMailpitHint,
} from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import './LoginView.css';

export const ForgotPasswordView: React.FC = () => {
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

      setSuccessMsg(`重设密码邮件已发送到 ${normalizedEmail}。${getMailpitHint()}`);
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error, 'forgot-password', '发送重设密码邮件失败，请稍后再试。'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="找回密码"
      subtitle="输入你的登录邮箱，我们会发送一封重设密码邮件。"
      backTo={AUTH_ROUTES.login}
      backLabel="返回登录"
      footer={(
        <div className="toggle-mode auth-centered-footer">
          <span style={{ color: 'var(--text-muted)' }}>想起密码了？</span>
          <Link to={AUTH_ROUTES.login} className="auth-inline-link">返回登录</Link>
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
          <label htmlFor="forgot-email">邮箱</label>
          <input
            id="forgot-email"
            type="email"
            className="form-control"
            placeholder="请输入你的登录邮箱"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary login-btn" disabled={loading}>
          <Send size={18} />
          <span>{loading ? '发送中...' : '发送重设密码邮件'}</span>
        </button>
      </form>
    </AuthShell>
  );
};
