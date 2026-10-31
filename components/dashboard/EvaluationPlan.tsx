'use client';

import React from 'react';
import { Criterion, CriterionAssessment } from '@/lib/types';
import { NBCard } from '../ui/NBCard';
import { Shield, FileCheck, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface EvaluationPlanProps {
  criteria: Criterion[];
  assessments?: CriterionAssessment[];
}

export function EvaluationPlan({ criteria, assessments = [] }: EvaluationPlanProps) {
  const assessmentMap = new Map(assessments.map((a) => [a.criterionId, a]));

  const getImportanceBadge = (importance: 1 | 2 | 3) => {
    switch (importance) {
      case 1:
        return (
          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-black font-mono text-[11px] font-bold">
            Critical (P1)
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-black font-mono text-[11px] font-bold">
            High (P2)
          </span>
        );
      case 3:
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-black font-mono text-[11px] font-bold">
            Standard (P3)
          </span>
        );
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'covered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-black font-mono text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Covered
          </span>
        );
      case 'partially_covered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-black font-mono text-[11px] font-bold">
            <HelpCircle className="w-3 h-3 text-blue-700" />
            Single Source
          </span>
        );
      case 'missing':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-black font-mono text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-700" />
            Information Gap
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black font-heading text-black">Question-Adaptive Verification Rubric</h2>
        <p className="text-xs text-neutral-600 font-mono">
          Dynamic criteria derived specifically for this inquiry, expected evidence classes, and verification strategies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {criteria.map((c) => {
          const ass = assessmentMap.get(c.id);

          return (
            <NBCard
              key={c.id}
              variant="normal"
              className="bg-[#FFFDF8] p-4.5 border-2.5 border-black shadow-[3.5px_3.5px_0_#0A0A0A] flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold bg-black text-white px-1.5 py-0.5 rounded">
                      {c.id.replace('crit-', 'C-')}
                    </span>
                    {getImportanceBadge(c.importance)}
                  </div>
                  {getStatusBadge(ass?.status)}
                </div>

                <h3 className="text-sm font-black font-heading text-black leading-snug">
                  {c.question}
                </h3>
                <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                  {c.description}
                </p>
              </div>

              <div className="pt-2 border-t border-black/10 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-neutral-600">
                  <span className="font-bold">Strategy:</span>
                  <span className="uppercase text-neutral-900 font-bold bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-300">
                    {c.verificationStrategy.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-start justify-between text-neutral-600 gap-2">
                  <span className="font-bold shrink-0">Expected Evidence:</span>
                  <span className="text-right text-neutral-900 font-medium">
                    {c.expectedEvidenceType}
                  </span>
                </div>
                {ass?.summary && (
                  <div className="mt-2 p-2 rounded bg-neutral-100 border border-black/15 text-[11px] text-neutral-800">
                    <strong>Coverage Finding:</strong> {ass.summary}
                  </div>
                )}
              </div>
            </NBCard>
          );
        })}
      </div>
    </div>
  );
}
