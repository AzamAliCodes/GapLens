import { AtomicClaim, ClaimFinding, Evidence, QuestionContext, Source } from '../types';
import { verifyQuoteIntegrity } from './verifyQuoteIntegrity';
import { classifyClaimVerdict } from './scopedEntailment';
import { toSourceRecord } from '../ingest/fetchSource';

export function findCandidateEvidenceForClaim(
  claim: AtomicClaim,
  sources: Source[]
): Evidence[] {
  const candidates: Evidence[] = [];
  const claimWords = claim.normalizedProposition
    .toLowerCase()
    .replace(/[^\w\s%]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['must', 'have', 'been', 'with', 'from', 'that', 'this', 'each', 'will'].includes(w));

  for (const source of sources) {
    if (source.fetchStatus === 'failed') continue;

    for (const passage of source.passages) {
      const pText = passage.text;
      const pLower = pText.toLowerCase();

      // Check keyword overlap score
      let hits = 0;
      for (const word of claimWords) {
        if (pLower.includes(word)) hits++;
      }
      const score = claimWords.length > 0 ? hits / claimWords.length : 0;

      // Also check if any numerical values match
      const hasNumberMatch =
        (claim.value !== undefined && pLower.includes(String(claim.value).toLowerCase())) ||
        (claim.units === '%' && pLower.includes('%'));

      if (score >= 0.25 || (hits >= 2 && score >= 0.2) || hasNumberMatch) {
        // Run quote integrity check on exactAnswerSpan against passage
        const quoteCheck = verifyQuoteIntegrity(claim.exactAnswerSpan, pText);

        candidates.push({
          id: `EV-${source.id}-${passage.id}`,
          sourceId: source.id,
          passageId: passage.id,
          passage: pText,
          exactQuote: quoteCheck.matchedSubstring || claim.exactAnswerSpan,
          quoteOffset: quoteCheck.offset,
          quoteIntegrityVerified: quoteCheck.verified,
          origin: source.kind === 'pasted' ? 'user_text' : 'user_url',
          publishedAt: source.publishedAt,
          url: source.url,
          provenanceGroupId: source.provenanceGroupId,
          relevanceScore: Math.round(score * 100) / 100,
        });
      }
    }
  }

  // Sort by relevance score descending
  return candidates.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)).slice(0, 5);
}

export async function verifyClaimsAgainstSources(
  claims: AtomicClaim[],
  sources: Source[],
  context: QuestionContext
): Promise<ClaimFinding[]> {
  const findings: ClaimFinding[] = [];

  for (const claim of claims) {
    const candidateEvidence = findCandidateEvidenceForClaim(claim, sources);
    const classification = classifyClaimVerdict(claim, candidateEvidence, context);

    findings.push({
      claimId: claim.id,
      verdict: classification.verdict,
      confidence: classification.confidence,
      entailmentRationale: classification.entailmentRationale,
      matchedEvidence: classification.supportingEvidence,
      contradictingEvidence: classification.contradictingEvidence,
      scopeDiscrepancies: classification.scopeDiscrepancies,
      uncertaintyNotes: classification.uncertaintyNotes,
      deterministicChecksRun: classification.deterministicChecksRun,
      requiresHumanReview: classification.requiresHumanReview,
    });
  }

  return findings;
}
