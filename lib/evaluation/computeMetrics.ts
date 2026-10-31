import { AuditMetrics, ClaimFinding, CriterionAssessment, Evidence } from '../types';

export function computeAuditMetrics(
  findings: ClaimFinding[] = [],
  criterionAssessments: CriterionAssessment[] = [],
  evidenceList: Evidence[] = []
): AuditMetrics {
  const totalClaims = findings.length;

  if (totalClaims === 0) {
    const totalCriteria = criterionAssessments.length;
    const coveredCount = criterionAssessments.filter(
      (c) => c.status === 'covered' || c.status === 'partially_covered'
    ).length;

    return {
      totalClaims: 0,
      supportedShare: null,
      contradictedShare: null,
      unverifiedShare: null,
      decisivelyEvaluatedShare: null,
      citationIntegrityRate: null,
      criterionCompleteness: totalCriteria > 0 ? Math.round((coveredCount / totalCriteria) * 100) / 100 : null,
    };
  }

  let supportedCount = 0;
  let contradictedCount = 0;
  let unverifiedCount = 0;

  for (const f of findings) {
    if (f.verdict === 'SUPPORTED' || f.verdict === 'PARTIALLY_SUPPORTED') {
      supportedCount++;
    } else if (f.verdict === 'CONTRADICTED') {
      contradictedCount++;
    } else if (f.verdict === 'INSUFFICIENT_EVIDENCE' || f.verdict === 'CONFLICTING_EVIDENCE') {
      unverifiedCount++;
    }
  }

  const supportedShare = Math.round((supportedCount / totalClaims) * 100) / 100;
  const contradictedShare = Math.round((contradictedCount / totalClaims) * 100) / 100;
  const unverifiedShare = Math.round((unverifiedCount / totalClaims) * 100) / 100;
  const decisivelyEvaluatedShare = Math.round(((supportedCount + contradictedCount) / totalClaims) * 100) / 100;

  // Citation integrity rate: check verified quotes
  let verifiedQuotes = 0;
  let totalQuotes = 0;
  for (const ev of evidenceList) {
    if (ev.exactQuote) {
      totalQuotes++;
      if (ev.quoteIntegrityVerified) {
        verifiedQuotes++;
      }
    }
  }
  const citationIntegrityRate =
    totalQuotes > 0 ? Math.round((verifiedQuotes / totalQuotes) * 100) / 100 : 1.0;

  // Criterion completeness
  const totalCriteria = criterionAssessments.length;
  const coveredCount = criterionAssessments.filter((c) => c.status === 'covered').length;
  const criterionCompleteness =
    totalCriteria > 0 ? Math.round((coveredCount / totalCriteria) * 100) / 100 : null;

  return {
    totalClaims,
    supportedShare,
    contradictedShare,
    unverifiedShare,
    decisivelyEvaluatedShare,
    citationIntegrityRate,
    criterionCompleteness,
  };
}
