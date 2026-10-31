import React from 'react';

interface StatTileProps {
  label: string;
  value: number | string;
  subtext?: string;
  variant?: 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'red';
  icon?: React.ReactNode;
}

export function StatTile({ label, value, subtext, variant = 'yellow', icon }: StatTileProps) {
  const tileStyles = {
    yellow: 'bg-[var(--yellow-light)] border-l-8 border-l-[var(--yellow)]',
    pink: 'bg-[var(--pink-light)] border-l-8 border-l-[var(--pink)]',
    blue: 'bg-[var(--blue-light)] border-l-8 border-l-[var(--blue)]',
    green: 'bg-[var(--green-light)] border-l-8 border-l-[var(--green)]',
    orange: 'bg-[var(--orange-light)] border-l-8 border-l-[var(--orange)]',
    red: 'bg-[var(--red-light)] border-l-8 border-l-[var(--red)]',
  }[variant];

  return (
    <div
      className={`nb-card p-5 flex flex-col justify-between ${tileStyles} transition-transform hover:-translate-y-1`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-black uppercase tracking-wider text-black/70">
          {label}
        </span>
        {icon && <span className="p-1.5 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0_#0A0A0A]">{icon}</span>}
      </div>
      <div className="text-3xl sm:text-4xl font-black font-heading text-black tracking-tight my-1">
        {value}
      </div>
      {subtext && (
        <div className="mt-1 text-xs font-medium text-black/80 line-clamp-1">
          {subtext}
        </div>
      )}
    </div>
  );
}
