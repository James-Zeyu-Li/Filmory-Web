import React from 'react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AUTH_ROUTES } from '../../services/authFlow';
import { AuthShell } from './AuthShell';
import { useLanguage } from '../../contexts/useLanguage';
import './LoginView.css';

type AuthStatusMode = 'check-email' | 'verified';

interface AuthStatusViewProps {
  mode: AuthStatusMode;
}

export const AuthStatusView: React.FC<AuthStatusViewProps> = ({ mode }) => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  const isCheckEmail = mode === 'check-email';

  return (
    <AuthShell
      title={isCheckEmail ? t('auth.statusCheckTitle') : t('auth.statusVerifiedTitle')}
      subtitle={isCheckEmail
        ? t('auth.statusCheckSubtitle')
        : t('auth.statusVerifiedSubtitle')}
      backTo={AUTH_ROUTES.login}
      backLabel={t('auth.backToLogin')}
    >
      <div className="auth-state-panel">
        <div className="auth-state-icon">
          {isCheckEmail ? <MailCheck size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <h3>{isCheckEmail ? t('auth.statusSentTitle') : t('auth.statusReadyTitle')}</h3>
        <p>
          {isCheckEmail
            ? t('auth.statusCheckDesc', {
                target: email ? t('auth.statusTargetEmail', { email }) : '',
                hint: t('auth.mailpitHint'),
              })
            : t('auth.statusVerifiedDesc')}
        </p>
        <Link to={AUTH_ROUTES.login} className="primary auth-state-cta">
          {t('auth.backToLogin')}
        </Link>
      </div>
    </AuthShell>
  );
};
