import {
  AtomicClaim,
  AuditChecklistItem,
  ClaimFinding,
  Criterion,
  CriterionAssessment,
  QuestionContext,
  SourceRecord,
} from '../types';

export function generateAuditChecklist(
  findings: ClaimFinding[] = [],
  claims: AtomicClaim[] = [],
  criteria: Criterion[] = [],
  assessments: CriterionAssessment[] = [],
  sources: SourceRecord[] = [],
  context: QuestionContext
): AuditChecklistItem[] {
  const items: AuditChecklistItem[] = [];
  const claimMap = new Map(claims.map((c) => [c.id, c]));
  const critMap = new Map(criteria.map((c) => [c.id, c]));

  // 1. Contradictions & Conflicts (CRITICAL)
  for (const f of findings) {
    if (f.verdict === 'CONTRADICTED') {
      const clm = claimMap.get(f.claimId);
      const span = clm?.exactAnswerSpan ? `"${clm.exactAnswerSpan.slice(0, 60)}..."` : `Claim ${f.claimId}`;
      items.push({
        id: `chk-contra-${f.claimId}`,
        priority: 'CRITICAL',
        action: `Resolve factual contradiction on ${span}. Verify correct requirement on official issuing portal.`,
        reason: f.entailmentRationale || 'Direct contradiction with verified source passage.',
        targetSource: f.contradictingEvidence[0]?.url || 'Official Department Notice',
        suggestedQuery: `${context.namedEntities[0] || context.domain} official guidelines ${context.targetDateOrPeriod || ''}`,
      });
    } else if (f.verdict === 'CONFLICTING_EVIDENCE') {
      const clm = claimMap.get(f.claimId);
      items.push({
        id: `chk-conflict-${f.claimId}`,
        priority: 'CRITICAL',
        action: `Reconcile conflicting requirements between sources for "${clm?.normalizedProposition.slice(0, 60)}...".`,
        reason: f.entailmentRationale || 'Independent sources assert opposing rules.',
        targetSource: 'Official Helpdesk or signed Gazette copy',
      });
    }
  }

  // 2. High-risk Insufficient Evidence (HIGH)
  for (const f of findings) {
    if (f.verdict === 'INSUFFICIENT_EVIDENCE' && (f.requiresHumanReview || context.riskLevel === 'high')) {
      const clm = claimMap.get(f.claimId);
      items.push({
        id: `chk-unverified-${f.claimId}`,
        priority: 'HIGH',
        action: `Obtain official confirmation for unverified claim: "${clm?.normalizedProposition.slice(0, 70)}...".`,
        reason: 'No evidence found in captured sources. Crucial eligibility/statutory requirement must not be assumed.',
        suggestedQuery: `${context.namedEntities[0] || ''} ${clm?.normalizedProposition.slice(0, 40)}`,
      });
    }
  }

  // 3. Missing Critical Criteria / Gaps (HIGH / MEDIUM)
  for (const ass of assessments) {
    if (ass.status === 'missing') {
      const crit = critMap.get(ass.criterionId);
      if (crit) {
        items.push({
          id: `chk-gap-${crit.id}`,
          priority: crit.importance === 1 ? 'CRITICAL' : 'HIGH',
          action: `Verify unaddressed core criterion: ${crit.question}`,
          reason: `Complete information dark spot: ${crit.description}`,
          targetSource: crit.expectedEvidenceType,
          suggestedQuery: `${context.namedEntities[0] || context.domain} ${crit.question.slice(0, 50)}`,
        });
      }
    }
  }

  // 4. Staleness / Earlier Cycle Flags (MEDIUM / LOW)
  for (const src of sources) {
    if (src.publishedAt && context.targetDateOrPeriod) {
      const targetYear = context.targetDateOrPeriod.match(/\b(202[0-9]|203[0-9])\b/)?.[1];
      const srcYear = src.publishedAt.match(/\b(202[0-9]|203[0-9])\b/)?.[1];
      if (targetYear && srcYear && parseInt(srcYear) < parseInt(targetYear)) {
        items.push({
          id: `chk-stale-${src.id}`,
          priority: 'MEDIUM',
          action: `Discard superseded guidelines from Source ${src.id} (${src.title || src.domain}); check active ${targetYear} cycle edition.`,
          reason: `Source reflects ${srcYear} documentation prior to active ${targetYear} period.`,
          targetSource: src.url,
        });
      }
    }
  }

  // Deduplicate and cap at 7 items
  return items.slice(0, 7);
}
