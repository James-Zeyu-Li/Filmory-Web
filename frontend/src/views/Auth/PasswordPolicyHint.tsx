import React from 'react';
import { getPasswordPolicyDescription, validatePassword } from '../../services/authFlow';

interface PasswordPolicyHintProps {
  password: string;
}

export const PasswordPolicyHint: React.FC<PasswordPolicyHintProps> = ({ password }) => {
  const validation = validatePassword(password);

  return (
    <div className="auth-password-panel">
      <p>{getPasswordPolicyDescription()}</p>
      <div className="auth-password-rules">
        <span className={`auth-password-rule ${validation.minLength ? 'passed' : ''}`}>至少 8 位</span>
        <span className={`auth-password-rule ${validation.hasUppercase ? 'passed' : ''}`}>大写字母</span>
        <span className={`auth-password-rule ${validation.hasLowercase ? 'passed' : ''}`}>小写字母</span>
        <span className={`auth-password-rule ${validation.hasNumber ? 'passed' : ''}`}>数字</span>
      </div>
    </div>
  );
};
