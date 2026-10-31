import { Criterion } from '../types';

export function validateAndDeduplicateCriteria(criteria: Criterion[]): Criterion[] {
  const seenIds = new Set<string>();
  const seenQuestions: string[] = [];
  const result: Criterion[] = [];

  for (const c of criteria) {
    if (!c.id || !c.question) continue;

    // Normalize question for similarity check
    const qNorm = c.question.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const isDuplicate = seenQuestions.some(existing => {
      // Check word overlap ratio
      const wordsA = new Set(existing.split(/\s+/).filter(w => w.length > 3));
      const wordsB = new Set(qNorm.split(/\s+/).filter(w => w.length > 3));
      let intersection = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
      }
      const overlap = (2 * intersection) / (wordsA.size + wordsB.size || 1);
      return overlap > 0.8;
    });

    if (isDuplicate) continue;

    // Unique ID
    let finalId = c.id;
    if (seenIds.has(finalId)) {
      finalId = `${c.id}-${result.length + 1}`;
    }
    seenIds.add(finalId);
    seenQuestions.push(qNorm);

    result.push({
      ...c,
      id: finalId,
      importance: c.importance === 1 || c.importance === 2 || c.importance === 3 ? c.importance : 2,
    });
  }

  // Ensure between 3 and 10 criteria
  return result.slice(0, 10);
}
