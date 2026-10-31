import React from 'react';
import { TrustLabel } from '@/lib/types';

interface NBBadgeProps {
  label?: TrustLabel | 'critical' | 'high' | 'medium' | 'low' | 'official' | 'third_party' | 'institutional' | 'news' | 'pasted' | string;
  variant?: 'trust' | 'severity' | 'source' | 'custom';
  text?: string;
  className?: string;
}

export function NBBadge({ label, variant = 'custom', text, className = '' }: NBBadgeProps) {
  let bg = '#FFD23F';
  let textColor = '#0A0A0A';
  let display = text || label || '';

  // 1. Trust Badges (PRD Section 8)
  if (variant === 'trust' || label === 'sourced' || label === 'rule' || label === 'ai' || label === 'uncertain') {
    switch (label) {
      case 'sourced':
        bg = 'var(--green)';
        display = 'SOURCED';
        break;
      case 'rule':
        bg = 'var(--blue)';
        display = 'RULE BASED';
        break;
      case 'ai':
        bg = 'var(--purple)';
        display = 'AI SUGGESTION';
        break;
      case 'uncertain':
        bg = 'var(--orange)';
        display = 'UNCERTAIN';
        break;
    }
  }
  // 2. Severity Badges
  else if (variant === 'severity' || ['critical', 'high', 'medium', 'low'].includes(label || '')) {
    switch (label) {
      case 'critical':
        bg = 'var(--red)';
        display = 'CRITICAL';
        break;
      case 'high':
        bg = 'var(--orange)';
        display = 'HIGH';
        break;
      case 'medium':
        bg = 'var(--yellow)';
        display = 'MEDIUM';
        break;
      case 'low':
        bg = '#E2E8F0';
        display = 'LOW';
        break;
    }
  }
  // 3. Source Kind Badges
  else if (variant === 'source' || ['official', 'third_party', 'institutional', 'news', 'pasted'].includes(label || '')) {
    switch (label) {
      case 'official':
        bg = 'var(--green)';
        display = 'OFFICIAL';
        break;
      case 'institutional':
        bg = '#74B9FF';
        display = 'INSTITUTION';
        break;
      case 'news':
        bg = '#D6A2E8';
        display = 'NEWS';
        break;
      case 'third_party':
        bg = 'var(--yellow)';
        display = 'THIRD PARTY';
        break;
      case 'pasted':
        bg = '#F5CD79';
        display = 'PASTED TEXT';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-extrabold tracking-wider uppercase rounded-md border-2 border-black shadow-[2px_2px_0_#0A0A0A] ${className}`}
      style={{ backgroundColor: bg, color: textColor }}
    >
      {display}
    </span>
  );
}
