import https from "https";
import { URL } from "url";
/**
 * The Generate() function is assumed to be defined elsewhere in your code base.
 * It wraps node-llama-cpp (or any other LLM runtime) and returns the model's
 * raw string response.
 */
import { generate } from "./LLMGeneration"; // adjust the relative path as needed

/**
 * JSON schema produced by the LLM
 */
export interface ImageSearch {
  /**
   * Timestamp in milliseconds where the image should first appear.
   */
  start: number;
  /**
   * (Optional) Timestamp in milliseconds when the image should disappear.
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
"Given a spoken‑word transcript with word‑level millisecond timestamps",
"(e.g. “10230ms Mothman …”), choose moments where a still image would",
"meaningfully illustrate what is being discussed.",

"Goals",
"• Frequent coverage: aim for one image every ~5000ms.",
"• Relevance: focus on salient nouns, named entities, and high-salience terms.",
"• Searchability: write queries 1-4 words long; avoid over-specific",
"  details (e.g. “Loch Ness Monster” good, “grainy 1934 Nessie photo” bad).",
"• Brevity: omit filler words (“the”, “an”, “of”, etc.) in queries.",

"Rules",
"1. Parse all “<number>ms <word>” tokens.",
"2. Build contiguous spans so that",
"   • span duration >= 3000ms and <= 5000ms, and",
"   • any gap between successive spans <= 1000ms.",
"   (If a final snippet would be <3000ms, merge it with the previous span.)",
"3. Each span's query should summarize the most salient concept(s)",
"   **within that span**; if no new salient term appears, reuse the last one.",
"4. Stop once you have covered the entire transcript.",
"5. Output JSON **array only** (no prose, markdown, or extra keys) matching:",
"   [{ \"start\": <ms>, \"end\": <ms|null>, \"query\": <string> }, …]",

"Examples",
"INPUT  ▶  \"0ms Bitcoin … 4000ms in 2010 … 9000ms Satoshi Nakamoto …\"",
"OUTPUT ▶  [{\"start\":0,\"end\":5000,\"query\":\"Bitcoin logo\"},",
"           {\"start\":5000,\"end\":10000,\"query\":\"Satoshi Nakamoto\"}]",
"",
"INPUT  ▶  \"0ms The Loch Ness Monster … 5000ms many skeptics …\"",
"OUTPUT ▶  [{\"start\":0,\"end\":8000,\"query\":\"Loch Ness Monster\"}]",
"",
"TRANSCRIPT:",
    transcript.trim(),
    "",
  ].join("\n");
}

/**
 * Public helper — converts a raw transcript string into structured image‑search
 * cues by invoking the local LLM.
 */
export async function getImageSearchTerms(transcript: string): Promise<ImageSearch[]> {
  const prompt = buildPrompt(transcript);
  const raw    = await generate(prompt);
  console.log("raw", raw);
  try {
    const parsed = JSON.parse(raw);
    console.log("parsed", parsed);
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

// Result type: only start, end, and image_url (all times in milliseconds)
export interface ImageSearchResult {
  start: number | null;
  end: number | null;
  image_url: string | null;
}

/**
 * Fetches images for each search term using the Google Custom Search API.
 */
export async function getImages(transcript: string): Promise<ImageSearchResult[]> {
  const terms = await getImageSearchTerms(transcript);
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    console.warn("Missing GOOGLE_API_KEY or SEARCH_ENGINE_ID environment variables, skipping image fetch.");
    return terms.map(() => ({ start: null, end: null, image_url: null }));
  }
  const baseUrl = "https://www.googleapis.com/customsearch/v1";
  const results = await Promise.all(
    terms.map(async (term) => {
      const url = new URL(baseUrl);
      url.searchParams.append("key", apiKey);
      url.searchParams.append("cx", cx);
      url.searchParams.append("searchType", "image");
      url.searchParams.append("q", term.query);
      try {
        const data = await new Promise<{ items?: { link?: string }[] }>((resolve, reject) => {
          https.get(url, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              if (res.statusCode && res.statusCode >= 400) {
                return reject(new Error(`Google Image Search API error: ${res.statusCode} ${res.statusMessage}`));
              }
              try {
                resolve(JSON.parse(body) as { items?: { link?: string }[] });
              } catch (err) {
                reject(err);
              }
            });
          }).on("error", reject);
        });
        const image_url = data.items?.[0]?.link ?? null;
        return { start: term.start, end: term.end ?? null, image_url };
      } catch (err) {
        console.warn(`Image search failed for query "${term.query}", setting start/end to null: ${err instanceof Error ? err.message : String(err)}`);
        return { start: null, end: null, image_url: null };
      }
    })
  );
  return results;
}


