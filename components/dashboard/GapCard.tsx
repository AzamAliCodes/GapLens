import React from 'react';
import { Facet, Gap } from '@/lib/types';
import { NBCard } from '../ui/NBCard';
import { NBBadge } from '../ui/NBBadge';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface GapCardProps {
  gap: Gap;
  facet?: Facet;
}

export function GapCard({ gap, facet }: GapCardProps) {
  const isCritical = gap.severity === 'critical';

  return (
    <NBCard
      variant="normal"
      className={`space-y-3 bg-[#FFFDF8] p-5 border-2.5 border-black shadow-[4px_4px_0_#0A0A0A] ${
        isCritical ? 'border-l-8 border-l-[var(--red)]' : gap.severity === 'high' ? 'border-l-8 border-l-[var(--orange)]' : 'border-l-8 border-l-[var(--yellow)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/15 pb-2.5">
        <div className="flex items-center gap-2">
          <NBBadge label={gap.severity} variant="severity" />
          <span className="text-xs font-mono font-bold text-neutral-600">
            Potential gap, not found in sources reviewed
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-neutral-500">
          ID: {gap.id}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <HelpCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
          <h3 className="text-base sm:text-lg font-black font-heading text-black">
            {facet?.name || 'Unaddressed Facet'}
          </h3>
        </div>
        {facet?.question && (
          <p className="text-xs text-neutral-700 italic font-medium">
            &ldquo;{facet.question}&rdquo;
          </p>
        )}
      </div>

      <div className="p-4 rounded-xl bg-[var(--yellow-light)] border-2 border-black text-xs sm:text-sm text-black leading-relaxed font-medium shadow-[2px_2px_0_#0A0A0A]">
        {gap.note}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-600 pt-1 font-mono font-bold">
        <span>Importance: Level {facet?.criticality || 2} of 3</span>
        <span className="text-red-700 font-black uppercase text-[11px]">Verify Before Deciding</span>
      </div>
    </NBCard>
  );
}
