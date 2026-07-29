import React, { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'solid' | 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className = '',
      variant = 'ghost',
      size = 'md',
      icon,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    // Map variants to existing CSS classes.
    // 'ghost' is the default transparent-ish icon-btn.
    // 'solid' provides a solid background for cases like the back button on white backgrounds.
    
    let variantClass = '';
	    if (variant === 'danger') variantClass = 'danger';
	    if (variant === 'primary') variantClass = 'primary';
	    if (variant === 'success') variantClass = 'success';
	    if (variant === 'solid') variantClass = 'secondary'; // Uses generic secondary styling which provides a background.
	    const sizeClass = size === 'sm' ? 'icon-btn-sm' : size === 'lg' ? 'icon-btn-lg' : '';

	    return (
	      <button
	        ref={ref}
	        className={`icon-btn ${sizeClass} ${variantClass} ${className}`.trim()}
        disabled={disabled}
        style={{
          ...style,
          ...(variant === 'solid' ? { backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' } : {})
        }}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
