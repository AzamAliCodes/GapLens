import { AtomicClaim, Criterion, QuestionContext } from '../types';
import { generateLlmObject } from '../llm';
import { z } from 'zod';

export function extractClaimsHeuristic(
  answer: string,
  criteria: Criterion[],
  context: QuestionContext
): AtomicClaim[] {
  const claims: AtomicClaim[] = [];
  const trimmed = answer.trim();
  if (!trimmed) return claims;

  // Split into sentences or semicolon-delimited clauses while tracking start/end offsets
  // Regex to find sentence boundaries: . ! ? or linebreaks, followed by whitespace
  const sentenceRegex = /[^.!?\n\r]+[.!?\n\r]*/g;
  let match: RegExpExecArray | null;

  let claimIdx = 1;
  while ((match = sentenceRegex.exec(answer)) !== null) {
    const rawSpan = match[0].trim();
    if (!rawSpan || rawSpan.length < 5) continue;

    const startOffset = match.index + match[0].indexOf(rawSpan);
    const endOffset = startOffset + rawSpan.length;

    // Check if this span is purely opinion or conversational boilerplate
    const isOpinionOrPleasantry =
      /i hope this helps|good luck|please note that|feel free to ask|scholarships are great|make sure you do your best|in my opinion|best regards|thank you|welcome|wonderful idea|great idea|peace of mind/i.test(
        rawSpan
      );

    // Check for factual signals: numbers, percentages, dates, currency, requirement modals
    const hasFactualSignal =
      /\d+|%|inr|\$|€|rs\.|percent|must|minimum|maximum|limit|mandat|require|deadline|date|admit|criteria|portal|annual|monthly|income|cgpa|tehsildar|itr/i.test(
        rawSpan
      );

    const factCheckable = !isOpinionOrPleasantry && hasFactualSignal;

    // Extract potential values / units
    let value: string | number | undefined = undefined;
    let units: string | undefined = undefined;

    const percentMatch = rawSpan.match(/(\d+(?:\.\d+)?)\s*%/);
    const currencyMatch = rawSpan.match(/(?:INR|Rs\.|₹|\$)\s*([\d,]+(?:\.\d+)?)/i);
    const dateMatch = rawSpan.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\b/i);

    if (percentMatch) {
      value = parseFloat(percentMatch[1]);
      units = '%';
    } else if (currencyMatch) {
      value = currencyMatch[1].replace(/,/g, '');
      units = 'currency';
    } else if (dateMatch) {
      value = dateMatch[0];
      units = 'date';
    }

    // Extract temporal scope
    const effectiveDate = context.targetDateOrPeriod || dateMatch?.[0] || undefined;

    // Conditions
    const conditions: string[] = [];
    if (/if\s+([^,;]+)/i.test(rawSpan)) {
      const cond = rawSpan.match(/if\s+([^,;]+)/i)?.[1]?.trim();
      if (cond) conditions.push(cond);
    }
    if (/unless\s+([^,;]+)/i.test(rawSpan)) {
      const cond = rawSpan.match(/unless\s+([^,;]+)/i)?.[1]?.trim();
      if (cond) conditions.push(`unless ${cond}`);
    }

    // Associate with matching criteria
    const matchedCriterionIds = criteria
      .filter((c) => {
        const cTerms = c.question.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const spanLower = rawSpan.toLowerCase();
        return cTerms.some((t) => spanLower.includes(t));
      })
      .map((c) => c.id);

    // Normalized proposition
    const normalizedProposition = rawSpan
      .replace(/^[\s•*-]+/, '')
      .replace(/^(firstly|secondly|furthermore|additionally|also|note that|it is stated that)\s*,?\s*/i, '')
      .trim();

    claims.push({
      id: `CLM-${String(claimIdx++).padStart(3, '0')}`,
      exactAnswerSpan: rawSpan,
      spanOffset: { start: startOffset, end: endOffset },
      normalizedProposition,
      value,
      units,
      effectiveDate,
      jurisdiction: context.jurisdiction,
      conditions,
      criterionIds: matchedCriterionIds.length > 0 ? matchedCriterionIds : criteria.slice(0, 1).map((c) => c.id),
      factCheckable,
    });
  }

  return claims;
}

export async function extractClaims(
  answer: string,
  criteria: Criterion[],
  context: QuestionContext
): Promise<AtomicClaim[]> {
  const heuristic = extractClaimsHeuristic(answer, criteria, context);

  try {
    const ClaimSchema = z.object({
      claims: z.array(
        z.object({
          exactAnswerSpan: z.string(),
          normalizedProposition: z.string(),
          subject: z.string().optional(),
          predicate: z.string().optional(),
          value: z.union([z.string(), z.number()]).optional(),
          units: z.string().optional(),
          effectiveDate: z.string().optional(),
          jurisdiction: z.string().optional(),
          population: z.string().optional(),
          conditions: z.array(z.string()).default([]),
          criterionIds: z.array(z.string()).default([]),
          factCheckable: z.boolean(),
        })
      ).min(1),
    });

    const prompt = `Deconstruct the following candidate answer into atomic verifiable factual claims.
Candidate Answer:
"""
${answer}
"""

Verification Criteria:
${criteria.map((c) => `- [${c.id}] ${c.question}`).join('\n')}

Rules:
1. exactAnswerSpan MUST be an exact verbatim substring from the candidate answer text.
2. normalizedProposition must state the standalone factual proposition.
3. Mark subjective opinions or polite boilerplate as factCheckable = false.
4. Extract specific numbers, percentages, dates, currency, and conditions.
5. Map each claim to one or more criterionIds.`;

    const generated = await generateLlmObject(prompt, ClaimSchema);
    if (generated?.claims && generated.claims.length >= 1) {
      // Re-link exact span offsets
      return generated.claims.map((c, i) => {
        const exactIndex = answer.indexOf(c.exactAnswerSpan);
        const spanOffset =
          exactIndex >= 0
            ? { start: exactIndex, end: exactIndex + c.exactAnswerSpan.length }
            : undefined;

        return {
          id: `CLM-${String(i + 1).padStart(3, '0')}`,
          exactAnswerSpan: c.exactAnswerSpan,
          spanOffset,
          normalizedProposition: c.normalizedProposition,
          subject: c.subject,
          predicate: c.predicate,
          value: c.value,
          units: c.units,
          effectiveDate: c.effectiveDate || context.targetDateOrPeriod,
          jurisdiction: c.jurisdiction || context.jurisdiction,
          population: c.population,
          conditions: c.conditions || [],
          criterionIds: c.criterionIds.length ? c.criterionIds : criteria.slice(0, 1).map((cr) => cr.id),
          factCheckable: c.factCheckable,
        };
      });
    }
  } catch {
    // Graceful fallback to heuristic
  }

  return heuristic;
}
