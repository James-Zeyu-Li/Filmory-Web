import React, { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'outline' | 'text' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      disabled,
      style,
      ...props
    },
    ref
	  ) => {
	    // Map variants to existing CSS classes.
	    const variantClass = variant === 'secondary' ? 'secondary' :
	                         variant === 'outline' ? 'outline-btn' :
	                         variant === 'text' ? 'text-btn' :
	                         variant === 'ghost' ? 'text-btn' :
	                         variant;
	    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

	    return (
	      <button
	        ref={ref}
	        className={`${variantClass} ${sizeClass} ${className}`.trim()}
        disabled={disabled}
        style={style}
        {...props}
      >
        {icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
        {children}
        {icon && iconPosition === 'right' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
