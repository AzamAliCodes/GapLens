import { generateObject } from 'ai';
import { Conflict, Facet, Fact } from '../types';
import { FacetComparisonSchema } from '../schemas';
import { getLLMConfig } from '../llm';

export async function detectConflicts(
  facets: Facet[],
  facts: Fact[]
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const facetMap = new Map(facets.map(f => [f.id, f]));

  // Group verified facts by facetId
  const factsByFacet = new Map<string, Fact[]>();
  for (const f of facts) {
    if (!factsByFacet.has(f.facetId)) {
      factsByFacet.set(f.facetId, []);
    }
    factsByFacet.get(f.facetId)!.push(f);
  }

  // Check each facet that has facts from at least 2 distinct sources
  for (const [facetId, facetFacts] of factsByFacet.entries()) {
    const facet = facetMap.get(facetId);
    if (!facet) continue;

    // Group by sourceId
    const sourcesWithFacts = new Map<string, Fact[]>();
    for (const f of facetFacts) {
      if (!sourcesWithFacts.has(f.sourceId)) {
        sourcesWithFacts.set(f.sourceId, []);
      }
      sourcesWithFacts.get(f.sourceId)!.push(f);
    }

    const sourceIds = Array.from(sourcesWithFacts.keys());
    if (sourceIds.length < 2) continue;

    // Compare pairs of facts from different sources
    for (let i = 0; i < sourceIds.length; i++) {
      for (let j = i + 1; j < sourceIds.length; j++) {
        const factA = sourcesWithFacts.get(sourceIds[i])![0];
        const factB = sourcesWithFacts.get(sourceIds[j])![0];

        // 1. Rule-based checks: Dates, Amounts, Document lists
        const ruleCheck = checkRuleConflict(factA, factB, facet);
        if (ruleCheck) {
          conflicts.push({
            id: `CONF-${facet.id}-${conflicts.length + 1}`,
            facetId: facet.id,
            severity: facet.criticality === 3 ? 'critical' : 'high',
            a: {
              factId: factA.id,
              sourceId: factA.sourceId,
              passageId: factA.passageId,
              claim: factA.claim,
              quote: factA.quote,
            },
            b: {
              factId: factB.id,
              sourceId: factB.sourceId,
              passageId: factB.passageId,
              claim: factB.claim,
              quote: factB.quote,
            },
            reason: ruleCheck,
            method: 'rule',
          });
          continue;
        }

        // 2. LLM comparison if rule-check did not trigger
        const config = getLLMConfig();
        if (config.model) {
          try {
            const res = await generateObject({
              model: config.model,
              schema: FacetComparisonSchema,
              temperature: 0.0,
              system: `You compare two claims from different sources for a research facet.
Determine if they AGREE, CONFLICT, or are UNCLEAR.
Rules:
- CONFLICT: The sources directly contradict each other or state mutually incompatible requirements (e.g. one says minimum 60%, the other says minimum 75%; one says online only, the other says postal only; or they list conflicting document requirements).
- AGREE: Different phrasing of the same reality or complementary non-contradictory details.
- Provide a crisp 1-sentence reason.`,
              prompt: `FACET: ${facet.name} (Question: ${facet.question})
Source ${factA.sourceId} Claim: "${factA.claim}" (Quote: "${factA.quote}")
Source ${factB.sourceId} Claim: "${factB.claim}" (Quote: "${factB.quote}")`,
            });

            const comparison = res.object.comparisons?.[0];
            if (comparison && comparison.status === 'conflict') {
              conflicts.push({
                id: `CONF-${facet.id}-${conflicts.length + 1}`,
                facetId: facet.id,
                severity: facet.criticality === 3 ? 'critical' : 'high',
                a: {
                  factId: factA.id,
                  sourceId: factA.sourceId,
                  passageId: factA.passageId,
                  claim: factA.claim,
                  quote: factA.quote,
                },
                b: {
                  factId: factB.id,
                  sourceId: factB.sourceId,
                  passageId: factB.passageId,
                  claim: factB.claim,
                  quote: factB.quote,
                },
                reason: comparison.reason,
                method: 'llm',
              });
            }
          } catch (err) {
            console.warn('LLM conflict comparison failed:', err);
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Deterministic rule-based conflict detector for numbers, percentages, dates, and document keywords.
 */
function checkRuleConflict(factA: Fact, factB: Fact, facet: Facet): string | null {
  const textA = (factA.claim + ' ' + factA.quote).toLowerCase();
  const textB = (factB.claim + ' ' + factB.quote).toLowerCase();

  // 1. Percentage cutoffs (e.g., 60% vs 75% or 50%)
  const pctRegex = /(\b\d{1,2}(?:\.\d+)?%)/g;
  const pctsA = textA.match(pctRegex);
  const pctsB = textB.match(pctRegex);
  if (pctsA && pctsB) {
    const uniqueA = Array.from(new Set(pctsA));
    const uniqueB = Array.from(new Set(pctsB));
    if (uniqueA[0] !== uniqueB[0] && !uniqueA.includes(uniqueB[0])) {
      return `Discrepancy in percentage criteria: Source ${factA.sourceId} states ${uniqueA[0]} whereas Source ${factB.sourceId} states ${uniqueB[0]}.`;
    }
  }

  // 2. Specific income document discrepancies (e.g. ITR vs salary slip vs ration card)
  const incomeDocA = textA.includes('income tax return') || textA.includes('itr') || textA.includes('form 16');
  const incomeDocB = textB.includes('salary slip') || textB.includes('tehsildar') || textB.includes('ration card') || textB.includes('affidavit');
  if (
    (facet.name.toLowerCase().includes('document') || facet.name.toLowerCase().includes('eligibility')) &&
    incomeDocA &&
    incomeDocB &&
    !textA.includes('salary slip') &&
    !textB.includes('income tax return')
  ) {
    return `Conflicting income documentation requirements: Source ${factA.sourceId} mandates Income Tax Return (ITR) while Source ${factB.sourceId} specifies salary slips / Tehsildar certificate.`;
  }

  // 3. Currency / Award amount discrepancy
  const amountRegex = /(?:₹|rs\.?|inr|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:lakh|crore|k))?)/gi;
  const amountsA = textA.match(amountRegex);
  const amountsB = textB.match(amountRegex);
  if (amountsA && amountsB && amountsA[0].replace(/\s+/g, '') !== amountsB[0].replace(/\s+/g, '')) {
    return `Discrepancy in stated monetary figures: Source ${factA.sourceId} cites ${amountsA[0]} while Source ${factB.sourceId} cites ${amountsB[0]}.`;
  }

  // 4. Deadline month or date discrepancy
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  if (facet.name.toLowerCase().includes('deadline') || facet.name.toLowerCase().includes('date')) {
    const monthA = months.find(m => textA.includes(m));
    const monthB = months.find(m => textB.includes(m));
    if (monthA && monthB && monthA !== monthB) {
      return `Discrepancy in deadline schedule: Source ${factA.sourceId} cites ${monthA.toUpperCase()} whereas Source ${factB.sourceId} cites ${monthB.toUpperCase()}.`;
    }
  }

  // 5. Opposing polarities / requirement negation (e.g. mandatory/penalty vs no bond/exempt/waived)
  const isAffirmativeA = /\b(mandatory|strictly required|compulsory|applies|penalty|bond)\b/i.test(textA);
  const isNegativeB = /\b(no lock-in|no bond|not required|exempt|optional|waived|no penalty)\b/i.test(textB);
  const isAffirmativeB = /\b(mandatory|strictly required|compulsory|applies|penalty|bond)\b/i.test(textB);
  const isNegativeA = /\b(no lock-in|no bond|not required|exempt|optional|waived|no penalty)\b/i.test(textA);

  if ((isAffirmativeA && isNegativeB) || (isAffirmativeB && isNegativeA)) {
    return `Conflicting terms detected: Source ${factA.sourceId} states that a mandatory condition or penalty applies, whereas Source ${factB.sourceId} indicates it is not required or has no penalty.`;
  }

  return null;
}
