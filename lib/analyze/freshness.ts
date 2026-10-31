import { FreshnessFlag, Source } from '../types';

/**
 * Checks each source for freshness, undated status, or references to an earlier academic / application cycle.
 * Pure deterministic rules, 0 LLM hallucination.
 */
export function checkFreshness(sources: Source[]): FreshnessFlag[] {
  const flags: FreshnessFlag[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const formattedToday = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  for (const source of sources) {
    if (source.fetchStatus === 'failed') continue;

    // 1. Check Date (Stale vs Undated)
    const bestDateStr = source.updatedAt || source.publishedAt;
    if (bestDateStr) {
      const date = new Date(bestDateStr);
      if (!isNaN(date.getTime())) {
        const diffMonths = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
        if (diffMonths > 12) {
          const dateFmt = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          flags.push({
            id: `FLAG-${source.id}-STALE`,
            sourceId: source.id,
            type: 'stale',
            reason: `Source last modified on ${dateFmt} (over ${Math.floor(diffMonths)} months ago; today is ${formattedToday}). Content may be outdated.`,
          });
        }
      }
    } else {
      // Undated
      flags.push({
        id: `FLAG-${source.id}-UNDATED`,
        sourceId: source.id,
        type: 'undated',
        reason: `Source provides no machine-readable publication or last-modified date. Verify publication context independently.`,
      });
    }

    // 2. Check for Earlier Cycle mentions in text
    const fullText = (source.rawText || source.passages.map(p => p.text).join(' ')).slice(0, 15000);
    
    // Cycle patterns like "2023-24", "2024-25", "AY 2024", "Batch of 2024"
    const cycleRegex = /\b(?:AY\s*|Academic Year\s*|batch of\s*|session\s*)?(20\d\d)[-/](20\d\d|\d\d)\b/gi;
    let match: RegExpExecArray | null;
    let foundEarlierCycle: string | null = null;

    while ((match = cycleRegex.exec(fullText)) !== null) {
      const startYear = parseInt(match[1], 10);
      if (startYear < currentYear) {
        foundEarlierCycle = match[0];
        break;
      }
    }

    if (!foundEarlierCycle) {
      const singleYearRegex = /\b(?:AY\s*|Academic Year\s*|batch of\s*)(20\d\d)\b/gi;
      const singleMatch = singleYearRegex.exec(fullText);
      if (singleMatch) {
        const yr = parseInt(singleMatch[1], 10);
        if (yr < currentYear) {
          foundEarlierCycle = singleMatch[0];
        }
      }
    }

    if (foundEarlierCycle) {
      flags.push({
        id: `FLAG-${source.id}-CYCLE`,
        sourceId: source.id,
        type: 'earlier_cycle',
        reason: `Page text references "${foundEarlierCycle}", which is prior to the active ${currentYear} cycle; today is ${formattedToday}.`,
      });
    }
  }

  return flags;
}
