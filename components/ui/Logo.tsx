import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  subtitle?: string;
  href?: string;
  bordered?: boolean;
}

export function Logo({
  size = 'md',
  showText = true,
  className = '',
  subtitle,
  href = '/',
  bordered = true,
}: LogoProps) {
  // Balanced icon sizes
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  };

  const containerBorder = bordered
    ? 'px-2.5 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0_#0A0A0A] hover:shadow-[3px_3px_0_#0A0A0A]'
    : '';

  const content = (
    <div
      className={`inline-flex items-center gap-2.5 transition-all select-none ${containerBorder} ${className}`}
    >
      {/* Magnifying Lens Icon with Red Focal Accents */}
      <div
        className={`${iconSizes[size]} shrink-0 rounded-lg bg-[#FFF5F5] border-2 border-black flex items-center justify-center overflow-hidden shadow-[1px_1px_0_#0A0A0A]`}
        aria-label="GapLens Magnifying Lens Logo"
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-0.5"
        >
          {/* Glass Lens Outer Rim */}
          <circle
            cx="14.5"
            cy="14.5"
            r="9.5"
            fill="#FFFFFF"
            stroke="#0A0A0A"
            strokeWidth="2.8"
          />

          {/* Red Reflection Glaze Arc */}
          <path
            d="M 9.5 12 A 6 6 0 0 1 15 8.5"
            stroke="#EF4444"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Left Bracket of Gap Reticle */}
          <path
            d="M 11 12.5 L 9.5 12.5 L 9.5 16.5 L 11 16.5"
            stroke="#0A0A0A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Bracket of Gap Reticle */}
          <path
            d="M 18 12.5 L 19.5 12.5 L 19.5 16.5 L 18 16.5"
            stroke="#0A0A0A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Red Gap Focal Target Dot */}
          <circle
            cx="14.5"
            cy="14.5"
            r="2.4"
            fill="#EF4444"
          />

          {/* Lens Handle */}
          <path
            d="M 21.5 21.5 L 30 30"
            stroke="#0A0A0A"
            strokeWidth="3.6"
            strokeLinecap="round"
          />

          {/* Handle Grip Accent Dot */}
          <circle
            cx="29.5"
            cy="29.5"
            r="1.4"
            fill="#EF4444"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none pr-0.5">
          <span className={`font-heading font-black ${textSizes[size]} tracking-tight text-black flex items-center gap-1.5`}>
            GapLens
            <span className="w-2 h-2 rounded-full bg-[#EF4444] border border-black inline-block"></span>
          </span>
          {subtitle && (
            <span className="text-[10px] font-mono font-bold text-neutral-600 uppercase tracking-wider mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group inline-flex items-center focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
