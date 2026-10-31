import { Passage } from '../types';

/**
 * Normalizes text for robust quote matching:
 * collapses whitespace, unifies unicode quotes, strips extraneous non-alphanumeric punctuation.
 */
export function normalizeForVerification(str: string): string {
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Verifies that the extracted quote is an authentic verbatim substring of the cited passage.
 * If the quote does not appear in the cited passage, it is rejected.
 */
export function verifyQuoteAgainstPassage(quote: string, passage: Passage): boolean {
  if (!quote || !passage || !passage.text) {
    return false;
  }

  // 1. Direct raw substring check
  if (passage.text.includes(quote.trim())) {
    return true;
  }

  // 2. Normalized check (whitespace & case insensitivity)
  const normPassage = normalizeForVerification(passage.text);
  const normQuote = normalizeForVerification(quote);

  if (normQuote.length === 0) return false;
  if (normPassage.includes(normQuote)) {
    return true;
  }

  // 3. Relaxed punctuation check (in case model omitted trailing periods or quotes)
  const stripPunct = (s: string) => s.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').replace(/\s+/g, ' ');
  const cleanPassage = stripPunct(normPassage);
  const cleanQuote = stripPunct(normQuote);

  if (cleanQuote.length > 10 && cleanPassage.includes(cleanQuote)) {
    return true;
  }

  return false;
}
