import { ClaimFinding, Criterion, CriterionAssessment, Evidence, Source } from '../types';

export function assessCriteriaCoverage(
  criteria: Criterion[],
  findings: ClaimFinding[],
  sources: Source[]
): CriterionAssessment[] {
  const assessments: CriterionAssessment[] = [];

  for (const criterion of criteria) {
    // Find all findings whose claims are associated with this criterion
    // Note: findings connect via claims
    // We can also search passage text across sources for criterion keywords
    const cKeywords = criterion.question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4 && !['what', 'which', 'where', 'should', 'before', 'their'].includes(w));

    let matchedPassageCount = 0;
    const sourcesWithPassage = new Set<string>();

    for (const source of sources) {
      if (source.fetchStatus === 'failed') continue;
      for (const p of source.passages) {
        const pLower = p.text.toLowerCase();
        const matches = cKeywords.filter((k) => pLower.includes(k));
        if (matches.length >= 2 || (cKeywords.length > 0 && matches.length / cKeywords.length >= 0.35)) {
          matchedPassageCount++;
          sourcesWithPassage.add(source.id);
        }
      }
    }

    let status: CriterionAssessment['status'] = 'missing';
    let summary = '';

    if (sourcesWithPassage.size >= 2) {
      status = 'covered';
      summary = `Corroborated across ${sourcesWithPassage.size} independent sources with ${matchedPassageCount} relevant passages.`;
    } else if (sourcesWithPassage.size === 1) {
      status = 'partially_covered';
      summary = `Referenced by a single source (${Array.from(sourcesWithPassage)[0]}) with ${matchedPassageCount} passage(s). Lacks independent cross-verification.`;
    } else {
      status = 'missing';
      summary = `Information gap: Zero passages found addressing this criterion across all reviewed sources.`;
    }

    assessments.push({
      criterionId: criterion.id,
      status,
      summary,
      evidenceCount: matchedPassageCount,
    });
  }

  return assessments;
}
