import React from 'react';
import { FreshnessFlag, Source } from '@/lib/types';
import { NBCard } from '../ui/NBCard';
import { NBBadge } from '../ui/NBBadge';
import { Clock, CalendarX, History } from 'lucide-react';

interface FreshnessRowProps {
  flag: FreshnessFlag;
  source?: Source;
}

export function FreshnessRow({ flag, source }: FreshnessRowProps) {
  const getIcon = () => {
    switch (flag.type) {
      case 'earlier_cycle':
        return <History className="w-5 h-5 text-black" />;
      case 'stale':
        return <Clock className="w-5 h-5 text-black" />;
      case 'undated':
        return <CalendarX className="w-5 h-5 text-black" />;
    }
  };

  const getBorderAndBg = () => {
    switch (flag.type) {
      case 'earlier_cycle':
        return 'border-l-8 border-l-[var(--red)] bg-[var(--red-light)]';
      case 'stale':
        return 'border-l-8 border-l-[var(--orange)] bg-[var(--orange-light)]';
      case 'undated':
        return 'border-l-8 border-l-[var(--yellow)] bg-[var(--yellow-light)]';
    }
  };

  return (
    <NBCard variant="sm" className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-2 border-black shadow-[3px_3px_0_#0A0A0A] ${getBorderAndBg()}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center shrink-0 mt-0.5 shadow-[1.5px_1.5px_0_#0A0A0A]">
          {getIcon()}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-black bg-white px-2 py-0.5 rounded border border-black text-black shadow-[1px_1px_0_#0A0A0A]">
              Source {flag.sourceId}
            </span>
            <span className="font-bold font-heading text-black text-sm sm:text-base">
              {source?.title || flag.sourceId}
            </span>
            <NBBadge
              label={
                flag.type === 'earlier_cycle'
                  ? 'PAST CYCLE / YEAR'
                  : flag.type === 'stale'
                  ? 'OUTDATED'
                  : 'NO DATE FOUND'
              }
              variant="custom"
              className={flag.type === 'earlier_cycle' ? 'bg-[var(--red)] text-white' : 'bg-[var(--yellow)] text-black'}
            />
          </div>
          <p className="text-xs sm:text-sm text-black font-medium leading-relaxed">
            {flag.reason}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className="text-[10px] font-mono font-black uppercase text-neutral-600 bg-white px-2 py-1 rounded border border-black shadow-[1px_1px_0_#0A0A0A]">
          Date Verified
        </span>
      </div>
    </NBCard>
  );
}
