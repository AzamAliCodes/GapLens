import { Passage } from '../types';

/**
 * Splits text into readable passages of approximately 80 to 200 words
 * honoring paragraph and sentence boundaries. Each passage receives an ID like S1-P1.
 */
export function chunkTextIntoPassages(sourceId: string, fullText: string, minWords = 60, maxWords = 220): Passage[] {
  if (!fullText || !fullText.trim()) {
    return [];
  }

  // Normalize newlines
  const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  const passages: Passage[] = [];
  let currentBuffer: string[] = [];
  let currentWordCount = 0;
  let passageIndex = 1;

  function flushBuffer() {
    if (currentBuffer.length === 0) return;
    const passageText = currentBuffer.join('\n\n').trim();
    if (passageText) {
      passages.push({
        id: `${sourceId}-P${passageIndex++}`,
        text: passageText,
        wordCount: passageText.split(/\s+/).filter(Boolean).length,
      });
    }
    currentBuffer = [];
    currentWordCount = 0;
  }

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    const count = words.length;

    // If the paragraph itself is huge (> maxWords), split it on sentence boundaries
    if (count > maxWords) {
      flushBuffer();
      const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [para];
      let sentenceBuffer: string[] = [];
      let sentenceCount = 0;

      for (const sent of sentences) {
        const sentWords = sent.split(/\s+/).filter(Boolean).length;
        if (sentenceCount + sentWords > maxWords && sentenceCount >= minWords) {
          const sentText = sentenceBuffer.join(' ').trim();
          passages.push({
            id: `${sourceId}-P${passageIndex++}`,
            text: sentText,
            wordCount: sentenceCount,
          });
          sentenceBuffer = [sent];
          sentenceCount = sentWords;
        } else {
          sentenceBuffer.push(sent);
          sentenceCount += sentWords;
        }
      }

      if (sentenceBuffer.length > 0) {
        const sentText = sentenceBuffer.join(' ').trim();
        passages.push({
          id: `${sourceId}-P${passageIndex++}`,
          text: sentText,
          wordCount: sentenceCount,
        });
      }
      continue;
    }

    // Normal paragraph
    if (currentWordCount + count > maxWords && currentWordCount >= minWords) {
      flushBuffer();
    }

    currentBuffer.push(para);
    currentWordCount += count;
  }

  flushBuffer();

  // If text had no paragraph breaks and yielded nothing
  if (passages.length === 0 && fullText.trim()) {
    const allWords = fullText.split(/\s+/).filter(Boolean);
    passages.push({
      id: `${sourceId}-P1`,
      text: fullText.trim(),
      wordCount: allWords.length,
    });
  }

  return passages;
}
