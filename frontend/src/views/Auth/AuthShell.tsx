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
}

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  footer,
  backTo = '/',
  backLabel,
}) => {
  const { t } = useLanguage();

  return (
    <div className="login-container">
      <div className="login-glass-card auth-glass-card">
        <Link to={backTo} className="auth-back-link">
          <ArrowLeft size={16} />
          {backLabel || t('auth.home')}
        </Link>

        <div className="login-header auth-header">
          <img
            src="/logo.png"
            alt="Filmory Logo"
            className="login-logo-img"
            style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto', display: 'block' }}
          />
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {children}
        {footer && <div className="auth-footer-block">{footer}</div>}
      </div>
    </div>
  );
};
