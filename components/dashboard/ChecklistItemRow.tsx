import React from 'react';
import { ChecklistItem } from '@/lib/types';
import { useGapLensStore } from '@/lib/store';
import { NBCard } from '../ui/NBCard';
import { NBBadge } from '../ui/NBBadge';
import { CheckSquare, Square, ShieldCheck } from 'lucide-react';

interface ChecklistItemRowProps {
  item: ChecklistItem;
}

export function ChecklistItemRow({ item }: ChecklistItemRowProps) {
  const toggleChecklistItem = useGapLensStore(s => s.toggleChecklistItem);
  const openDrawer = useGapLensStore(s => s.openDrawer);
  const currentAnalysis = useGapLensStore(s => s.currentAnalysis);

  const isCritical = item.priority === 'critical';
  const isDone = item.done;

  const handleEvidenceClick = (evidenceId: string) => {
    if (!currentAnalysis) return;

    const conflict = currentAnalysis.conflicts.find(c => c.id === evidenceId);
    if (conflict) {
      openDrawer({
        facetName: `Contradiction: ${conflict.facetId}`,
        claim: conflict.reason,
        trustLabel: conflict.method === 'rule' ? 'rule' : 'ai',
        quote: `Source ${conflict.a.sourceId}: "${conflict.a.quote}" vs Source ${conflict.b.sourceId}: "${conflict.b.quote}"`,
      });
      return;
    }

    const gap = currentAnalysis.gaps.find(g => g.id === evidenceId);
    if (gap) {
      openDrawer({
        facetName: `Gap: ${gap.facetId}`,
        claim: gap.note,
        trustLabel: 'uncertain',
      });
      return;
    }

    const fact = currentAnalysis.facts.find(f => f.id === evidenceId);
    if (fact) {
      const src = currentAnalysis.sources.find(s => s.id === fact.sourceId);
      const passage = src?.passages.find(p => p.id === fact.passageId);
      openDrawer({
        source: src,
        passage,
        quote: fact.quote,
        claim: fact.claim,
        fact,
        trustLabel: 'sourced',
      });
      return;
    }

    const flag = currentAnalysis.freshness.find(f => f.id === evidenceId);
    if (flag) {
      const src = currentAnalysis.sources.find(s => s.id === flag.sourceId);
      openDrawer({
        source: src,
        claim: flag.reason,
        trustLabel: 'rule',
      });
    }
  };

  return (
    <NBCard
      variant="normal"
      className={`transition-all bg-[#FFFDF8] p-5 border-2.5 border-black shadow-[4px_4px_0_#0A0A0A] ${
        isDone
          ? 'opacity-60 bg-neutral-100 border-neutral-400'
          : isCritical
          ? 'border-l-8 border-l-[var(--red)]'
          : item.priority === 'high'
          ? 'border-l-8 border-l-[var(--orange)]'
          : 'border-l-8 border-l-[var(--yellow)]'
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Toggle Checkbox Button */}
        <button
          type="button"
          onClick={() => toggleChecklistItem(item.id)}
          className="mt-0.5 text-black hover:scale-110 transition-transform cursor-pointer shrink-0"
          title={isDone ? 'Mark as incomplete' : 'Mark as verified'}
        >
          {isDone ? (
            <CheckSquare className="w-6 h-6 text-emerald-700 fill-[var(--green-light)]" />
          ) : (
            <Square className="w-6 h-6 text-black stroke-[2.5]" />
          )}
        </button>

        {/* Item Details */}
        <div className="flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NBBadge label={item.priority} variant="severity" />
              <NBBadge label={item.label} variant="trust" />
            </div>
            {isDone && (
              <span className="text-[11px] font-mono font-black uppercase text-black bg-[var(--green)] px-2 py-0.5 rounded border border-black shadow-[1.5px_1.5px_0_#0A0A0A]">
                VERIFIED
              </span>
            )}
          </div>

          <p className={`text-base font-black font-heading text-black leading-snug ${isDone ? 'line-through text-neutral-500' : ''}`}>
            {item.action}
          </p>

          {/* Where to verify */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-black bg-[var(--yellow-light)] px-3 py-2 rounded-lg border-1.5 border-black shadow-[1.5px_1.5px_0_#0A0A0A]">
            <span className="font-mono font-black text-black/70 uppercase text-[10px]">Where to check:</span>
            <span className="text-black font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700 inline shrink-0" />
              {item.whereToVerify}
            </span>
          </div>

          {/* Evidence Backlinks */}
          {item.evidence && item.evidence.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-neutral-500 font-mono text-[11px] font-bold">Related findings:</span>
              {item.evidence.map(evId => (
                <button
                  key={evId}
                  type="button"
                  onClick={() => handleEvidenceClick(evId)}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-white hover:bg-[var(--yellow)] border border-black text-black font-mono font-bold cursor-pointer transition-colors shadow-[1px_1px_0_#0A0A0A]"
                  title="Click to view details"
                >
                  {evId}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </NBCard>
  );
}
