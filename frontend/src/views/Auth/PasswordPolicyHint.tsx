import React from 'react';
import { PASSWORD_POLICY, validatePassword } from '../../services/authFlow';
import { useLanguage } from '../../contexts/useLanguage';

interface PasswordPolicyHintProps {
  password: string;
}

export const PasswordPolicyHint: React.FC<PasswordPolicyHintProps> = ({ password }) => {
  const validation = validatePassword(password);
  const { t } = useLanguage();

  return (
    <div className="auth-password-panel">
      <p>{t('auth.passwordPolicyDescription', { min: PASSWORD_POLICY.minLength })}</p>
      <div className="auth-password-rules">
        <span className={`auth-password-rule ${validation.minLength ? 'passed' : ''}`}>{t('auth.ruleMinLength', { min: PASSWORD_POLICY.minLength })}</span>
        <span className={`auth-password-rule ${validation.hasUppercase ? 'passed' : ''}`}>{t('auth.ruleUppercase')}</span>
        <span className={`auth-password-rule ${validation.hasLowercase ? 'passed' : ''}`}>{t('auth.ruleLowercase')}</span>
        <span className={`auth-password-rule ${validation.hasNumber ? 'passed' : ''}`}>{t('auth.ruleNumber')}</span>
      </div>
    </div>
  );
};
