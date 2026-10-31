import React from 'react';
import { useGapLensStore } from '@/lib/store';
import { Fact, Source } from '@/lib/types';

interface CitationChipProps {
  sourceId: string;
  passageId?: string;
  fact?: Fact;
  source?: Source;
  className?: string;
  onClick?: () => void;
}

export function CitationChip({
  sourceId,
  passageId,
  fact,
  source,
  className = '',
  onClick,
}: CitationChipProps) {
  const openDrawer = useGapLensStore(s => s.openDrawer);
  const currentAnalysis = useGapLensStore(s => s.currentAnalysis);

  const display = passageId ? passageId : sourceId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
      return;
    }

    const resolvedSource = source || currentAnalysis?.sources.find(s => s.id === sourceId);
    const resolvedPassage = passageId && resolvedSource
      ? resolvedSource.passages.find(p => p.id === passageId)
      : undefined;

    openDrawer({
      source: resolvedSource,
      passage: resolvedPassage,
      quote: fact?.quote,
      claim: fact?.claim,
      fact,
      trustLabel: fact?.verified ? 'sourced' : 'uncertain',
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`nb-chip inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-[#FFF4DC] hover:bg-[var(--yellow)] cursor-pointer text-black transition-all ${className}`}
      title={`Click to inspect passage evidence for ${display}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-black inline-block"></span>
      <span>{display}</span>
    </button>
  );
}
