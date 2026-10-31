import { generateObject } from 'ai';
import { ChecklistItem, Conflict, Facet, FreshnessFlag, Gap, Source } from '../types';
import { ChecklistWordingSchema } from '../schemas';
import { getLLMConfig } from '../llm';

export async function generateChecklist(
  gaps: Gap[],
  conflicts: Conflict[],
  flags: FreshnessFlag[],
  facets: Facet[],
  sources: Source[]
): Promise<ChecklistItem[]> {
  const facetMap = new Map(facets.map(f => [f.id, f]));
  const sourceMap = new Map(sources.map(s => [s.id, s]));
  const officialSource = sources.find(s => s.kind === 'official');
  const defaultWhere = officialSource ? `the official portal (${officialSource.title})` : 'the designated primary authority';

  // 1. Build initial checklist items with calculated priorities
  interface RawItem {
    id: string;
    score: number;
    baseAction: string;
    whereToVerify: string;
    evidence: string[];
    label: ChecklistItem['label'];
  }

  const rawItems: RawItem[] = [];

  // Gaps -> Checklist items
  for (const gap of gaps) {
    const facet = facetMap.get(gap.facetId);
    const criticality = facet?.criticality || 2;
    // Score formula: criticality * 2 + 2 for gap
    const score = criticality * 2 + 2;

    rawItems.push({
      id: `CHK-${gap.id}`,
      score,
      baseAction: `Confirm ${facet?.name || 'missing requirement'}: ${facet?.question || gap.note}`,
      whereToVerify: officialSource?.url || defaultWhere,
      evidence: [gap.id],
      label: 'ai',
    });
  }

  // Conflicts -> Checklist items
  for (const conflict of conflicts) {
    const facet = facetMap.get(conflict.facetId);
    const criticality = facet?.criticality || 2;
    // Score formula: criticality * 2 + 3 for conflict
    const score = criticality * 2 + 3;

    rawItems.push({
      id: `CHK-${conflict.id}`,
      score,
      baseAction: `Resolve contradictory claims on ${facet?.name || 'requirement'}: ${conflict.reason}`,
      whereToVerify: `Official source or issuing department to resolve discrepancy between Source ${conflict.a.sourceId} and Source ${conflict.b.sourceId}`,
      evidence: [conflict.id, conflict.a.factId, conflict.b.factId],
      label: conflict.method === 'rule' ? 'rule' : 'ai',
    });
  }

  // Freshness flags -> Checklist items
  for (const flag of flags) {
    const src = sourceMap.get(flag.sourceId);
    let score = 2;
    if (flag.type === 'earlier_cycle') score = 6;
    else if (flag.type === 'stale') score = src?.kind === 'official' ? 5 : 3;
    else if (flag.type === 'undated') score = 2;

    const action = flag.type === 'earlier_cycle'
      ? `Verify latest current-year rules to replace outdated ${flag.reason.slice(0, 50)} from ${src?.title}`
      : flag.type === 'stale'
      ? `Check for an updated version or gazette notification for ${src?.title}`
      : `Cross-check publication date and validity of guidance on ${src?.title}`;

    rawItems.push({
      id: `CHK-${flag.id}`,
      score,
      baseAction: action,
      whereToVerify: officialSource?.url || defaultWhere,
      evidence: [flag.id],
      label: 'rule',
    });
  }

  // Sort descending by score
  rawItems.sort((a, b) => b.score - a.score);

  // Map scores to Priority
  const mappedItems: ChecklistItem[] = rawItems.map(item => {
    let priority: ChecklistItem['priority'] = 'low';
    if (item.score >= 8) priority = 'critical';
    else if (item.score >= 6) priority = 'high';
    else if (item.score >= 4) priority = 'medium';

    return {
      id: item.id,
      priority,
      action: item.baseAction,
      whereToVerify: item.whereToVerify,
      evidence: item.evidence,
      label: item.label,
      done: false,
    };
  });

  // Polish wording with LLM if available
  const config = getLLMConfig();
  if (config.model && mappedItems.length > 0) {
    try {
      const promptItems = mappedItems.slice(0, 8).map(item => ({
        findingId: item.id,
        action: item.action,
        whereToVerify: item.whereToVerify,
      }));

      const res = await generateObject({
        model: config.model,
        schema: ChecklistWordingSchema,
        temperature: 0.1,
        system: `You rewrite information gap checklist items into punchy, imperative, high-clarity actions.
Guidelines:
- Start with strong action verbs (Confirm, Verify, Inspect, Re-check, Validate).
- Specify exactly what to look for and where to verify (prefer official notice/site).
- NEVER fabricate new findings or invent facts not stated in the input.
- Keep tone direct and helpful for an applicant or researcher.`,
        prompt: `Findings to rewrite:\n${JSON.stringify(promptItems, null, 2)}`,
      });

      if (res.object?.items) {
        const wordingMap = new Map(res.object.items.map(w => [w.findingId, w]));
        for (const item of mappedItems) {
          const polished = wordingMap.get(item.id);
          if (polished) {
            item.action = polished.action;
            item.whereToVerify = polished.whereToVerify;
          }
        }
      }
    } catch (err) {
      console.warn('Checklist wording rewrite failed, using base actions:', err);
    }
  }

  return mappedItems;
}
