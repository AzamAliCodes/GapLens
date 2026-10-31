export interface QuoteIntegrityResult {
  verified: boolean;
  exactMatch: boolean;
  offset?: { start: number; end: number };
  matchedSubstring?: string;
}

/**
 * Checks whether an excerpt appears in canonical captured source text.
 * Note: Quote integrity proves text presence in the snapshot, NOT factual truth.
 */
export function verifyQuoteIntegrity(
  quote: string,
  canonicalText: string
): QuoteIntegrityResult {
  if (!quote || !canonicalText) {
    return { verified: false, exactMatch: false };
  }

  const cleanQuote = quote.trim();
  if (cleanQuote.length < 3) {
    return { verified: false, exactMatch: false };
  }

  // 1. Direct exact substring match
  const exactIdx = canonicalText.indexOf(cleanQuote);
  if (exactIdx !== -1) {
    return {
      verified: true,
      exactMatch: true,
      offset: { start: exactIdx, end: exactIdx + cleanQuote.length },
      matchedSubstring: cleanQuote,
    };
  }

  // 2. Case-insensitive exact match
  const lowerText = canonicalText.toLowerCase();
  const lowerQuote = cleanQuote.toLowerCase();
  const lowerIdx = lowerText.indexOf(lowerQuote);
  if (lowerIdx !== -1) {
    return {
      verified: true,
      exactMatch: false,
      offset: { start: lowerIdx, end: lowerIdx + cleanQuote.length },
      matchedSubstring: canonicalText.slice(lowerIdx, lowerIdx + cleanQuote.length),
    };
  }

  // 3. Whitespace-normalized match
  const normQuote = cleanQuote.replace(/\s+/g, ' ');
  const normCanonical = canonicalText.replace(/\s+/g, ' ');
  const normIdx = normCanonical.toLowerCase().indexOf(normQuote.toLowerCase());

  if (normIdx !== -1) {
    return {
      verified: true,
      exactMatch: false,
      offset: { start: normIdx, end: normIdx + normQuote.length },
      matchedSubstring: normCanonical.slice(normIdx, normIdx + normQuote.length),
    };
  }

  return { verified: false, exactMatch: false };
}
