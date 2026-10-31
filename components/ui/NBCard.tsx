import React from 'react';

interface NBCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'normal' | 'lg' | 'sm';
  accent?: 'none' | 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'red';
  children: React.ReactNode;
}

export function NBCard({
  variant = 'normal',
  accent = 'none',
  children,
  className = '',
  ...props
}: NBCardProps) {
  const cardClass = {
    normal: 'nb-card',
    lg: 'nb-card-lg',
    sm: 'nb-card-sm',
  }[variant];

  const accentBorder = {
    none: '',
    yellow: 'border-l-[10px] border-l-[var(--yellow)]',
    pink: 'border-l-[10px] border-l-[var(--pink)]',
    blue: 'border-l-[10px] border-l-[var(--blue)]',
    green: 'border-l-[10px] border-l-[var(--green)]',
    orange: 'border-l-[10px] border-l-[var(--orange)]',
    red: 'border-l-[10px] border-l-[var(--red)]',
  }[accent];

  return (
    <div
      className={`${cardClass} ${accentBorder} p-4 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
