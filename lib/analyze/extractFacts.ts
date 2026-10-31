import { generateObject } from 'ai';
import { Facet, Fact, Source } from '../types';
import { FactExtractionSchema } from '../schemas';
import { getLLMConfig } from '../llm';
import { verifyQuoteAgainstPassage } from './verifyQuotes';
import { filterPassagesForExtraction } from '../retrieval/bm25';

export interface ExtractionResult {
  verifiedFacts: Fact[];
  claimsRemovedCount: number;
}

export async function extractFactsForSource(
  source: Source,
  facets: Facet[]
): Promise<ExtractionResult> {
  if (source.fetchStatus === 'failed' || source.passages.length === 0) {
    return { verifiedFacts: [], claimsRemovedCount: 0 };
  }

  const config = getLLMConfig();
  const candidatePassages = filterPassagesForExtraction(source, facets, 35);
  const passageMap = new Map(candidatePassages.map(p => [p.id, p]));

  const verifiedFacts: Fact[] = [];
  let claimsRemovedCount = 0;

  if (config.model) {
    try {
      const passagePrompt = candidatePassages
        .map(p => `[Passage ${p.id}]:\n${p.text}`)
        .join('\n\n');

      const facetListPrompt = facets
        .map(f => `- Facet ID "${f.id}": ${f.name} (Question: ${f.question})`)
        .join('\n');

      const response = await generateObject({
        model: config.model,
        schema: FactExtractionSchema,
        temperature: 0.0,
        system: `You are an exacting factual information extractor.
You will receive a set of Information Facets and Numbered Passages from Source "${source.title}" (ID: ${source.id}).
TASK:
For each facet addressed by the text, extract:
1. facetId: The matching facet ID
2. claim: A concise, normalized factual claim summarizing what the source states
3. quote: An EXACT VERBATIM substring directly copied from the passage.
   CRITICAL: DO NOT alter words, DO NOT paraphrase inside quote. Every quote will undergo strict substring verification on the server. If the quote is not identical to text in the passage, it will be discarded as a hallucination.
4. passageId: The exact passage ID (e.g., "${source.id}-P1") where this quote appears
5. coverage: "full" if the passage completely answers the facet question, or "partial" if it only partially touches it.
Skip facets not addressed in the passages.`,
        prompt: `FACETS:\n${facetListPrompt}\n\nPASSAGES:\n${passagePrompt}`,
      });

      if (response.object && Array.isArray(response.object.facts)) {
        for (const rawFact of response.object.facts) {
          const passage = passageMap.get(rawFact.passageId);
          if (!passage) {
            claimsRemovedCount++;
            continue;
          }

          const isValidQuote = verifyQuoteAgainstPassage(rawFact.quote, passage);
          if (isValidQuote) {
            verifiedFacts.push({
              id: `FACT-${source.id}-${verifiedFacts.length + 1}`,
              facetId: rawFact.facetId,
              sourceId: source.id,
              passageId: rawFact.passageId,
              claim: rawFact.claim.trim(),
              quote: rawFact.quote.trim(),
              coverage: rawFact.coverage,
              verified: true,
            });
          } else {
            claimsRemovedCount++;
          }
        }

        return { verifiedFacts, claimsRemovedCount };
      }
    } catch (err) {
      console.warn(`LLM extraction failed for source ${source.id}, falling back to verified heuristic extraction:`, err);
    }
  }

  // Deterministic verified heuristic extraction
  const heuristic = extractFactsHeuristic(source, candidatePassages, facets);
  return heuristic;
}

/**
 * Heuristic fact extraction that guarantees 100% verbatim quotes directly sliced from passages.
 */
function extractFactsHeuristic(
  source: Source,
  passages: Source['passages'],
  facets: Facet[]
): ExtractionResult {
  const verifiedFacts: Fact[] = [];
  let claimsRemovedCount = 0;

  for (const facet of facets) {
    const terms = [
      facet.name.toLowerCase(),
      ...(facet.keywords || []).map(k => k.toLowerCase()),
    ].filter(t => t.length > 3);

    for (const passage of passages) {
      const text = passage.text;
      const lowerText = text.toLowerCase();

      // Find first sentence matching facet keywords
      const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
      for (const sent of sentences) {
        const lowerSent = sent.toLowerCase();
        const matches = terms.filter(t => lowerSent.includes(t));

        if (matches.length >= 1) {
          const quote = sent.trim();
          if (quote.length >= 20 && quote.length <= 400) {
            // Server verification double check
            if (verifyQuoteAgainstPassage(quote, passage)) {
              verifiedFacts.push({
                id: `FACT-${source.id}-${verifiedFacts.length + 1}`,
                facetId: facet.id,
                sourceId: source.id,
                passageId: passage.id,
                claim: quote.replace(/\s+/g, ' ').slice(0, 150),
                quote,
                coverage: matches.length >= 2 ? 'full' : 'partial',
                verified: true,
              });
              break; // One fact per facet per passage is sufficient
            } else {
              claimsRemovedCount++;
            }
          }
        }
      }

      // Cap at 2 facts per facet per source
      if (verifiedFacts.filter(f => f.facetId === facet.id).length >= 2) {
        break;
      }
    }
  }

  return { verifiedFacts, claimsRemovedCount };
}
