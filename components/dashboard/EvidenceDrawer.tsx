'use client';

import React from 'react';
import { useGapLensStore } from '@/lib/store';
import { NBBadge } from '../ui/NBBadge';
import { NBButton } from '../ui/NBButton';
import {
  X,
  ExternalLink,
  ShieldCheck,
  Quote,
  Hash,
  Compass,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';

export function EvidenceDrawer() {
  const { activeDrawer, closeDrawer } = useGapLensStore();
  const {
    isOpen,
    source,
    passage,
    quote,
    claim,
    trustLabel,
    evidence,
    finding,
    atomicClaim,
    contentHash,
    quoteOffset,
    verdict,
    reason,
  } = activeDrawer;

  if (!isOpen) return null;

  const renderHighlightedPassage = () => {
    if (!passage || !passage.text) {
      return <p className="italic text-neutral-500">No passage content available.</p>;
    }

    const fullText = passage.text;
    const cleanQuote = quote?.trim();

    if (!cleanQuote) {
      return <p className="whitespace-pre-wrap">{fullText}</p>;
    }

    const index = fullText.toLowerCase().indexOf(cleanQuote.toLowerCase());

    if (index === -1) {
      return (
        <div>
          <p className="whitespace-pre-wrap">{fullText}</p>
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border-2 border-black text-xs font-mono shadow-[2px_2px_0_#0A0A0A]">
            <strong>Cited Claim Excerpt:</strong> &ldquo;{cleanQuote}&rdquo;
          </div>
        </div>
      );
    }

    const before = fullText.slice(0, index);
    const match = fullText.slice(index, index + cleanQuote.length);
    const after = fullText.slice(index + cleanQuote.length);

    return (
      <p className="whitespace-pre-wrap leading-relaxed text-sm">
        <span>{before}</span>
        <mark className="bg-[var(--yellow)] text-black px-1.5 py-0.5 rounded-sm font-bold border-b-2 border-black">
          {match}
        </mark>
        <span>{after}</span>
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={closeDrawer}
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-xl bg-[#FFFDF8] border-l-3 border-black h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b-2.5 border-black flex items-center justify-between bg-[#FFF4DC]">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[var(--yellow)] border-2 border-black text-xs font-mono font-black uppercase shadow-[1.5px_1.5px_0_#0A0A0A]">
              EVIDENCE INSPECTION
            </span>
            {verdict && (
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black text-white">
                {verdict}
              </span>
            )}
            {trustLabel && <NBBadge label={trustLabel} variant="trust" />}
          </div>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-black bg-white hover:bg-[var(--yellow)] font-bold cursor-pointer transition-all shadow-[1.5px_1.5px_0_#0A0A0A]"
            title="Close"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Proposition & Rationale */}
          {(claim || reason) && (
            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2.5px_2.5px_0_#0A0A0A] space-y-2">
              {claim && (
                <div>
                  <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                    Claim Proposition:
                  </span>
                  <p className="text-sm font-bold text-black mt-0.5">{claim}</p>
                </div>
              )}

              {atomicClaim?.exactAnswerSpan && (
                <div className="pt-2 border-t border-black/10">
                  <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                    Exact Candidate Answer Span:
                  </span>
                  <div className="p-2 rounded bg-amber-50 border border-black/30 font-mono text-xs text-black mt-1">
                    &ldquo;{atomicClaim.exactAnswerSpan}&rdquo;
                  </div>
                </div>
              )}

              {reason && (
                <div className="pt-2 border-t border-black/10">
                  <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider block">
                    Entailment Rationale:
                  </span>
                  <p className="text-xs font-mono text-neutral-800 mt-0.5">{reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Source Identification & Provenance Metadata */}
          <div className="p-4 rounded-xl bg-[#FFF9EC] border-2 border-black space-y-2.5 shadow-[2.5px_2.5px_0_#0A0A0A]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-mono font-black text-neutral-500 uppercase tracking-wider block">
                  Source {source?.id || evidence?.sourceId || 'Ref'}
                </span>
                <h3 className="text-base font-black font-heading text-black">
                  {source?.title || 'Referenced Source'}
                </h3>
              </div>
              {source?.kind && <NBBadge label={source.kind} variant="source" />}
            </div>

            {source?.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 hover:underline break-all font-semibold"
              >
                <span>{source.url}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            )}

            <div className="pt-2 border-t border-black/15 grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-700">
              {source?.domain && (
                <div>
                  <span className="font-bold">Domain:</span> {source.domain}
                </div>
              )}
              {passage?.id && (
                <div>
                  <span className="font-bold">Passage ID:</span> {passage.id}
                </div>
              )}
              {source?.publishedAt && (
                <div>
                  <span className="font-bold">Published:</span>{' '}
                  {new Date(source.publishedAt).toLocaleDateString()}
                </div>
              )}
              {quoteOffset && (
                <div>
                  <span className="font-bold">Quote Offsets:</span> {quoteOffset.start}–{quoteOffset.end}
                </div>
              )}
              {(contentHash || source?.contentHash) && (
                <div className="col-span-2 flex items-center gap-1 truncate text-neutral-600">
                  <Hash className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span>Snapshot SHA-256:</span>
                  <code className="text-[10px] bg-white px-1 border border-neutral-300 rounded font-mono">
                    {contentHash || source?.contentHash}
                  </code>
                </div>
              )}
              {source?.provenanceGroupId && (
                <div className="col-span-2 flex items-center gap-1 truncate text-neutral-600">
                  <Compass className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span>Provenance Group:</span>
                  <code className="text-[10px] bg-white px-1 border border-neutral-300 rounded font-mono">
                    {source.provenanceGroupId}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Verbatim Source Passage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-black">
                <Quote className="w-4 h-4 text-black" />
                <span>ORIGINAL SOURCE TEXT SNAPSHOT</span>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-500">
                {passage?.wordCount ? `${passage.wordCount} words` : ''}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border-2 border-black font-mono text-sm leading-relaxed text-black max-h-72 overflow-y-auto shadow-[2.5px_2.5px_0_#0A0A0A]">
              {renderHighlightedPassage()}
            </div>

            <div className="text-[11px] font-mono text-neutral-600 pt-1">
              Yellow highlight indicates verified verbatim text in captured source snapshot.
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-[#FFF4DC] border-t-2.5 border-black flex justify-end">
          <NBButton variant="yellow" size="sm" onClick={closeDrawer}>
            Close Drawer
          </NBButton>
        </div>
      </div>
    </div>
  );
}
