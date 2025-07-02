# Plan: Continuous, Dimension-Aware Image Overlays

## 1. Prompt overhaul in `src/ImageSearch.ts`

### Goals
* Generate image cues that:
  * Cover **the full runtime** – there should (almost) always be an image visible.
  * Each cue lasts **3-15 seconds** (≈ 90–450 frames @30 fps).
  * Prefer concepts that visually enrich narration.
* Return **JSON only** – array max **20** elements.

### New system prompt template
1. Explain role (video-illustration assistant).
2. Rules (enumerated):
   1. Parse transcript w/ ms timestamps.
   2. Detect salient nouns, named entities etc.
   3. Choose spans so that **consecutive images leave no gaps** larger than 1 s.
   4. Duration per span: **≥ 3000 ms & ≤ 15000 ms**.
   5. Output schema: `[ {"start": <ms>, "end": <ms>, "query": <str>} … ]` (≤ 20).
   6. No prose / markdown.
3. Provide **2 examples** – one short (single sentence) and one multi-sentence – followed by corresponding expected JSON.
4. Append `TRANSCRIPT:` + content.

*(See example section below)*

## 2. Fetch + metadata enrichment

### `getImages()`
* After obtaining `image_url` call `getImageDimensions(staticFile(image_url))` **once** in Node (not inside Remotion) to get `{width, height}`.
* Extend return type:
```ts
interface ImageSearchResult {
  start: number | null;
  end: number | null;
  image_url: string | null;
  w?: number;  // optional, null if fetch failed
  h?: number;
}
```
* If fetch or dimension probe fails → set `start = end = null` **and** `image_url = null`.

## 3. Prop plumbing

1. `src/main.ts`
   * Map dimension data into the `images` array passed to Remotion.
2. `captionedVideoSchema`
   * Update Zod to include `w` & `h` optional numbers.
3. `calculateCaptionedVideoMetadata`
   * Nothing extra (dimensions already included).

## 4. Rendering logic

### `ImageOverlay.tsx`
* Accept `{src, meta: {w,h}}` props.
* Compute aspect ratio.
* **Max rules**:
  * `maxWidth = videoWidth * 0.5`.
  * Image must stay inside **top 24 %** of height.
  * Add `const padding = height * 0.02` top & bottom.
* Scale down so that `scaledHeight ≤ 0.24*height - 2*padding` **and** `scaledWidth ≤ maxWidth`.
* Center horizontally (or slight random offset) within safe zone.

### `CaptionedVideo/index.tsx`
* Filter images with `image_url && start !== null`.
* Compute `fromFrame`, `durationInFrames` like before.
* Use `<ImageOverlay src={staticFile(url)} meta={{w,h}} />`.

## 5. Gap-filling (optional stretch goal)
* Sort cues by `start`.
* If gap > 1 s between consecutive cues, duplicate previous cue with adjusted `start/end` to fill gap.

## 6. Example prompt excerpt

```
You are an expert video-illustration assistant. …

EXAMPLE 1 INPUT:
"0ms The Loch Ness Monster is an alleged creature … 5000ms many skeptics…"
EXAMPLE 1 OUTPUT:
[
  {"start":0,"end":8000,"query":"Loch Ness Monster"}
]

EXAMPLE 2 INPUT:
"0ms Bitcoin originated… 4000ms in 2010… 9000ms Satoshi Nakamoto…"
EXAMPLE 2 OUTPUT:
[
  {"start":0,"end":7000,"query":"Bitcoin logo"},
  {"start":7000,"end":15000,"query":"Satoshi Nakamoto silhouette"}
]
```

## 7. Testing checklist
- [ ] Linter passes.
- [ ] Video renders with continuous images.
- [ ] No image overlaps character overlays.
- [ ] Handles missing/failed images gracefully.
