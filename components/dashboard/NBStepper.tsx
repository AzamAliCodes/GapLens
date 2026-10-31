import React from 'react';
import { PipelineStage } from '@/lib/types';
import { NBCard } from '../ui/NBCard';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface NBStepperProps {
  currentStage: PipelineStage;
  statusText: string;
  progress: number;
}

const STEPPER_GROUPS = [
  {
    id: 'step-1',
    keys: ['context', 'rubric'],
    label: '1. Rubric & Context Planning',
    desc: 'Analyzing inquiry context, domain risk, and adaptive criteria',
  },
  {
    id: 'step-2',
    keys: ['fetch'],
    label: '2. Source Ingestion & Hashing',
    desc: 'Capturing document snapshots and computing SHA-256 hashes',
  },
  {
    id: 'step-3',
    keys: ['claims', 'facets'],
    label: '3. Atomic Claim Extraction',
    desc: 'Decomposing answer into falsifiable proposition spans',
  },
  {
    id: 'step-4',
    keys: ['verify', 'extract'],
    label: '4. Verbatim Quote Verification',
    desc: 'Proving exact substring offsets and testing scoped entailment',
  },
  {
    id: 'step-5',
    keys: ['conflicts', 'freshness'],
    label: '5. Cross-Source Reconciliation',
    desc: 'Spotting direct contradictions, temporal conflicts, and dark spots',
  },
  {
    id: 'step-6',
    keys: ['metrics', 'checklist', 'done'],
    label: '6. Quality Metrics & Action Plan',
    desc: 'Calculating conservative precision scores and action checklist',
  },
];

export function NBStepper({ currentStage, statusText, progress }: NBStepperProps) {
  const allOrder: PipelineStage[] = [
    'context',
    'rubric',
    'fetch',
    'facets',
    'claims',
    'extract',
    'verify',
    'conflicts',
    'freshness',
    'metrics',
    'checklist',
    'done',
  ];

  const currentIdx = allOrder.indexOf(currentStage);

  const getGroupStatus = (groupKeys: string[]) => {
    if (currentStage === 'done' || progress >= 100) return 'completed';
    const groupIndices = groupKeys.map((k) => allOrder.indexOf(k as PipelineStage)).filter((i) => i !== -1);
    const minGroupIdx = Math.min(...groupIndices);
    const maxGroupIdx = Math.max(...groupIndices);

    if (groupKeys.includes(currentStage)) {
      return 'active';
    }
    if (currentIdx > maxGroupIdx) {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <NBCard variant="lg" className="w-full max-w-2xl mx-auto space-y-6 bg-white p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/10 pb-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-[var(--yellow)] border border-black text-xs font-mono font-bold uppercase">
            LIVE ANALYSIS
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-black mt-1">
            Analyzing Your Sources
          </h2>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black font-heading text-black">{progress}%</span>
          <span className="text-[10px] font-mono block text-neutral-400 uppercase">Progress</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-neutral-100 rounded-full border border-neutral-300 overflow-hidden relative">
        <div
          className="h-full bg-[var(--yellow)] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Live Status Text */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-800">
        <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
        <span className="font-medium">{statusText || 'Executing analysis pipeline...'}</span>
      </div>

      {/* Stepper Stages List */}
      <div className="space-y-2 pt-1">
        {STEPPER_GROUPS.map((group) => {
          const status = getGroupStatus(group.keys);

          return (
            <div
              key={group.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                status === 'active'
                  ? 'bg-amber-50/70 border-black shadow-xs'
                  : status === 'completed'
                  ? 'bg-emerald-50/40 border-emerald-200 text-neutral-700'
                  : 'bg-white border-neutral-200 text-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : status === 'active' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-neutral-300 shrink-0" />
                )}
                <div>
                  <h4 className={`text-sm font-bold font-heading ${status === 'pending' ? 'text-neutral-400' : 'text-black'}`}>
                    {group.label}
                  </h4>
                  <p className="text-xs text-neutral-500 hidden sm:block">
                    {group.desc}
                  </p>
                </div>
              </div>

              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : status === 'active'
                  ? 'bg-[var(--yellow)] text-black border-black'
                  : 'bg-neutral-100 text-neutral-400 border-neutral-300'
              }`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </NBCard>
  );
}
