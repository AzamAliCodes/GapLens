import React from 'react';
import { Source } from '@/lib/types';
import { useGapLensStore } from '@/lib/store';
import { NBCard } from '../ui/NBCard';
import { NBBadge } from '../ui/NBBadge';
import { NBButton } from '../ui/NBButton';
import { ExternalLink, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SourcesOverviewProps {
  sources: Source[];
}

export function SourcesOverview({ sources }: SourcesOverviewProps) {
  const openDrawer = useGapLensStore(s => s.openDrawer);

  const handleInspectPassages = (source: Source) => {
    openDrawer({
      source,
      passage: source.passages[0],
      claim: `Overview of ${source.title} (${source.passages.length} passages extracted)`,
      quote: source.passages[0]?.text?.slice(0, 100),
      trustLabel: source.kind === 'official' ? 'sourced' : 'uncertain',
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sources.map(source => {
        const isFailed = source.fetchStatus === 'failed';
        const totalWords = source.passages.reduce((sum, p) => sum + (p.wordCount || 0), 0);

        return (
          <NBCard
            key={source.id}
            variant="normal"
            className="flex flex-col justify-between space-y-4 bg-[#FFFDF8] p-5 border-2.5 border-black shadow-[4px_4px_0_#0A0A0A]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b-2 border-black/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[var(--yellow)] border-2 border-black text-xs font-mono font-black shadow-[1.5px_1.5px_0_#0A0A0A]">
                    {source.id}
                  </span>
                  <NBBadge label={source.kind} variant="source" />
                </div>
                {isFailed ? (
                  <span className="text-xs font-mono font-black text-white bg-[var(--red)] px-2 py-0.5 rounded border border-black flex items-center gap-1 shadow-[1px_1px_0_#0A0A0A]">
                    <AlertCircle className="w-3 h-3" />
                    FAILED
                  </span>
                ) : (
                  <span className="text-xs font-mono font-black text-black bg-[var(--green)] px-2 py-0.5 rounded border border-black flex items-center gap-1 shadow-[1px_1px_0_#0A0A0A]">
                    <CheckCircle2 className="w-3 h-3" />
                    EXTRACTED
                  </span>
                )}
              </div>

              <div>
                <h4 className="font-heading font-black text-base text-black line-clamp-1" title={source.title}>
                  {source.title}
                </h4>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 hover:underline break-all mt-1 font-semibold"
                  >
                    <span>{source.url}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-neutral-600 font-mono italic">Pasted text document</span>
                )}
              </div>

              {isFailed ? (
                <div className="p-3 bg-[var(--red-light)] rounded-xl border-2 border-black text-xs font-bold text-red-950">
                  <strong>Error:</strong> {source.error}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFF9EC] p-3 rounded-xl border-2 border-black shadow-[2px_2px_0_#0A0A0A]">
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-mono font-bold uppercase">Passages:</span>
                    <strong className="text-black font-mono font-bold text-sm">{source.passages.length} segments</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px] font-mono font-bold uppercase">Word Count:</span>
                    <strong className="text-black font-mono font-bold text-sm">~{totalWords} words</strong>
                  </div>
                  {source.publishedAt && (
                    <div className="col-span-2 pt-1 border-t border-black/15 text-[11px] font-mono text-neutral-700">
                      <span>Date: </span>
                      <strong className="text-black">{new Date(source.publishedAt).toLocaleDateString()}</strong>
                    </div>
                  )}
                  {source.contentHash && (
                    <div className="col-span-2 pt-1 border-t border-black/15 text-[10px] font-mono text-neutral-600 truncate">
                      <span>SHA-256 Hash: </span>
                      <code className="text-black bg-white px-1 border border-neutral-300 rounded">{source.contentHash}</code>
                    </div>
                  )}
                  {source.provenanceGroupId && (
                    <div className="col-span-2 text-[10px] font-mono text-neutral-600 truncate">
                      <span>Provenance Group: </span>
                      <code className="text-black bg-white px-1 border border-neutral-300 rounded">{source.provenanceGroupId}</code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isFailed && source.passages.length > 0 && (
              <div className="pt-2 border-t-2 border-black/15 flex justify-end">
                <NBButton
                  variant="white"
                  size="sm"
                  onClick={() => handleInspectPassages(source)}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Passages</span>
                </NBButton>
              </div>
            )}
          </NBCard>
        );
      })}
    </div>
  );
}
