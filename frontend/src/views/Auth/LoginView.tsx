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
  getMailpitHint,
  getPasswordValidationMessage,
  isEmailNotConfirmedError,
  PASSWORD_POLICY,
} from '../../services/authFlow';
import { AuthPasswordField } from './AuthPasswordField';
import { PasswordPolicyHint } from './PasswordPolicyHint';
import './LoginView.css';

export const LoginView: React.FC = () => {
  const { signInMock } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDevBypass = isDevBypassEnabled();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const prefixedMessage = useMemo(() => searchParams.get('message') || '', [searchParams]);
  const authTitle = isRegister ? '创建账号' : '欢迎回来';
  const authSubtitle = isRegister
    ? '创建你的 Filmory 账号，开始整理器材、胶卷和拍摄项目。'
    : '整理你的器材、胶卷与拍摄记录';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setNeedsEmailVerification(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isRegister) {
        const passwordValidationMessage = getPasswordValidationMessage(password);
        if (passwordValidationMessage) {
          setErrorMsg(passwordValidationMessage);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMsg('两次输入的密码不一致，请重新确认。');
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
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
      const message = getAuthErrorMessage(
        error,
        isRegister ? 'signup' : 'login',
        isRegister ? '注册失败，请稍后再试。' : '验证失败，请检查账号密码。'
      );
      if (!isRegister && isEmailNotConfirmedError(message)) {
        setNeedsEmailVerification(true);
        setErrorMsg('该邮箱尚未完成验证。请先打开验证邮件完成确认后，再回来登录。');
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
      setErrorMsg(getAuthErrorMessage(error, 'oauth', '快捷登录失败，请稍后再试。'));
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMsg('请先填写需要验证的邮箱，再重新发送验证邮件。');
      return;
    }

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

      setSuccessMsg(`验证邮件已重新发送到 ${normalizedEmail}。${getMailpitHint()}`);
    } catch (error) {
      setErrorMsg(getAuthErrorMessage(error, 'resend-verification', '重新发送验证邮件失败，请稍后再试。'));
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-glass-card" style={{ position: 'relative' }}>
        <Link to="/" style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
          <ArrowLeft size={16} /> 主页
        </Link>
        <div className="login-header">
          <img src="/logo.png" alt="Filmory Logo" className="login-logo-img" style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
          <h2>{authTitle}</h2>
          <p>{authSubtitle}</p>
        </div>

        {prefixedMessage && (
          <div className="alert-box success">
            <span>{prefixedMessage}</span>
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
            <p>如果你还没收到验证邮件，可以重新发送一封到当前填写的邮箱。</p>
            <div className="auth-inline-actions">
              <button
                type="button"
                className="secondary auth-inline-button"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
              >
                <MailPlus size={16} />
                {isResendingVerification ? '发送中...' : '重新发送验证邮件'}
              </button>
              <Link to={buildCheckEmailUrl(email)} className="auth-inline-link">
                查看说明
              </Link>
            </div>
          </div>
        )}

        <form className="login-form" onSubmit={handleAuth}>
          <div className="form-group">
            <label htmlFor="login-email">邮箱</label>
            <input 
              id="login-email"
              type="email" 
              className="form-control" 
              placeholder="请输入您的邮箱" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <AuthPasswordField
            id="login-password"
            label="密码"
            value={password}
            onChange={setPassword}
            placeholder={isRegister ? '至少 8 位，包含大小写字母和数字' : '请输入账号密码'}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword(current => !current)}
            minLength={PASSWORD_POLICY.minLength}
          />

          {isRegister && (
            <>
              <AuthPasswordField
                id="login-password-confirm"
                label="确认密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="请再次输入同一密码"
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword(current => !current)}
                minLength={PASSWORD_POLICY.minLength}
              />
              <PasswordPolicyHint password={password} />
              <div className="auth-security-panel">
                <ShieldCheck size={16} />
                <span>注册后需要先完成邮箱验证，验证成功后才能正式登录。</span>
              </div>
            </>
          )}
          
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            <span>{loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}</span>
          </button>
        </form>

        <div className="toggle-mode" style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister ? '已有账号？' : '还没有账号？'}
          </span>
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', marginLeft: '8px' }}
            onClick={() => {
              setIsRegister(!isRegister);
              setPassword('');
              setConfirmPassword('');
              setShowPassword(false);
              setShowConfirmPassword(false);
              setErrorMsg('');
              setSuccessMsg('');
              setNeedsEmailVerification(false);
            }}
          >
            {isRegister ? '返回登录' : '立即注册'}
          </button>
        </div>

        {!isRegister && (
          <div className="auth-secondary-row">
            <Link to={AUTH_ROUTES.forgotPassword} className="auth-inline-link">
              忘记密码？
            </Link>
          </div>
        )}

        <div className="login-divider">
          <span>或使用以下方式登录</span>
        </div>

        <div className="login-social-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button 
            type="button" 
            className="btn-social" 
            onClick={() => handleOAuth('google')}
            disabled={loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
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
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
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
              <span>开发测试入口</span>
            </div>

            <div className="login-social-actions">
              <button type="button" className="btn-social" onClick={signInMock} style={{ opacity: 0.6 }}>
                <span>本机测试登录</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
