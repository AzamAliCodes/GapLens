import { Facet, Fact, Gap, Source } from '../types';
import { hasKeywordMentionInRawText } from '../retrieval/bm25';

export type CoverageStatus = 'covered' | 'partial' | 'missing';

export interface FacetCellCoverage {
  facetId: string;
  sourceId: string;
  status: CoverageStatus;
  facts: Fact[];
  mentionNote?: string;
}

export interface CoverageAnalysisResult {
  matrix: Map<string, Map<string, FacetCellCoverage>>; // facetId -> sourceId -> coverage
  gaps: Gap[];
}

export function computeCoverageAndGaps(
  facets: Facet[],
  sources: Source[],
  facts: Fact[]
): CoverageAnalysisResult {
  const activeSources = sources.filter(s => s.fetchStatus !== 'failed');
  const matrix = new Map<string, Map<string, FacetCellCoverage>>();
  const gaps: Gap[] = [];

  // Group facts by facetId and sourceId
  const factsMap = new Map<string, Map<string, Fact[]>>();
  for (const f of facts) {
    if (!factsMap.has(f.facetId)) {
      factsMap.set(f.facetId, new Map());
    }
    const sourceMap = factsMap.get(f.facetId)!;
    if (!sourceMap.has(f.sourceId)) {
      sourceMap.set(f.sourceId, []);
    }
    sourceMap.get(f.sourceId)!.push(f);
  }

  for (const facet of facets) {
    const facetRow = new Map<string, FacetCellCoverage>();
    let coveredCount = 0;
    let partialCount = 0;
    let officialSourcePresent = false;
    let singleSourceId: string | null = null;

    for (const source of activeSources) {
      const sourceFacts = factsMap.get(facet.id)?.get(source.id) || [];
      let status: CoverageStatus = 'missing';
      let mentionNote: string | undefined;

      if (sourceFacts.length > 0) {
        const hasFull = sourceFacts.some(f => f.coverage === 'full');
        status = hasFull ? 'covered' : 'partial';
      } else {
        // Section 19.1: Secondary check before marking missing
        const hasMention = hasKeywordMentionInRawText(source, facet);
        if (hasMention) {
          status = 'partial';
          mentionNote = 'Keyword mention found in source text, but specific claim could not be verified.';
        }
      }

      if (status === 'covered') {
        coveredCount++;
        singleSourceId = source.id;
        if (source.kind === 'official' || source.kind === 'institutional') {
          officialSourcePresent = true;
        }
      } else if (status === 'partial') {
        partialCount++;
        if (!singleSourceId) singleSourceId = source.id;
      }

      facetRow.set(source.id, {
        facetId: facet.id,
        sourceId: source.id,
        status,
        facts: sourceFacts,
        mentionNote,
      });
    }

    matrix.set(facet.id, facetRow);

    // Identify Gaps
    const totalFound = coveredCount + partialCount;

    // 1. Missing everywhere
    if (totalFound === 0) {
      const severity = facet.criticality === 3 ? 'critical' : facet.criticality === 2 ? 'high' : 'medium';
      gaps.push({
        id: `GAP-${facet.id}-MISSING`,
        facetId: facet.id,
        type: 'missing',
        severity,
        note: `Potential gap: "${facet.name}" was not found in any of the ${activeSources.length} sources reviewed.`,
      });
    }
    // 2. Only partial coverage everywhere
    else if (coveredCount === 0 && partialCount > 0) {
      gaps.push({
        id: `GAP-${facet.id}-PARTIAL`,
        facetId: facet.id,
        type: 'partial',
        severity: facet.criticality === 3 ? 'high' : 'medium',
        note: `Potential gap: "${facet.name}" has only fragmented or partial coverage without definitive answers.`,
      });
    }
    // 3. Single source unconfirmed (covered by only 1 third-party source)
    else if (coveredCount === 1 && !officialSourcePresent && activeSources.length >= 2) {
      const sourceObj = activeSources.find(s => s.id === singleSourceId);
      gaps.push({
        id: `GAP-${facet.id}-SINGLE`,
        facetId: facet.id,
        type: 'single_source',
        severity: 'low',
        note: `Potential gap: "${facet.name}" is mentioned only by a single third-party source (${sourceObj?.title || singleSourceId}) and lacks independent confirmation.`,
      });
    }
  }

  return { matrix, gaps };
}
