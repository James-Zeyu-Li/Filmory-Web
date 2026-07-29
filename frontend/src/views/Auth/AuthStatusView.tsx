import React from 'react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AUTH_ROUTES, getMailpitHint } from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import './LoginView.css';

type AuthStatusMode = 'check-email' | 'verified';

interface AuthStatusViewProps {
  mode: AuthStatusMode;
}

export const AuthStatusView: React.FC<AuthStatusViewProps> = ({ mode }) => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  const isCheckEmail = mode === 'check-email';

  return (
    <AuthShell
      title={isCheckEmail ? '请检查邮箱' : '邮箱验证成功'}
      subtitle={isCheckEmail
        ? '我们已经向你的邮箱发送了一封验证邮件。'
        : '你的邮箱已完成验证，现在可以回到 Filmory 登录。'}
      backTo={AUTH_ROUTES.login}
      backLabel="返回登录"
    >
      <div className="auth-state-panel">
        <div className="auth-state-icon">
          {isCheckEmail ? <MailCheck size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <h3>{isCheckEmail ? '验证邮件已发送' : '账号已可正常登录'}</h3>
        <p>
          {isCheckEmail
            ? `${email ? `目标邮箱：${email}。` : ''}${getMailpitHint()} 完成验证后会自动回到应用。`
            : '如果你是从验证邮件跳转回来的，现在可以直接使用邮箱和密码登录。'}
        </p>
        <Link to={AUTH_ROUTES.login} className="primary auth-state-cta">
          返回登录
        </Link>
      </div>
    </AuthShell>
  );
};
