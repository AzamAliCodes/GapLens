import React from 'react';
import { Conflict, Facet, Source } from '@/lib/types';
import { NBCard } from '../ui/NBCard';
import { NBBadge } from '../ui/NBBadge';
import { CitationChip } from '../ui/CitationChip';
import { Swords, AlertTriangle } from 'lucide-react';

interface ConflictCardProps {
  conflict: Conflict;
  facet?: Facet;
  sources: Source[];
}

export function ConflictCard({ conflict, facet, sources }: ConflictCardProps) {
  const sourceA = sources.find(s => s.id === conflict.a.sourceId);
  const sourceB = sources.find(s => s.id === conflict.b.sourceId);

  return (
    <NBCard variant="normal" className="space-y-4 bg-[#FFFDF8] p-5 border-l-8 border-l-[var(--orange)] border-2.5 border-black shadow-[4px_4px_0_#0A0A0A]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/15 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--orange)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_#0A0A0A]">
            <Swords className="w-5 h-5 text-black" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-black text-neutral-500 uppercase tracking-wider block">
              Sources Disagree On
            </span>
            <h3 className="text-base sm:text-lg font-black font-heading text-black">
              {facet?.name || conflict.facetId}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NBBadge
            label={conflict.method === 'rule' ? 'rule' : 'ai'}
            variant="trust"
          />
          <NBBadge label={conflict.severity} variant="severity" />
        </div>
      </div>

      {/* Discrepancy Reason */}
      <div className="p-3.5 rounded-xl bg-[var(--orange-light)] border-2 border-black text-xs sm:text-sm text-black flex items-start gap-2.5 leading-relaxed shadow-[2px_2px_0_#0A0A0A]">
        <AlertTriangle className="w-5 h-5 text-orange-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-xs uppercase font-mono tracking-wider text-orange-950 font-black mb-0.5">
            Difference Explained:
          </strong>
          <span className="font-medium">{conflict.reason}</span>
        </div>
      </div>

      {/* Side by side comparison with clean VS sticker */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Source A Column */}
        <div className="p-4 rounded-xl bg-[var(--green-light)] border-2 border-black flex flex-col justify-between space-y-3 shadow-[2.5px_2.5px_0_#0A0A0A]">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-black flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] border border-black inline-block"></span>
                <span>Source {conflict.a.sourceId} ({sourceA?.title || 'Source A'})</span>
              </span>
              <CitationChip
                sourceId={conflict.a.sourceId}
                passageId={conflict.a.passageId}
                source={sourceA}
              />
            </div>

            <div className="p-3 bg-white rounded-lg border-2 border-black text-xs font-bold text-black shadow-[1.5px_1.5px_0_#0A0A0A]">
              <strong className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                Summary:
              </strong>
              <p>{conflict.a.claim}</p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-neutral-300 text-xs text-neutral-800">
              <strong className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                Exact Quote from Source:
              </strong>
              <blockquote className="italic border-l-2.5 border-[var(--green)] pl-2.5 leading-relaxed font-medium">
                &ldquo;{conflict.a.quote}&rdquo;
              </blockquote>
            </div>
          </div>
        </div>

        {/* Center VS Sticker */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <span className="px-3 py-1 rounded-lg bg-[var(--yellow)] border-2 border-black text-xs font-black shadow-[2px_2px_0_#0A0A0A] -rotate-3">
            VS
          </span>
        </div>

        {/* Source B Column */}
        <div className="p-4 rounded-xl bg-[var(--yellow-light)] border-2 border-black flex flex-col justify-between space-y-3 shadow-[2.5px_2.5px_0_#0A0A0A]">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-black flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--yellow)] border border-black inline-block"></span>
                <span>Source {conflict.b.sourceId} ({sourceB?.title || 'Source B'})</span>
              </span>
              <CitationChip
                sourceId={conflict.b.sourceId}
                passageId={conflict.b.passageId}
                source={sourceB}
              />
            </div>

            <div className="p-3 bg-white rounded-lg border-2 border-black text-xs font-bold text-black shadow-[1.5px_1.5px_0_#0A0A0A]">
              <strong className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                Summary:
              </strong>
              <p>{conflict.b.claim}</p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-neutral-300 text-xs text-neutral-800">
              <strong className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
                Exact Quote from Source:
              </strong>
              <blockquote className="italic border-l-2.5 border-[var(--yellow)] pl-2.5 leading-relaxed font-medium">
                &ldquo;{conflict.b.quote}&rdquo;
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </NBCard>
  );
}
