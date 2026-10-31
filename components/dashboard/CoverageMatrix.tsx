import React from 'react';
import { Analysis, Facet, Source } from '@/lib/types';
import { useGapLensStore } from '@/lib/store';
import { NBBadge } from '../ui/NBBadge';
import { Check, AlertCircle, HelpCircle, Eye } from 'lucide-react';

interface CoverageMatrixProps {
  analysis: Analysis;
}

export function CoverageMatrix({ analysis }: CoverageMatrixProps) {
  const openDrawer = useGapLensStore(s => s.openDrawer);
  const { facets, sources, facts, gaps } = analysis;

  const activeSources = sources.filter(s => s.fetchStatus !== 'failed');

  const getCellData = (facet: Facet, source: Source) => {
    const sourceFacts = facts.filter(f => f.facetId === facet.id && f.sourceId === source.id);
    if (sourceFacts.length > 0) {
      const isFull = sourceFacts.some(f => f.coverage === 'full');
      return {
        status: isFull ? 'covered' : 'partial',
        facts: sourceFacts,
      };
    }

    return {
      status: 'missing',
      facts: [],
    };
  };

  const handleCellClick = (facet: Facet, source: Source) => {
    const data = getCellData(facet, source);
    if (data.facts.length > 0) {
      const topFact = data.facts[0];
      const passage = source.passages.find(p => p.id === topFact.passageId);
      openDrawer({
        source,
        passage,
        quote: topFact.quote,
        claim: topFact.claim,
        fact: topFact,
        facetName: facet.name,
        trustLabel: 'sourced',
      });
    } else {
      const gap = gaps.find(g => g.facetId === facet.id);
      openDrawer({
        source,
        facetName: facet.name,
        claim: `Missing Coverage: Source "${source.title}" contains no verified claims addressing "${facet.name}".`,
        quote: '',
        trustLabel: 'uncertain',
        reason: gap?.note || 'Facet is completely unaddressed in this source.',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Matrix Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FFFDF8] rounded-xl border-2.5 border-black shadow-[3px_3px_0_#0A0A0A]">
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-bold">
          <span className="text-black uppercase tracking-wider text-[11px]">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[var(--green)] border border-black inline-block"></span>
            <span className="text-black">Answered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[var(--yellow)] border border-black inline-block"></span>
            <span className="text-black">Partial Mention</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[var(--red-light)] border border-red-500 inline-block"></span>
            <span className="text-black">Not Mentioned (Gap)</span>
          </div>
        </div>
        <span className="text-xs font-mono text-neutral-600 font-medium">
          Click any cell to view exact quotes from your sources
        </span>
      </div>

      {/* Colorful Matrix Table */}
      <div className="nb-card overflow-hidden bg-[#FFFDF8] border-3 border-black shadow-[5px_5px_0_0_#0A0A0A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFF4DC] border-b-2.5 border-black text-xs text-black font-mono font-black uppercase tracking-wider">
                <th className="p-3 sm:p-4 border-r-2 border-black w-2/5 min-w-[190px]">
                  Topic / Key Question
                </th>
                {activeSources.map(source => (
                  <th key={source.id} className="p-2 sm:p-3 border-r-2 border-black text-center min-w-[85px] sm:min-w-[110px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--yellow)] border border-black text-[10px] sm:text-xs font-mono font-black text-black shadow-[1px_1px_0_#0A0A0A]">
                        {source.id}
                      </span>
                      <span className="truncate max-w-[80px] sm:max-w-[120px] text-[11px] sm:text-xs font-heading font-black text-black" title={source.title}>
                        {source.title}
                      </span>
                      <NBBadge label={source.kind} variant="source" className="text-[9px] py-0 px-1" />
                    </div>
                  </th>
                ))}
                <th className="p-2 sm:p-3 text-center min-w-[80px] sm:min-w-[100px] w-24 sm:w-28">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/15 text-sm">
              {facets.map(facet => {
                const rowCells = activeSources.map(s => getCellData(facet, s));
                const coveredTotal = rowCells.filter(c => c.status === 'covered').length;
                const partialTotal = rowCells.filter(c => c.status === 'partial').length;
                const isEntirelyMissing = coveredTotal === 0 && partialTotal === 0;

                return (
                  <tr
                    key={facet.id}
                    className={`transition-colors hover:bg-[var(--yellow-light)]/60 ${
                      isEntirelyMissing ? 'bg-[var(--red-light)]/50' : coveredTotal > 0 ? 'bg-white' : 'bg-[#FFFDF8]'
                    }`}
                  >
                    {/* Facet Info Column */}
                    <td className="p-3 sm:p-4 border-r-2 border-black/15 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] sm:text-[11px] font-mono font-black bg-[var(--yellow)] text-black px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0_#0A0A0A] shrink-0">
                            {facet.id}
                          </span>
                          <span className="font-bold font-heading text-black text-xs sm:text-sm break-words">
                            {facet.name}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-neutral-800 leading-snug font-medium break-words">
                          {facet.question}
                        </p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[9px] sm:text-[10px] font-mono font-bold text-neutral-500 uppercase">
                            Importance:
                          </span>
                          <NBBadge
                            label={facet.criticality === 3 ? 'critical' : facet.criticality === 2 ? 'high' : 'medium'}
                            variant="severity"
                            className="text-[9px] py-0 px-1"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Source Cells */}
                    {activeSources.map(source => {
                      const data = getCellData(facet, source);

                      if (data.status === 'covered') {
                        return (
                          <td
                            key={source.id}
                            onClick={() => handleCellClick(facet, source)}
                            className="p-2 sm:p-3 border-r-2 border-black/15 text-center align-middle cursor-pointer hover:bg-[var(--green-light)] transition-colors group"
                            title="Click to view quoted evidence"
                          >
                            <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-[var(--green)] text-black border-2 border-black text-[11px] sm:text-xs font-black group-hover:scale-105 transition-transform shadow-[1.5px_1.5px_0_#0A0A0A]">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span className="hidden sm:inline">Covered</span>
                            </div>
                          </td>
                        );
                      }

                      if (data.status === 'partial') {
                        return (
                          <td
                            key={source.id}
                            onClick={() => handleCellClick(facet, source)}
                            className="p-2 sm:p-3 border-r-2 border-black/15 text-center align-middle cursor-pointer hover:bg-[var(--yellow-light)] transition-colors group"
                            title="Click to view partial quote"
                          >
                            <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-[var(--yellow)] text-black border-2 border-black text-[11px] sm:text-xs font-black group-hover:scale-105 transition-transform shadow-[1.5px_1.5px_0_#0A0A0A]">
                              <AlertCircle className="w-3 h-3" />
                              <span className="hidden sm:inline">Partial</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={source.id}
                          onClick={() => handleCellClick(facet, source)}
                          className="p-2 sm:p-3 border-r-2 border-black/15 text-center align-middle cursor-pointer hover:bg-red-50 transition-colors group"
                          title="Missing: no claims found in this source"
                        >
                          <div className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-white text-red-600 border border-dashed border-red-500 text-[11px] sm:text-xs font-bold group-hover:bg-red-50 transition-colors">
                            <HelpCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">Missing</span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Overall Row Coverage Status */}
                    <td className="p-2 sm:p-3 text-center align-middle">
                      {isEntirelyMissing ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--red)] text-white border border-black text-[10px] sm:text-xs font-black font-mono shadow-[1px_1px_0_#0A0A0A]">
                          MISSING
                        </span>
                      ) : coveredTotal > 0 ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--green-light)] text-black border border-black text-[10px] sm:text-xs font-mono font-bold shadow-[1px_1px_0_#0A0A0A]">
                          {coveredTotal}/{activeSources.length}
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--yellow-light)] text-black border border-black text-[10px] sm:text-xs font-mono font-bold shadow-[1px_1px_0_#0A0A0A]">
                          Partial
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
