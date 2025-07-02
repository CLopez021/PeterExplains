export interface SegmentDef {
  speaker: string;
  text: string;
}

export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Segment {
  startMs: number;
  endMs: number;
}

// Add normalize helper for uniform text comparison
// Add normalize helper for uniform text comparison
function normalize(text: string): string {
    return text
      .trim()
      .replace(/[^\w\s]|_/g, '')   // strip punctuation (anything that's not alphanumeric or whitespace)
      .toLowerCase();
  }

// Helper to normalize text: trim, strip punctuation, split into lowercase words
function getWords(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

// Get first word of text
function getFirstWord(text: string): string {
  const words = getWords(text);
  return words.length ? words[0] : '';
}

// Get last word of text
function getLastWord(text: string): string {
  const words = getWords(text);
  return words.length ? words[words.length - 1] : '';
}

// Get second-to-last word of text, if any
function getSecondLastWord(text: string): string | null {
  const words = getWords(text);
  return words.length > 1 ? words[words.length - 2] : null;
}

// Find all positions where a caption word matches the target (both punctuation-stripped)
function findIndices(target: string, captions: Caption[], minIndex: number = -1): number[] {
  return captions.reduce<number[]>((acc, cap, idx) => {
    const word = normalize(cap.text);
    if (word === target && idx > minIndex) {
      acc.push(idx);
    }
    return acc;
  }, []);
}

/**
 * Create segments based on segment definitions and transcript captions.
 * Implements multiple fallback strategies to locate segment boundaries.
 */
export function createSegments(
  captions: Caption[],
  defs: SegmentDef[]
): Segment[] {
  const segments: Segment[] = [];
  const videoEndMs = captions[captions.length - 1]?.endMs ?? 0;
  let segmentStart = 0;
  let lastUsedIdx = -1;

  for (let i = 0; i < defs.length; i++) {
    const currentSegment = defs[i];
    const nextSegment = defs[i + 1];
    let endMs: number;
    
    if (nextSegment) {
      // Extract boundary words
      const endWord = getLastWord(currentSegment.text);
      const secondLastWord = getSecondLastWord(currentSegment.text);
      const nextFirstWord = getFirstWord(nextSegment.text);

      const endIndices = findIndices(endWord, captions, lastUsedIdx);
      const nextIndices = findIndices(nextFirstWord, captions, lastUsedIdx);

      let boundaryIdx: number | undefined;

      // 1. Perfect match: endWord immediately followed by nextFirstWord
      for (const idx of endIndices) {
        console.log("Fallback 1: endWord", endWord, "nextFirstWord", nextFirstWord, "idx", idx, "captions[idx + 1].text", captions[idx + 1].text);
        if (nextIndices.includes(idx + 1)) {
          boundaryIdx = idx;
          break;
        }
      }
      // 2. Fallback: secondLastWord then endWord contiguous
      if (boundaryIdx === undefined && secondLastWord) {
        const secondIndices = findIndices(secondLastWord, captions, lastUsedIdx);
        for (const idx of secondIndices) {
          console.log("Fallback 2: secondLastWord", secondLastWord, "endWord", endWord, "idx", idx, "captions[idx + 1].text", normalize(captions[idx + 1].text));
          if (normalize(captions[idx + 1].text) === endWord) {
            boundaryIdx = idx;
            break;
          }
        }
      }

      //3. Fallback if secondLastword and then some word and then nextFirstWord
      if (boundaryIdx === undefined && secondLastWord && nextFirstWord) {
        const secondIndices = findIndices(secondLastWord, captions, lastUsedIdx);
        for (const idx of secondIndices) {
          console.log("Fallback 3: secondLastWord", secondLastWord, "endWord", endWord, "idx", idx, "captions[idx + 2].text", normalize(captions[idx + 2].text));
          if (normalize(captions[idx + 2].text) === nextFirstWord) {
            boundaryIdx = idx;
            break;
          }
        }
      }

      if (boundaryIdx === undefined) {
        console.log("No boundary found for segment", currentSegment.text);
        throw new Error(`No boundary found for segment ${currentSegment.text}`);
      }
      endMs = captions[boundaryIdx].endMs;
      lastUsedIdx = boundaryIdx;
    } else {
      // Last segment spans to end of video
      endMs = videoEndMs;
    }

    segments.push({ startMs: segmentStart, endMs });

    if (nextSegment) {
      const startIdx = captions.findIndex(
        (c, idx) => idx > lastUsedIdx && normalize(c.text) === getFirstWord(nextSegment.text)
      );
      const candidateStart = startIdx >= 0 ? captions[startIdx].startMs : endMs;
      segmentStart = Math.max(candidateStart, endMs);
    }
  }

  return segments;
}
