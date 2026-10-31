import {
  Analysis,
  AnalyzeRequest,
  AuditReport,
  Mode,
  StreamEvent,
  SourceRecord,
  Evidence,
  Passage,
} from '../types';
import { processSourceInput, toSourceRecord } from '../ingest/fetchSource';
import { analyzeQuestion } from '../evaluation/analyzeQuestion';
import { planCriteria } from '../evaluation/planCriteria';
import { extractClaims } from '../evaluation/extractClaims';
import { verifyClaimsAgainstSources } from '../evaluation/verifyEvidence';
import { assessCriteriaCoverage } from '../evaluation/reconcileConflicts';
import { computeAuditMetrics } from '../evaluation/computeMetrics';
import { generateAuditChecklist } from '../evaluation/generateAuditChecklist';
import { checkFreshness } from './freshness';
import { planFacets } from './planFacets';
import { extractFactsForSource } from './extractFacts';
import { computeCoverageAndGaps } from './coverage';
import { detectConflicts } from './compare';
import { generateChecklist as generateLegacyChecklist } from './checklist';

export async function runAnalysisPipeline(
  request: AnalyzeRequest,
  onProgress?: (event: StreamEvent) => void
): Promise<Analysis> {
  const goal = (request.question || request.goal || '').trim();
  const candidateAnswer = request.answer?.trim() || undefined;
  const mode: Mode = request.mode || (candidateAnswer ? 'answer_audit' : 'research_gaps');

  const pace = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // STAGE 1: QUESTION CONTEXT ANALYSIS
  onProgress?.({
    stage: 'context',
    status: 'Analyzing inquiry context, domain risk, temporal scope, and entities...',
    progress: 15,
  });
  await pace(300);

  const questionContext = await analyzeQuestion(goal);

  // STAGE 2: QUESTION-ADAPTIVE RUBRIC & CRITERIA
  onProgress?.({
    stage: 'rubric',
    status: `Planning question-adaptive verification criteria for domain '${questionContext.domain}'...`,
    progress: 30,
    details: { domain: questionContext.domain, riskLevel: questionContext.riskLevel },
  });
  await pace(300);

  const criteria = await planCriteria(questionContext);

  // STAGE 3: INGEST & FETCH SOURCES
  const rawSources = request.sources || [];
  onProgress?.({
    stage: 'fetch',
    status: `Fetching and verifying ${rawSources.length} source records...`,
    progress: 45,
    details: { sourceCount: rawSources.length },
  });
  await pace(300);

  const sources = await Promise.all(
    rawSources.map((s, idx) => processSourceInput(s, idx))
  );

  const successfulSources = sources.filter((s) => s.fetchStatus !== 'failed');
  if (sources.length > 0 && successfulSources.length < 1) {
    throw new Error('All provided sources failed to fetch or parse. Please check your URLs or provide pasted text.');
  }

  const sourceRecords: SourceRecord[] = sources.map(toSourceRecord);
  const independentSearchUsed = false; // Flag: live external web search provider is off/offline
  const verificationNotice = independentSearchUsed
    ? 'Independently evidenced via live web retrieval'
    : 'Checked against supplied sources only';

  // BRANCH A: ANSWER AUDIT MODE (Primary)
  if (mode === 'answer_audit' && candidateAnswer) {
    // Stage 4: Atomic Claim Extraction
    onProgress?.({
      stage: 'claims',
      status: 'Extracting atomic factual propositions and identifying answer spans...',
      progress: 60,
    });
    await pace(300);

    const claims = await extractClaims(candidateAnswer, criteria, questionContext);

    // Stage 5: Verifying Claims against Evidence
    onProgress?.({
      stage: 'verify',
      status: `Testing ${claims.length} atomic claims with quote integrity & scoped entailment...`,
      progress: 75,
      details: { totalClaims: claims.length },
    });
    await pace(350);

    const findings = await verifyClaimsAgainstSources(claims, sources, questionContext);

    // Stage 6: Criteria Coverage & Freshness
    onProgress?.({
      stage: 'conflicts',
      status: 'Reconciling cross-source contradictions and evaluating criteria completeness...',
      progress: 88,
    });
    await pace(300);

    const criterionAssessments = assessCriteriaCoverage(criteria, findings, sources);
    const freshness = checkFreshness(sources);

    // Collect all matched evidence
    const allEvidence: Evidence[] = [];
    for (const f of findings) {
      allEvidence.push(...f.matchedEvidence, ...f.contradictingEvidence);
    }

    // Stage 7: Metrics & Audit Checklist
    onProgress?.({
      stage: 'metrics',
      status: 'Computing conservative claim metrics and generating actionable checklist...',
      progress: 96,
    });
    await pace(300);

    const metrics = computeAuditMetrics(findings, criterionAssessments, allEvidence);
    const auditChecklist = generateAuditChecklist(
      findings,
      claims,
      criteria,
      criterionAssessments,
      sourceRecords,
      questionContext
    );

    const limitations = [
      'Quote integrity verifies substring presence in snapshot; it is not an absolute guarantee of legal truth.',
      'Sources without verified machine-readable timestamps may reflect superseded guidelines.',
      questionContext.riskLevel === 'high'
        ? 'High-risk domain (financial / legal / eligibility): Always inspect signed departmental notifications before taking irreversible action.'
        : 'Model evaluations are fallible: items flagged for human review require independent confirmation.',
    ];

    const auditReport: AuditReport = {
      id: `AUD-${Date.now()}`,
      mode: 'answer_audit',
      createdAt: new Date().toISOString(),
      question: goal,
      candidateAnswer,
      questionContext,
      criteria,
      claims,
      findings,
      criterionAssessments,
      sources: sourceRecords,
      metrics,
      limitations,
      checklist: auditChecklist,
      independentSearchUsed,
      verificationNotice,
      facets: criteria.map((c) => ({
        id: c.id,
        name: c.question.slice(0, 40),
        question: c.question,
        criticality: c.importance,
      })),
      facts: allEvidence.map((ev, i) => ({
        id: `FCT-${i + 1}`,
        facetId: criteria[0]?.id || 'crit-1',
        sourceId: ev.sourceId,
        passageId: ev.passageId || 'P1',
        claim: ev.exactQuote || ev.passage.slice(0, 100),
        quote: ev.exactQuote || ev.passage.slice(0, 80),
        coverage: 'full',
        verified: ev.quoteIntegrityVerified,
      })),
      gaps: criterionAssessments
        .filter((a) => a.status === 'missing')
        .map((a) => ({
          id: `gap-${a.criterionId}`,
          facetId: a.criterionId,
          type: 'missing',
          severity: 'critical',
          note: a.summary,
        })),
      conflicts: findings
        .filter((f) => f.verdict === 'CONTRADICTED' || f.verdict === 'CONFLICTING_EVIDENCE')
        .map((f, i) => ({
          id: `conf-${i + 1}`,
          facetId: criteria[0]?.id || 'crit-1',
          severity: 'critical',
          reason: f.entailmentRationale,
          method: 'rule',
          a: {
            factId: `FCT-A-${i + 1}`,
            sourceId: f.matchedEvidence[0]?.sourceId || 'S1',
            passageId: f.matchedEvidence[0]?.passageId || 'P1',
            claim: claims.find((c) => c.id === f.claimId)?.normalizedProposition || 'Claim',
            quote: f.matchedEvidence[0]?.exactQuote || 'Candidate Answer Statement',
          },
          b: {
            factId: `FCT-B-${i + 1}`,
            sourceId: f.contradictingEvidence[0]?.sourceId || 'S2',
            passageId: f.contradictingEvidence[0]?.passageId || 'P1',
            claim: f.entailmentRationale,
            quote: f.contradictingEvidence[0]?.exactQuote || f.contradictingEvidence[0]?.passage.slice(0, 100) || '',
          },
        })),
      freshness,
      stats: {
        claimsVerified: findings.filter((f) => f.verdict === 'SUPPORTED').length,
        claimsRemoved: findings.filter((f) => f.verdict === 'CONTRADICTED').length,
        sourcesOk: successfulSources.length,
        sourcesFailed: sources.length - successfulSources.length,
      },
    };

    const legacyAnalysis: Analysis = {
      id: auditReport.id,
      goal,
      createdAt: auditReport.createdAt,
      sources,
      facets: auditReport.facets,
      facts: auditReport.facts,
      gaps: auditReport.gaps,
      conflicts: auditReport.conflicts,
      freshness,
      checklist: auditChecklist.map((c) => ({
        id: c.id,
        priority: c.priority.toLowerCase() as any,
        action: c.action,
        whereToVerify: c.targetSource || 'Official Issuing Portal',
        evidence: [c.id],
        label: 'rule',
        done: false,
      })),
      stats: auditReport.stats,
      mode: 'answer_audit',
      questionContext,
      criteria,
      claims,
      findings,
      criterionAssessments,
      metrics,
      auditReport,
    };

    onProgress?.({
      stage: 'done',
      status: 'Answer audit complete!',
      progress: 100,
      result: legacyAnalysis,
      auditReport,
    });

    return legacyAnalysis;
  }

  // BRANCH B: RESEARCH GAP ANALYSIS MODE (Secondary - No candidate answer)
  // Do NOT fabricate an answer just to have claims to score!
  onProgress?.({
    stage: 'facets',
    status: 'Building comparative facet matrix and information requirements...',
    progress: 50,
    details: { sourcesOk: successfulSources.length },
  });

  const facets = await planFacets(goal);

  onProgress?.({
    stage: 'extract',
    status: 'Extracting verified facts and mapping source coverage...',
    progress: 65,
  });

  let totalVerified = 0;
  let totalRemoved = 0;
  const allFacts: import('../types').Fact[] = [];

  const extractionResults = await Promise.all(
    successfulSources.map((s) => extractFactsForSource(s, facets))
  );

  for (const res of extractionResults) {
    allFacts.push(...res.verifiedFacts);
    totalVerified += res.verifiedFacts.length;
    totalRemoved += res.claimsRemovedCount;
  }

  onProgress?.({
    stage: 'conflicts',
    status: 'Mapping coverage gaps and cross-source discrepancies...',
    progress: 75,
  });

  const { gaps } = computeCoverageAndGaps(facets, sources, allFacts);
  const conflicts = await detectConflicts(facets, allFacts);

  onProgress?.({
    stage: 'freshness',
    status: 'Auditing source freshness, cycles, and publication dates...',
    progress: 85,
  });

  const freshness = checkFreshness(sources);

  onProgress?.({
    stage: 'checklist',
    status: 'Compiling prioritized research verification checklist...',
    progress: 95,
  });

  const legacyChecklist = await generateLegacyChecklist(gaps, conflicts, freshness, facets, sources);

  const criterionAssessments = criteria.map((c) => {
    const matchingFacet = facets.find((f) => f.name.toLowerCase().includes(c.id.slice(5, 10)));
    const matchingGap = gaps.find((g) => g.facetId === (matchingFacet?.id || c.id));
    const matchingFacts = allFacts.filter((f) => f.facetId === (matchingFacet?.id || c.id));

    return {
      criterionId: c.id,
      status: matchingGap ? ('missing' as const) : matchingFacts.length >= 2 ? ('covered' as const) : ('partially_covered' as const),
      summary: matchingGap
        ? matchingGap.note
        : `Covered with ${matchingFacts.length} verified excerpt(s) from ${new Set(matchingFacts.map((f) => f.sourceId)).size} source(s).`,
      evidenceCount: matchingFacts.length,
    };
  });

  const metrics = computeAuditMetrics([], criterionAssessments, []);

  const auditReport: AuditReport = {
    id: `RPT-${Date.now()}`,
    mode: 'research_gaps',
    createdAt: new Date().toISOString(),
    question: goal,
    questionContext,
    criteria,
    criterionAssessments,
    sources: sourceRecords,
    metrics,
    limitations: [
      'Checked against supplied sources only.',
      'Information gaps represent unaddressed criteria across the reviewed document set.',
      'Sources without verified publication dates may reflect archived or superseded guidelines.',
    ],
    checklist: legacyChecklist.map((c) => ({
      id: c.id,
      priority: c.priority.toUpperCase() as any,
      action: c.action,
      reason: c.label === 'sourced' ? 'Direct conflict detected in sources' : 'Information gap across reviewed sources',
      targetSource: c.whereToVerify,
      done: c.done,
    })),
    independentSearchUsed,
    verificationNotice,
    facets,
    facts: allFacts,
    gaps,
    conflicts,
    freshness,
    stats: {
      claimsVerified: totalVerified,
      claimsRemoved: totalRemoved,
      sourcesOk: successfulSources.length,
      sourcesFailed: sources.length - successfulSources.length,
    },
  };

  const analysis: Analysis = {
    id: auditReport.id,
    goal,
    createdAt: auditReport.createdAt,
    sources,
    facets,
    facts: allFacts,
    gaps,
    conflicts,
    freshness,
    checklist: legacyChecklist,
    stats: auditReport.stats,
    mode: 'research_gaps',
    questionContext,
    criteria,
    criterionAssessments,
    metrics,
    auditReport,
  };

  onProgress?.({
    stage: 'done',
    status: 'Research gap analysis complete!',
    progress: 100,
    result: analysis,
    auditReport,
  });

  return analysis;
}
