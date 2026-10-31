'use client';

import React from 'react';
import { AtomicClaim, ClaimFinding, Evidence, Source, Verdict } from '@/lib/types';
import { useGapLensStore } from '@/lib/store';
import { NBCard } from '../ui/NBCard';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  FileSearch,
  ShieldAlert,
  SearchCheck,
} from 'lucide-react';

interface ClaimLedgerProps {
  claims: AtomicClaim[];
  findings: ClaimFinding[];
  sources: Source[];
}

export function ClaimLedger({ claims, findings, sources }: ClaimLedgerProps) {
  const { openDrawer } = useGapLensStore();
  const findingMap = new Map(findings.map((f) => [f.claimId, f]));

  const getVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'SUPPORTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-black font-mono font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            SUPPORTED
          </span>
        );
      case 'CONTRADICTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-950 border border-black font-mono font-bold text-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-700" />
            CONTRADICTED
          </span>
        );
      case 'INSUFFICIENT_EVIDENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-black font-mono font-bold text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            UNVERIFIED
          </span>
        );
      case 'CONFLICTING_EVIDENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-950 border border-black font-mono font-bold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-700" />
            CONFLICTING
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-950 border border-black font-mono font-bold text-xs">
            <SearchCheck className="w-3.5 h-3.5 text-blue-700" />
            PARTIALLY SUPPORTED
          </span>
        );
      case 'NOT_FACT_CHECKABLE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-neutral-200 text-neutral-800 border border-black font-mono font-bold text-xs">
            OPINION / GENERAL
          </span>
        );
    }
  };

  const handleOpenEvidence = (ev: Evidence, finding?: ClaimFinding, claim?: AtomicClaim) => {
    const matchedSource = sources.find((s) => s.id === ev.sourceId);
    openDrawer({
      source: matchedSource,
      passage: { id: ev.passageId || 'P1', text: ev.passage },
      quote: ev.exactQuote,
      claim: claim?.normalizedProposition,
      facetName: finding?.verdict,
      reason: finding?.entailmentRationale,
      evidence: ev,
      finding,
      atomicClaim: claim,
      contentHash: matchedSource?.contentHash,
      quoteOffset: ev.quoteOffset,
      verdict: finding?.verdict,
      trustLabel: ev.origin === 'user_url' ? 'sourced' : 'rule',
    });
  };

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const finding = findingMap.get(claim.id);
        const verdict = finding?.verdict || 'INSUFFICIENT_EVIDENCE';

        return (
          <NBCard
            key={claim.id}
            variant="normal"
            className="bg-[#FFFDF8] p-4 sm:p-5 border-2 border-black shadow-[3px_3px_0_#0A0A0A] space-y-3"
          >
            {/* Header: ID, Verdict, Review Alert */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-black text-white px-2 py-0.5 rounded">
                  {claim.id}
                </span>
                {getVerdictBadge(verdict)}
              </div>

              {finding?.requiresHumanReview && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                  <ShieldAlert className="w-3 h-3 text-amber-700" />
                  Needs Manual Check
                </span>
              )}
            </div>

            {/* Answer statement */}
            <div className="space-y-1">
              <p className="text-sm font-bold text-black leading-snug">
                &ldquo;{claim.exactAnswerSpan}&rdquo;
              </p>
              {claim.normalizedProposition !== claim.exactAnswerSpan && (
                <p className="text-xs text-neutral-600 font-sans">
                  {claim.normalizedProposition}
                </p>
              )}
            </div>

            {/* Explanation / Rationale */}
            {finding?.entailmentRationale && (
              <div className="p-2.5 rounded-lg bg-neutral-100 border border-black/15 text-xs text-neutral-800">
                <strong className="block text-black font-mono text-[11px] uppercase mb-0.5">Finding:</strong>
                <p className="leading-relaxed">{finding.entailmentRationale}</p>
              </div>
            )}

            {/* Evidence Link Buttons */}
            <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {finding?.matchedEvidence && finding.matchedEvidence.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-emerald-800">Proof:</span>
                    {finding.matchedEvidence.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => handleOpenEvidence(ev, finding, claim)}
                        className="px-2.5 py-1 rounded bg-white hover:bg-[var(--yellow)] border border-black font-mono font-bold text-xs transition-all shadow-[1px_1px_0_#0A0A0A] flex items-center gap-1 cursor-pointer"
                      >
                        <FileSearch className="w-3 h-3 text-emerald-700" />
                        <span>Source {ev.sourceId}</span>
                      </button>
                    ))}
                  </div>
                )}

                {finding?.contradictingEvidence && finding.contradictingEvidence.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-rose-800">Counter-Proof:</span>
                    {finding.contradictingEvidence.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => handleOpenEvidence(ev, finding, claim)}
                        className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-black font-mono font-bold text-xs transition-all shadow-[1px_1px_0_#0A0A0A] flex items-center gap-1 cursor-pointer text-rose-950"
                      >
                        <FileSearch className="w-3 h-3 text-rose-700" />
                        <span>Source {ev.sourceId}</span>
                      </button>
                    ))}
                  </div>
                )}

                {(!finding?.matchedEvidence || finding.matchedEvidence.length === 0) &&
                  (!finding?.contradictingEvidence || finding.contradictingEvidence.length === 0) && (
                    <span className="text-xs font-mono text-neutral-500 italic">
                      No passages found in reviewed sources.
                    </span>
                  )}
              </div>
            </div>
          </NBCard>
        );
      })}
    </div>
  );
}
