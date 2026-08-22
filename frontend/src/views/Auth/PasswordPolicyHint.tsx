import React from 'react';
import { Check, Circle } from 'lucide-react';
import { PASSWORD_POLICY, validatePassword } from '../../services/authFlow';
import { useLanguage } from '../../contexts/useLanguage';

interface PasswordPolicyHintProps {
  password: string;
}

interface PasswordRuleProps {
  label: string;
  passed: boolean;
  statusLabel: string;
}

const PasswordRule = ({ label, passed, statusLabel }: PasswordRuleProps) => (
  <span
    className={`auth-password-rule ${passed ? 'passed' : ''}`}
    aria-label={`${label}: ${statusLabel}`}
  >
    {passed ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
    <span aria-hidden="true">{label}</span>
  </span>
);

export const PasswordPolicyHint: React.FC<PasswordPolicyHintProps> = ({ password }) => {
  const validation = validatePassword(password);
  const { t } = useLanguage();

  return (
    <div className="auth-password-panel">
      <p>{t('auth.passwordPolicyDescription', { min: PASSWORD_POLICY.minLength })}</p>
      <div className="auth-password-rules">
        <PasswordRule
          label={t('auth.ruleMinLength', { min: PASSWORD_POLICY.minLength })}
          passed={validation.minLength}
          statusLabel={t(validation.minLength ? 'auth.ruleMet' : 'auth.ruleNotMet')}
        />
        <PasswordRule
          label={t('auth.ruleUppercase')}
          passed={validation.hasUppercase}
          statusLabel={t(validation.hasUppercase ? 'auth.ruleMet' : 'auth.ruleNotMet')}
        />
        <PasswordRule
          label={t('auth.ruleLowercase')}
          passed={validation.hasLowercase}
          statusLabel={t(validation.hasLowercase ? 'auth.ruleMet' : 'auth.ruleNotMet')}
        />
        <PasswordRule
          label={t('auth.ruleNumber')}
          passed={validation.hasNumber}
          statusLabel={t(validation.hasNumber ? 'auth.ruleMet' : 'auth.ruleNotMet')}
        />
      </div>
    </div>
  );
};
