import React from 'react';

interface NBButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'yellow' | 'pink' | 'blue' | 'green' | 'white' | 'red';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function NBButton({
  variant = 'yellow',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: NBButtonProps) {
  const bgStyles = {
    yellow: 'bg-[var(--yellow)] hover:bg-[#ffe066]',
    pink: 'bg-[var(--pink)] text-white hover:bg-[#ff85b0]',
    blue: 'bg-[var(--blue)] text-white hover:bg-[#6ba8ff]',
    green: 'bg-[var(--green)] hover:bg-[#72e89d]',
    white: 'bg-white hover:bg-neutral-100',
    red: 'bg-[var(--red)] text-white hover:bg-[#ff6b6b]',
  }[variant];

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base font-extrabold',
  }[size];

  return (
    <button
      className={`nb-btn ${bgStyles} ${sizeStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
