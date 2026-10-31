'use client';

import React from 'react';
import { AuditMetrics } from '@/lib/types';
import { StatTile } from '../ui/StatTile';
import { NBCard } from '../ui/NBCard';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Percent,
  Layers,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';

interface MetricPanelProps {
  metrics: AuditMetrics;
  mode: 'answer_audit' | 'research_gaps';
  verificationNotice: string;
}

export function MetricPanel({ metrics, mode, verificationNotice }: MetricPanelProps) {
  const formatRate = (val?: number | null) => {
    if (val === null || val === undefined) return 'N/A';
    return `${(val * 100).toFixed(0)}%`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black font-heading text-black">Verification Metric Panel</h2>
          <p className="text-xs text-neutral-600 font-mono">
            Empirical entailment and coverage shares calculated across audited items.
          </p>
        </div>
        <span className="text-xs font-mono font-bold bg-neutral-100 px-2.5 py-1 rounded border border-black">
          {verificationNotice}
        </span>
      </div>

      {mode === 'answer_audit' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile
            label="Total Claims"
            value={metrics.totalClaims ?? 0}
            subtext="Extracted"
            variant="yellow"
          />
          <StatTile
            label="Supported"
            value={formatRate(metrics.supportedShare)}
            subtext="Entailed"
            variant="green"
          />
          <StatTile
            label="Contradicted"
            value={formatRate(metrics.contradictedShare)}
            subtext="Conflict"
            variant="red"
          />
          <StatTile
            label="Unverified"
            value={formatRate(metrics.unverifiedShare)}
            subtext="Lacks proof"
            variant="orange"
          />
          <StatTile
            label="Quote Match"
            value={formatRate(metrics.citationIntegrityRate)}
            subtext="Substring verified"
            variant="blue"
          />
          <StatTile
            label="Completeness"
            value={formatRate(metrics.criterionCompleteness)}
            subtext="Rubric covered"
            variant="green"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile
            label="Rubric Completeness"
            value={formatRate(metrics.criterionCompleteness)}
            subtext="Criteria covered"
            variant="green"
          />
          <StatTile
            label="Quote Integrity"
            value={formatRate(metrics.citationIntegrityRate)}
            subtext="Exact quotes verified"
            variant="blue"
          />
          <StatTile
            label="Verification Notice"
            value="Offline"
            subtext="Supplied sources only"
            variant="yellow"
          />
        </div>
      )}

      {/* Trust & Methodology Disclaimer */}
      <NBCard
        variant="normal"
        accent="yellow"
        className="p-4 border-2 border-black text-xs font-mono text-neutral-900 space-y-1.5 shadow-[2.5px_2.5px_0_#0A0A0A] bg-[#FFFDF8]"
      >
        <div className="flex items-center gap-2 font-bold text-black">
          <AlertOctagon className="w-4 h-4 text-black shrink-0" />
          <span>Verification Methodology & Boundaries:</span>
        </div>
        <p className="leading-relaxed">
          - <strong>Quote integrity ≠ truth:</strong> Exact substring verification confirms verbatim presence in captured snapshots, not objective legality.
          <br />
          - <strong>No evidence ≠ false:</strong> Missing evidence indicates an unverified proposition (<code>INSUFFICIENT_EVIDENCE</code>), never an assumed falsehood.
          <br />
          - <strong>Conservative scope matching:</strong> Rules from older cycles (e.g. 2024 vs 2026) are temporal discrepancies, not direct contradictions.
        </p>
      </NBCard>
    </div>
  );
}
