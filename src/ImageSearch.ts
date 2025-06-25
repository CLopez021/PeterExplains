import path from "path";
import fs from "fs";

/**
 * The Generate() function is assumed to be defined elsewhere in your code base.
 * It wraps node‑llama‑cpp (or any other LLM runtime) and returns the model’s
 * raw string response.
 */
import { generate } from "./LLMGeneration"; // adjust the relative path as needed

/**
 * JSON schema produced by the LLM
 */
export interface ImageSearch {
  /**
   * Timestamp in seconds where the image should first appear.
   */
  start: number;
  /**
   * (Optional) Timestamp in seconds when the image should disappear.
   * Omit or set to null if the image may persist until the next cue.
   */
  end?: number | null;
  /**
   * Search phrase to feed to Google CSE / Openverse / Flickr etc.
   */
  query: string;
}

/**
 * Builds the system prompt that instructs the model how to turn a transcript
 * into time‑aligned image‑search queries. The model must answer **only** with
 * JSON conforming to the ImageSearch[] schema — no markdown, no prose.
 */
function buildPrompt(transcript: string): string {
  return [
    "You are an expert video‑illustration assistant.",
    "Given a spoken‑word transcript that includes word‑level timestamps (e.g. “00:10:23 Mothman …”), decide which moments should be illustrated with a still image.",
    "Rules:",
    "1. Group words into 10‑second blocks (0–10 s, 10–20 s, …).",
    "2. Pick **up to two** high‑salience nouns or named entities (proper nouns, places, events, mythological creatures, conspiracy terms) from *each* block.",
    "   • Ignore fillers, verbs, pronouns.",
    "   • Prefer rarer terms: e.g. ‘Mothman’, ‘Freemasons’, ‘Roswell UFO crash’.",
    "3. Turn each chosen term into a concise search phrase suitable for an image API (max 5 words).",
    "4. Return an array of objects with this exact JSON schema (no markdown):",
    "   [{ \"start\": <seconds>, \"end\": <seconds|null>, \"query\": <string> }, …]",
    "   • start = beginning of the 10‑second block (integer).",
    "   • end   = end of the block (start+10) or null if unknown.",
    "5. Do NOT include any other keys, comments, or text outside the JSON.",
    "\nTRANSCRIPT:\n" + transcript.trim(),
  ].join("\n");
}

/**
 * Public helper — converts a raw transcript string into structured image‑search
 * cues by invoking the local LLM.
 */
export async function getImageSearchTerms(transcript: string): Promise<ImageSearch[]> {
  const prompt = buildPrompt(transcript);
  const raw    = await generate(prompt);

  try {
    const parsed = JSON.parse(raw);
    // Basic validation — ensure every item has the required keys.
    if (!Array.isArray(parsed)) throw new Error("Model did not return an array");
    parsed.forEach((item, i) => {
      if (typeof item.start !== "number" || typeof item.query !== "string") {
        throw new Error(`Invalid schema at index ${i}`);
      }
    });
    return parsed as ImageSearch[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse LLM output as JSON → ${message}\nRaw:\n${raw}`);
  }
}

/* --------------------------------------------------------------------------
 * Example usage (remove or adapt in production)
 * ------------------------------------------------------------------------*/
if (require.main === module) {
  (async () => {
    const transcriptPath = process.argv[2];
    if (!transcriptPath) {
      console.error("Usage: ts-node imageQueryGenerator.ts <transcript.txt>");
      process.exit(1);
    }
    const transcript = fs.readFileSync(path.resolve(transcriptPath), "utf8");
    const terms = await getImageSearchTerms(transcript);
    console.log(JSON.stringify(terms, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}


