import React from 'react';

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  minLength?: number;
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
}) => (
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
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={onToggleVisibility}
        aria-label={visible ? `隐藏${label}` : `显示${label}`}
      >
        {visible ? '隐藏' : '显示'}
      </button>
    </div>
  </div>
);
