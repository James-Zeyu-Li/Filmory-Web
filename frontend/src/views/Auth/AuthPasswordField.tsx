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
  inputRef?: React.Ref<HTMLInputElement>;
  errorMessage?: string;
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
  inputRef,
  errorMessage,
}) => {
  const { t } = useLanguage();
  const errorId = `${id}-error`;

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-row">
        <input
          ref={inputRef}
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
          aria-invalid={errorMessage ? 'true' : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={onToggleVisibility}
          aria-label={visible ? t('auth.hidePassword', { label }) : t('auth.showPassword', { label })}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? t('auth.hide') : t('auth.show')}
        </button>
      </div>
      {errorMessage && (
        <p id={errorId} className="auth-field-error" role="alert" aria-live="assertive">
          {errorMessage}
        </p>
      )}
    </div>
  );
};
