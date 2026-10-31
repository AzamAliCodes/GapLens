'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGapLensStore } from '@/lib/store';
import { Analysis, PipelineStage, StreamEvent } from '@/lib/types';
import {
  exportAuditReportMarkdown,
  exportAuditReportJSON,
  exportChecklistMarkdown,
  exportFullReportMarkdown,
  downloadFile,
} from '@/lib/export';
import { NBButton } from '@/components/ui/NBButton';
import { NBCard } from '@/components/ui/NBCard';
import { StatTile } from '@/components/ui/StatTile';
import { Logo } from '@/components/ui/Logo';
import { NBStepper } from '@/components/dashboard/NBStepper';
import { CoverageMatrix } from '@/components/dashboard/CoverageMatrix';
import { GapCard } from '@/components/dashboard/GapCard';
import { ConflictCard } from '@/components/dashboard/ConflictCard';
import { FreshnessRow } from '@/components/dashboard/FreshnessRow';
import { ChecklistItemRow } from '@/components/dashboard/ChecklistItemRow';
import { SourcesOverview } from '@/components/dashboard/SourcesOverview';
import { EvidenceDrawer } from '@/components/dashboard/EvidenceDrawer';
import { ClaimLedger } from '@/components/dashboard/ClaimLedger';
import { EvaluationPlan } from '@/components/dashboard/EvaluationPlan';
import { MetricPanel } from '@/components/dashboard/MetricPanel';
import {
  Grid,
  AlertTriangle,
  Swords,
  Clock,
  CheckSquare,
  FileText,
  Download,
  Copy,
  ArrowLeft,
  ShieldCheck,
  Check,
  Scale,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AnalyzeDashboardPage() {
  const router = useRouter();
  const { currentAnalysis, setCurrentAnalysis, isAnalyzing, setIsAnalyzing } = useGapLensStore();

  const [stage, setStage] = useState<PipelineStage>('context');
  const [statusText, setStatusText] = useState('Verifying evidence...');
  const [progress, setProgress] = useState(10);
  const [errorText, setErrorText] = useState<string | null>(null);

  const isAuditMode =
    currentAnalysis?.mode === 'answer_audit' ||
    Boolean(currentAnalysis?.claims && currentAnalysis.claims.length > 0);

  const [activeTab, setActiveTab] = useState<string>(isAuditMode ? 'claims' : 'coverage');
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const streamStartedRef = useRef(false);

  useEffect(() => {
    if (currentAnalysis) {
      if (currentAnalysis.mode === 'answer_audit' || (currentAnalysis.claims && currentAnalysis.claims.length > 0)) {
        setActiveTab('claims');
      } else {
        setActiveTab('coverage');
      }
    }
  }, [currentAnalysis?.id, currentAnalysis?.mode]);

  useEffect(() => {
    if (streamStartedRef.current) return;

    const pendingJson = sessionStorage.getItem('gaplens_pending_run');
    if (!pendingJson) {
      if (!currentAnalysis && !isAnalyzing) {
        router.push('/');
      }
      return;
    }

    streamStartedRef.current = true;
    sessionStorage.removeItem('gaplens_pending_run');
    setIsAnalyzing(true);
    setErrorText(null);

    const runStream = async () => {
      try {
        const payload = JSON.parse(pendingJson);
        console.log('[AnalyzePage] Sending request to /api/analyze:', payload.goal || payload.question);
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('[AnalyzePage] /api/analyze status:', res.status, res.statusText);

        if (!res.ok) {
          let errorDetail = '';
          try {
            const raw = await res.text();
            try {
              const errJson = JSON.parse(raw);
              errorDetail = errJson.error || errJson.message || '';
            } catch {
              if (raw && raw.length < 300) {
                errorDetail = raw.trim();
              }
            }
          } catch {
            // Ignore response read error
          }

          const fallback = res.status === 500
            ? 'The server encountered an internal error while processing the analysis. Please verify your source inputs or try again.'
            : `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`;

          throw new Error(errorDetail || fallback);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('ReadableStream not supported by browser');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event: StreamEvent = JSON.parse(line);
              if (event.stage) setStage(event.stage);
              if (event.status) setStatusText(event.status);
              if (typeof event.progress === 'number') setProgress(event.progress);

              if (event.stage === 'error') {
                setErrorText(event.error || 'Pipeline error encountered');
              }

              if (event.stage === 'done') {
                const finalResult = event.result;
                if (finalResult) {
                  if (event.auditReport) {
                    finalResult.auditReport = event.auditReport;
                    finalResult.mode = event.auditReport.mode;
                    finalResult.claims = event.auditReport.claims;
                    finalResult.findings = event.auditReport.findings;
                    finalResult.criteria = event.auditReport.criteria;
                    finalResult.criterionAssessments = event.auditReport.criterionAssessments;
                    finalResult.metrics = event.auditReport.metrics;
                    finalResult.questionContext = event.auditReport.questionContext;
                  }
                  console.log('[AnalyzePage] Stage done received! Setting analysis and unsetting isAnalyzing.');
                  setCurrentAnalysis(finalResult);
                  setIsAnalyzing(false);
                }
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AnalyzePage] Stream error:', msg);
        setErrorText(msg);
      } finally {
        setIsAnalyzing(false);
      }
    };

    runStream();
  }, [router, setCurrentAnalysis, setIsAnalyzing, currentAnalysis]);

  const handleCopyChecklist = () => {
    if (!currentAnalysis) return;
    const md = exportChecklistMarkdown(currentAnalysis);
    navigator.clipboard.writeText(md);
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2500);
  };

  const handleDownloadReport = () => {
    if (!currentAnalysis) return;
    if (currentAnalysis.auditReport) {
      const md = exportAuditReportMarkdown(currentAnalysis.auditReport);
      downloadFile(md, `gaplens-audit-${Date.now()}.md`);
    } else {
      const md = exportFullReportMarkdown(currentAnalysis);
      downloadFile(md, `gaplens-report-${Date.now()}.md`);
    }
  };

  const handleDownloadJSON = () => {
    if (!currentAnalysis) return;
    if (currentAnalysis.auditReport) {
      const jsonStr = exportAuditReportJSON(currentAnalysis.auditReport);
      downloadFile(jsonStr, `gaplens-data-${Date.now()}.json`, 'application/json');
    } else {
      const jsonStr = JSON.stringify(currentAnalysis, null, 2);
      downloadFile(jsonStr, `gaplens-data-${Date.now()}.json`, 'application/json');
    }
  };

  // Loading View
  if (isAnalyzing) {
    return (
      <div className="flex-1 flex flex-col justify-between">
        <header className="w-full bg-[#FFFDF8] border-b-2.5 border-black sticky top-0 z-30 shadow-[0_2px_0_0_#0A0A0A]">
          <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <Logo size="md" subtitle="Live Verification" />
            <span className="text-xs font-mono font-bold bg-[var(--yellow)] px-2.5 py-1 rounded-md border-2 border-black shadow-[1.5px_1.5px_0_#0A0A0A]">
              Verifying...
            </span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-16 w-full">
          <NBStepper currentStage={stage} statusText={statusText} progress={progress} />
          {errorText && (
            <div className="mt-6 p-4 rounded-xl bg-[var(--red-light)] border-2 border-black text-xs font-mono text-red-950 space-y-2">
              <strong className="block text-sm font-black">Analysis Issue:</strong>
              <p>{errorText}</p>
              <div className="pt-2">
                <NBButton variant="yellow" size="sm" onClick={() => router.push('/')}>
                  Return Home
                </NBButton>
              </div>
            </div>
          )}
        </main>

        <footer className="w-full border-t border-black bg-[#FFFDF8] py-3 px-4 text-center text-xs font-mono text-neutral-500">
          GapLens Verification
        </footer>
      </div>
    );
  }

  // Error fallback
  if (!currentAnalysis) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <NBCard variant="normal" className="max-w-md w-full space-y-4 text-center bg-[#FFFDF8] p-6 border-2 border-black shadow-[4px_4px_0_#0A0A0A]">
          <h2 className="text-lg font-black text-black">No Active Analysis</h2>
          <p className="text-xs text-neutral-600 font-mono">
            {errorText || 'Please specify an inquiry to analyze.'}
          </p>
          <NBButton variant="yellow" size="md" onClick={() => router.push('/')}>
            Start New
          </NBButton>
        </NBCard>
      </div>
    );
  }

  const {
    goal,
    stats,
    gaps,
    conflicts,
    freshness,
    checklist,
    facets,
    sources,
    mode,
    claims = [],
    findings = [],
    criteria = [],
    criterionAssessments = [],
    metrics,
    auditReport,
  } = currentAnalysis;

  const isAudit = mode === 'answer_audit' || claims.length > 0;
  const candidateAnswer = auditReport?.candidateAnswer;
  const supportedCount = findings.filter((f) => f.verdict === 'SUPPORTED').length;
  const contradictedCount = findings.filter((f) => f.verdict === 'CONTRADICTED').length;
  const unverifiedCount = findings.filter((f) => f.verdict === 'INSUFFICIENT_EVIDENCE').length;

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Consistent Neo-brutalist Header */}
      <header className="w-full bg-[#FFFDF8] border-b-2.5 border-black sticky top-0 z-30 shadow-[0_2px_0_0_#0A0A0A]">
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="md" />
            <div className="h-5 w-px bg-neutral-300 hidden sm:block shrink-0"></div>
            <button
              onClick={() => router.push('/')}
              className="px-2.5 py-1.5 rounded-lg border-2 border-black bg-[var(--yellow)] hover:bg-[var(--yellow-hover)] font-bold text-xs text-black transition-all cursor-pointer shadow-[1.5px_1.5px_0_#0A0A0A] flex items-center gap-1.5 shrink-0"
              title="Return to Home"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>New Inquiry</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NBButton variant="white" size="sm" onClick={handleCopyChecklist} className="text-xs font-bold">
              {copiedChecklist ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedChecklist ? 'Copied' : 'Copy List'}</span>
            </NBButton>
            <NBButton variant="yellow" size="sm" onClick={handleDownloadReport} className="text-xs font-bold">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </NBButton>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-5">
        {/* Unified Clean Header Card */}
        <NBCard variant="normal" className="bg-[#FFFDF8] p-5 border-2 border-black shadow-[3px_3px_0_#0A0A0A] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-black">
              Checked against supplied sources only
            </span>
            <span className="text-[11px] font-mono text-neutral-500 font-bold">
              {isAudit ? 'Answer Audit' : 'Research Gaps'}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-black font-heading text-black leading-snug">
            {goal}
          </h1>

          {/* Optional Collapsible Answer View */}
          {candidateAnswer && (
            <div className="pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setShowAnswer(!showAnswer)}
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-700 hover:text-black cursor-pointer"
              >
                <span>{showAnswer ? 'Hide Audited Answer' : 'View Audited Answer'}</span>
                {showAnswer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showAnswer && (
                <div className="mt-2 p-3 rounded-lg bg-amber-50/70 border border-black/20 text-xs font-mono text-black leading-relaxed">
                  {candidateAnswer}
                </div>
              )}
            </div>
          )}
        </NBCard>

        {/* 4 Clean Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isAudit ? (
            <>
              <StatTile
                label="Supported"
                value={supportedCount}
                subtext="Entailed by proof"
                variant="green"
              />
              <StatTile
                label="Contradicted"
                value={contradictedCount}
                subtext="Scope conflicts"
                variant="red"
              />
              <StatTile
                label="Unverified"
                value={unverifiedCount}
                subtext="Missing in sources"
                variant="orange"
              />
              <StatTile
                label="Quote Match"
                value={metrics?.citationIntegrityRate !== null && metrics?.citationIntegrityRate !== undefined ? `${(metrics.citationIntegrityRate * 100).toFixed(0)}%` : '100%'}
                subtext="Verbatim accuracy"
                variant="blue"
              />
            </>
          ) : (
            <>
              <StatTile
                label="Information Gaps"
                value={gaps.length}
                subtext="Uncovered topics"
                variant="red"
              />
              <StatTile
                label="Contradictions"
                value={conflicts.length}
                subtext="Source conflicts"
                variant="orange"
              />
              <StatTile
                label="Date Warnings"
                value={freshness.length}
                subtext="Older or undated"
                variant="yellow"
              />
              <StatTile
                label="Verified Facts"
                value={stats.claimsVerified}
                subtext="Authentic excerpts"
                variant="green"
              />
            </>
          )}
        </div>

        {/* 4 Clean, Focused Tabs */}
        <div className="space-y-4">
          <div className="flex p-1 bg-[#FFF4DC] border-2 border-black rounded-xl shadow-[2px_2px_0_#0A0A0A] gap-1 overflow-x-auto no-scrollbar">
            {isAudit ? (
              <>
                <button
                  onClick={() => setActiveTab('claims')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'claims'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Claims ({claims.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'checklist'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Next Steps ({checklist.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('quality')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'quality'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Rubric & Quality</span>
                </button>

                <button
                  onClick={() => setActiveTab('sources')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'sources'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Sources ({sources.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('coverage')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'coverage'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Coverage & Gaps</span>
                </button>

                <button
                  onClick={() => setActiveTab('conflicts')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'conflicts'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Discrepancies ({conflicts.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'checklist'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Next Steps ({checklist.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('sources')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'sources'
                      ? 'bg-white text-black border border-black shadow-[1px_1px_0_#0A0A0A]'
                      : 'text-neutral-600 hover:text-black border border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Sources ({sources.length})</span>
                </button>
              </>
            )}
          </div>

          {/* TAB 1: CLAIMS (Audit Mode) */}
          {activeTab === 'claims' && isAudit && (
            <ClaimLedger claims={claims} findings={findings} sources={sources} />
          )}

          {/* TAB 1: COVERAGE & GAPS (Research Mode) */}
          {activeTab === 'coverage' && !isAudit && (
            <div className="space-y-4">
              <CoverageMatrix analysis={currentAnalysis} />
              {gaps.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <h3 className="text-sm font-black font-heading text-black">Unaddressed Information Dark Spots</h3>
                  {gaps.map((gap) => (
                    <GapCard key={gap.id} gap={gap} facet={facets.find((f) => f.id === gap.facetId)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DISCREPANCIES (Research Mode) */}
          {activeTab === 'conflicts' && !isAudit && (
            <div className="space-y-4">
              {conflicts.length === 0 && freshness.length === 0 ? (
                <NBCard className="text-center p-6 bg-[#FFFDF8] text-xs text-neutral-600 font-mono">
                  No cross-source contradictions or date warnings found.
                </NBCard>
              ) : (
                <>
                  {conflicts.map((c) => (
                    <ConflictCard key={c.id} conflict={c} facet={facets.find((f) => f.id === c.facetId)} sources={sources} />
                  ))}
                  {freshness.map((f) => (
                    <FreshnessRow key={f.id} flag={f} source={sources.find((s) => s.id === f.sourceId)} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* TAB 2 / 3: ACTION CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-600 font-mono">
                <span>Prioritized verification actions</span>
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  className="text-blue-700 hover:underline font-bold cursor-pointer"
                >
                  Download JSON
                </button>
              </div>

              <div className="space-y-2.5">
                {checklist.map((item) => (
                  <ChecklistItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUALITY & RUBRIC (Audit Mode) */}
          {activeTab === 'quality' && isAudit && (
            <div className="space-y-5">
              {metrics && (
                <MetricPanel
                  metrics={metrics}
                  mode="answer_audit"
                  verificationNotice="Checked against supplied sources only"
                />
              )}
              <EvaluationPlan criteria={criteria} assessments={criterionAssessments} />
            </div>
          )}

          {/* TAB 4: SOURCES */}
          {activeTab === 'sources' && (
            <SourcesOverview sources={sources} />
          )}
        </div>
      </main>

      {/* Slide-in Evidence Drawer */}
      <EvidenceDrawer />

      {/* Footer */}
      <footer className="w-full border-t border-black bg-[#FFFDF8] py-3 px-4 mt-8 text-center text-xs font-mono text-neutral-500">
        GapLens — Verbatim Excerpt Verification & Provenance
      </footer>
    </div>
  );
}
