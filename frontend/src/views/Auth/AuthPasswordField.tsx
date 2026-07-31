import React from 'react';
import { useLanguage } from '../../contexts/useLanguage';

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  minLength?: number;
  autoComplete?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const AuthPasswordField: React.FC<AuthPasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisibility,
  minLength,
  autoComplete,
  onFocus,
  onBlur,
}) => {
  const { t } = useLanguage();

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-row">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-control auth-password-input"
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={onToggleVisibility}
          aria-label={visible ? t('auth.hidePassword', { label }) : t('auth.showPassword', { label })}
        >
          {visible ? t('auth.hide') : t('auth.show')}
        </button>
      </div>
    </div>
  );
};
