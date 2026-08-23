import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/useLanguage';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  cardClassName?: string;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  footer,
  backTo = '/',
  backLabel,
  cardClassName,
}) => {
  const { t } = useLanguage();

  return (
    <main className="login-container">
      <div className={['login-glass-card', 'auth-glass-card', cardClassName].filter(Boolean).join(' ')}>
        <Link to={backTo} className="auth-back-link">
          <ArrowLeft size={16} />
          {backLabel || t('auth.home')}
        </Link>

        <div className="login-header auth-header">
          <div className="auth-brand-lockup">
            <img src="/word-logo.webp" alt={t('auth.logoAlt')} className="auth-brand-wordmark" />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {children}
        {footer && <div className="auth-footer-block">{footer}</div>}
      </div>
    </main>
  );
};
