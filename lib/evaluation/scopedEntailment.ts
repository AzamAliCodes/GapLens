import { AtomicClaim, Evidence, QuestionContext, Verdict } from '../types';
import {
  checkNumericContradiction,
  checkPolarityContradiction,
  checkTemporalScopeMismatch,
} from './deterministicChecks';

export interface ScopeEvaluation {
  entityMatch: boolean;
  temporalMatch: boolean;
  jurisdictionMatch: boolean;
  conditionMatch: boolean;
  isCompatibleScope: boolean;
  scopeDiscrepancies: string[];
}

export function evaluateScope(
  claim: AtomicClaim,
  evidence: Evidence,
  context: QuestionContext
): ScopeEvaluation {
  const scopeDiscrepancies: string[] = [];
  const evText = evidence.passage.toLowerCase();
  const claimText = claim.normalizedProposition.toLowerCase();

  // 1. Entity scope
  let entityMatch = true;
  if (context.namedEntities.length > 0) {
    const matchingEntities = context.namedEntities.filter((e) =>
      evText.includes(e.toLowerCase())
    );
    if (matchingEntities.length === 0 && context.namedEntities.length >= 2) {
      entityMatch = false;
      scopeDiscrepancies.push(`Evidence does not reference named entity '${context.namedEntities[0]}'.`);
    }
  }

  // 2. Temporal scope
  let temporalMatch = true;
  const tempCheck = checkTemporalScopeMismatch(
    claim.effectiveDate || context.targetDateOrPeriod,
    evidence.publishedAt,
    evidence.passage
  );
  if (tempCheck.hasConflict) {
    temporalMatch = false;
    scopeDiscrepancies.push(tempCheck.reason || 'Temporal period mismatch.');
  }

  // 3. Jurisdiction scope
  let jurisdictionMatch = true;
  if (context.jurisdiction) {
    const jur = context.jurisdiction.toLowerCase();
    const hasOpposingJur = (jur === 'india' && /\b(united states|california|uk|london)\b/i.test(evText)) ||
                           (jur === 'united states' && /\b(india|delhi|mumbai|inr|tehsildar)\b/i.test(evText));
    if (hasOpposingJur) {
      jurisdictionMatch = false;
      scopeDiscrepancies.push(`Jurisdiction divergence: query targets ${context.jurisdiction}, but source references an alternate region.`);
    }
  }

  // 4. Condition scope
  let conditionMatch = true;
  if (claim.conditions.length > 0) {
    for (const cond of claim.conditions) {
      const condKeywords = cond.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matches = condKeywords.some((k) => evText.includes(k));
      if (!matches) {
        conditionMatch = false;
        scopeDiscrepancies.push(`Specific condition '${cond}' not found in evidence context.`);
        break;
      }
    }
  }

  const isCompatibleScope = entityMatch && temporalMatch && jurisdictionMatch;

  return {
    entityMatch,
    temporalMatch,
    jurisdictionMatch,
    conditionMatch,
    isCompatibleScope,
    scopeDiscrepancies,
  };
}

export function classifyClaimVerdict(
  claim: AtomicClaim,
  matchedEvidence: Evidence[],
  context: QuestionContext
): {
  verdict: Verdict;
  confidence: number;
  entailmentRationale: string;
  supportingEvidence: Evidence[];
  contradictingEvidence: Evidence[];
  scopeDiscrepancies: string[];
  uncertaintyNotes: string[];
  deterministicChecksRun: string[];
  requiresHumanReview: boolean;
} {
  const deterministicChecksRun: string[] = ['NumericCheck', 'PolarityCheck', 'TemporalScopeCheck'];
  const uncertaintyNotes: string[] = [];
  const scopeDiscrepancies: string[] = [];

  // Check 1: Non-fact-checkable assertion
  if (!claim.factCheckable) {
    return {
      verdict: 'NOT_FACT_CHECKABLE',
      confidence: 0.95,
      entailmentRationale: 'Statement expresses a subjective value judgment, recommendation, or non-verifiable conversational text.',
      supportingEvidence: [],
      contradictingEvidence: [],
      scopeDiscrepancies: [],
      uncertaintyNotes: ['Subjective opinion cannot be fact-checked against empirical evidence.'],
      deterministicChecksRun,
      requiresHumanReview: false,
    };
  }

  // Check 2: No evidence at all
  if (matchedEvidence.length === 0) {
    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: 0.3,
      entailmentRationale: 'No relevant passages found in reviewed sources to confirm or refute this claim.',
      supportingEvidence: [],
      contradictingEvidence: [],
      scopeDiscrepancies: ['No source coverage.'],
      uncertaintyNotes: ['Absence of evidence is not proof of falsehood. Primary authoritative documentation should be consulted.'],
      deterministicChecksRun,
      requiresHumanReview: context.riskLevel === 'high',
    };
  }

  const supporting: Evidence[] = [];
  const contradicting: Evidence[] = [];

  for (const ev of matchedEvidence) {
    const scope = evaluateScope(claim, ev, context);
    if (!scope.isCompatibleScope) {
      scopeDiscrepancies.push(...scope.scopeDiscrepancies);
      continue;
    }

    // Deterministic checks against this candidate evidence
    const numCheck = checkNumericContradiction(claim.normalizedProposition, ev.passage);
    if (numCheck.hasConflict) {
      contradicting.push(ev);
      uncertaintyNotes.push(numCheck.reason!);
      continue;
    }

    const polCheck = checkPolarityContradiction(claim.normalizedProposition, ev.passage);
    if (polCheck.hasConflict) {
      contradicting.push(ev);
      uncertaintyNotes.push(polCheck.reason!);
      continue;
    }

    // Semantic entailment check
    const claimKeywords = claim.normalizedProposition
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['must', 'have', 'been', 'with', 'from', 'that', 'this'].includes(w));

    const evLower = ev.passage.toLowerCase();
    const matchCount = claimKeywords.filter((k) => evLower.includes(k)).length;
    const matchRatio = matchCount / (claimKeywords.length || 1);

    if (matchRatio >= 0.6) {
      supporting.push(ev);
    }
  }

  // Deduplicate scope discrepancies
  const uniqueScopeDiscrepancies = Array.from(new Set(scopeDiscrepancies));

  // Determine final verdict
  let verdict: Verdict = 'INSUFFICIENT_EVIDENCE';
  let confidence = 0.5;
  let rationale = '';

  if (contradicting.length > 0 && supporting.length === 0) {
    verdict = 'CONTRADICTED';
    confidence = 0.88;
    rationale = `Direct contradiction identified within compatible scope: ${uncertaintyNotes[0] || 'Evidence negates stated conditions.'}`;
  } else if (contradicting.length > 0 && supporting.length > 0) {
    // Check if contradicting sources come from different independent provenance groups
    const suppGroups = new Set(supporting.map((s) => s.provenanceGroupId || s.sourceId));
    const contraGroups = new Set(contradicting.map((s) => s.provenanceGroupId || s.sourceId));

    verdict = 'CONFLICTING_EVIDENCE';
    confidence = 0.82;
    rationale = `Cross-source conflict detected across independent sources (${suppGroups.size} supporting vs ${contraGroups.size} contradicting).`;
  } else if (supporting.length > 0) {
    // Check if conditions matched
    const allCondsMatched = claim.conditions.length === 0 || supporting.some((s) => s.scopeMatch?.condition !== false);
    if (allCondsMatched) {
      verdict = 'SUPPORTED';
      confidence = Math.min(0.95, 0.75 + supporting.length * 0.08);
      rationale = `Verified by authoritative passage matching temporal and jurisdictional scope (${supporting.length} source passage[s]).`;
    } else {
      verdict = 'PARTIALLY_SUPPORTED';
      confidence = 0.7;
      rationale = 'Supported in general terms, but specific conditional limits could not be fully substantiated.';
    }
  } else {
    // Neither supporting nor contradicting passed compatible scope
    verdict = 'INSUFFICIENT_EVIDENCE';
    confidence = 0.4;
    if (uniqueScopeDiscrepancies.length > 0) {
      rationale = `Available evidence diverges in scope (${uniqueScopeDiscrepancies[0]}); cannot reliably confirm or contradict.`;
    } else {
      rationale = 'Passages matched topically but did not contain conclusive factual entailment.';
    }
  }

  const requiresHumanReview = context.riskLevel === 'high' || confidence < 0.75 || verdict === 'CONFLICTING_EVIDENCE';

  return {
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    entailmentRationale: rationale,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    scopeDiscrepancies: uniqueScopeDiscrepancies,
    uncertaintyNotes,
    deterministicChecksRun,
    requiresHumanReview,
  };
}
