import MiniSearch from 'minisearch';
import { Facet, Passage, Source } from '../types';

/**
 * Filters passages for each source using BM25 keyword scoring when passages > 40.
 * Guarantees that essential passages are prioritized while fitting within model context windows.
 */
export function filterPassagesForExtraction(
  source: Source,
  facets: Facet[],
  maxPassagesPerSource = 40
): Passage[] {
  // If passages are under limit, send all of them
  if (source.passages.length <= maxPassagesPerSource) {
    return source.passages;
  }

  // Build in-memory MiniSearch index for this source's passages
  const miniSearch = new MiniSearch({
    fields: ['text'],
    storeFields: ['id', 'text'],
    searchOptions: {
      boost: { text: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  miniSearch.addAll(source.passages);

  const selectedIds = new Set<string>();

  // For each facet, retrieve top 5 relevant passages
  for (const facet of facets) {
    const query = [facet.name, facet.question, ...(facet.keywords || [])].join(' ');
    const results = miniSearch.search(query);
    const topPerFacet = results.slice(0, 5);
    for (const res of topPerFacet) {
      selectedIds.add(res.id as string);
    }
  }

  // Always keep the first 2 passages (introductions / summaries)
  if (source.passages[0]) selectedIds.add(source.passages[0].id);
  if (source.passages[1]) selectedIds.add(source.passages[1].id);

  // Return selected passages in their original document order
  const filtered = source.passages.filter(p => selectedIds.has(p.id));
  return filtered.length > 0 ? filtered : source.passages.slice(0, maxPassagesPerSource);
}

/**
 * Performs a keyword scan across raw text to catch potential misses before marking a facet Missing.
 */
export function hasKeywordMentionInRawText(source: Source, facet: Facet): boolean {
  if (!source.rawText && source.passages.length === 0) return false;
  const fullText = (source.rawText || source.passages.map(p => p.text).join(' ')).toLowerCase();

  const terms = [
    facet.name.toLowerCase(),
    ...(facet.keywords || []).map(k => k.toLowerCase()),
  ].filter(t => t.length > 3);

  return terms.some(term => fullText.includes(term));
}
