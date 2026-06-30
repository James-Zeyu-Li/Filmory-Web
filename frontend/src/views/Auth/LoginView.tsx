import React, { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabaseClient';
import type { Provider } from '@supabase/supabase-js';
import { LogIn, UserPlus, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LoginView.css';

export const LoginView: React.FC = () => {
  const { signInMock } = useAuth();
  const showDevBypass = import.meta.env.DEV;
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isRegister) {
        // --- 注册流程 ---
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg('✅ 注册成功！由于开启了邮箱验证，请打开浏览器访问 Mailpit (默认 http://127.0.0.1:54324) 查收注册验证邮件，点击链接激活后即可登录。');
      } else {
        // --- 登录流程 ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // 成功登录后，全局 AuthContext 会自动监听到状态改变，并重载整个 App
      }
    } catch (err: any) {
      console.error('Login Error Raw:', err);
      setErrorMsg(err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || '验证失败，请检查账号密码。');
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
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      console.error('OAuth Error:', err);
      setErrorMsg(err.message || '快捷登录失败，请稍后再试。');
      setLoading(false);
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
          <h2>Welcome to Filmory</h2>
          <p>工业级云端胶片资产管理平台</p>
        </div>

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

        <form className="login-form" onSubmit={handleAuth}>
          <div className="form-group">
            <label>邮箱 (Email)</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="请输入您的邮箱" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label>密码 (Password)</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
              minLength={6}
            />
          </div>
          
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            <span>{loading ? '处理中...' : (isRegister ? '创建账号' : '登录云端')}</span>
          </button>
        </form>

        <div className="toggle-mode" style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isRegister ? '已有账号？' : '还没有账号？'}
          </span>
          <button 
            type="button" 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', marginLeft: '8px' }}
            onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); setSuccessMsg(''); }}
          >
            {isRegister ? '返回登录' : '立即注册'}
          </button>
        </div>

        <div className="login-divider">
          <span>或使用快捷登录</span>
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
              <span>Dev Access</span>
            </div>

            <div className="login-social-actions">
              <button type="button" className="btn-social" onClick={signInMock} style={{ opacity: 0.6 }}>
                <span>Dev Login (Bypass Auth)</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
