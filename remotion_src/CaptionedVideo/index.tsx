import {
  AbsoluteFill,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  Audio,
  useVideoConfig,
  random,
} from "remotion";
import { z } from "zod";
import {parseMedia} from '@remotion/media-parser';
import { getImageDimensions } from '@remotion/media-utils';
import { Caption } from "@remotion/captions";
import CaptionOverlay, { SWITCH_CAPTIONS_EVERY_MS } from "./CaptionOverlay";
import { staticFile } from "remotion";
import CharacterOverlay from '../CharacterOverlay';
import ImageOverlay from '../ImageOverlay';
import { useMemo } from "react";
import { msToFrames } from "../utils";

export const captionedVideoSchema = z.object({
  src: z.string(),
  captions: z.array(
    z.object({
      startMs: z.number(),
      endMs: z.number(),
      text: z.string(),
      timestampMs: z.number().optional(),
      confidence: z.number().optional(),
    }),
  ),
  segments: z.array(
    z.object({
      startMs: z.number(),
      endMs: z.number(),
    }),
  ),
  stewieImage: z.string(),
  peterImage: z.string(),
  backgroundVideo: z.string(),
  images: z.array(
    z.object({
      start: z.number(),
      end: z.number().nullable(),
      image_url: z.string().nullable(),
      w: z.number().nullable().optional(),
      h: z.number().nullable().optional(),
    })
  ),
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 30;

  const metadata = await parseMedia({src: staticFile(props.src), fields: {durationInSeconds: true}});
  const backgroundVideoMetadata = await parseMedia({
    src: staticFile(props.backgroundVideo),
    fields: { durationInSeconds: true },
  });

  const stewieImageMetadata = await getImageDimensions(staticFile(props.stewieImage));
  const peterImageMetadata = await getImageDimensions(staticFile(props.peterImage));

  // Fetch dimensions for each search result image
  const imagesWithMeta = await Promise.all(
    props.images.map(async (img) => {
      if (!img.image_url) {
        return { ...img, w: null, h: null };
      }
      try {
        const dims = await getImageDimensions(img.image_url);
        return { ...img, w: dims.width, h: dims.height };
      } catch (err) {
        console.warn(`Failed to get dimensions for image URL "${img.image_url}": ${err instanceof Error ? err.message : String(err)}`);
        return { ...img, w: null, h: null };
      }
    })
  );

  return {
    fps,
    durationInFrames: Math.floor((metadata.durationInSeconds ?? 0) * fps),
    props: {
      ...props,
      images: imagesWithMeta,
      backgroundVideoDurationMs: (backgroundVideoMetadata.durationInSeconds ?? 0) * 1000,
      stewieImageMetadata,
      peterImageMetadata,
    },
  };
};

export const CaptionedVideo: React.FC<{
  src: string;
  captions: Caption[];
  segments: { startMs: number; endMs: number }[];
  stewieImage: string;
  peterImage: string;
  backgroundVideo: string;
  images: { start: number; end: number | null; image_url: string | null; w?: number | null; h?: number | null }[];
  backgroundVideoDurationMs: number;
  stewieImageMetadata: { width: number; height: number };
  peterImageMetadata: { width: number; height: number };
}> = ({ src, captions, segments, stewieImage, peterImage, backgroundVideo, images, backgroundVideoDurationMs, stewieImageMetadata, peterImageMetadata }) => {
  const { fps } = useVideoConfig();

	const { videoStartFrame, videoEndFrame } = useMemo(() => {
    const backgroundDurationInFrames = msToFrames(backgroundVideoDurationMs, fps);
    // Before knowing duration, play from start
    if (backgroundDurationInFrames === 0) {
      throw new Error("Background video duration is 0");
      return { videoStartFrame: 0, videoEndFrame: 0 };
    }

    const contentDuration = captions[captions.length - 1].endMs;
    const paddedContentDurationMs = contentDuration + 2000;
    const paddedContentDurationInFrames = msToFrames(paddedContentDurationMs, fps);

    if (paddedContentDurationInFrames >= backgroundDurationInFrames) {
      return { videoStartFrame: 0, videoEndFrame: backgroundDurationInFrames };
    }
    const maxStartFrame = backgroundDurationInFrames - paddedContentDurationInFrames;
    const startFrame = Math.floor(random(maxStartFrame) * maxStartFrame);
    const endFrame = startFrame + paddedContentDurationInFrames;
    console.error("startFrame, endFrame", startFrame, endFrame);
    return { videoStartFrame: startFrame, videoEndFrame: endFrame };
  }, [backgroundVideoDurationMs, segments, fps, captions]);

  const { characterSequences, audioSequences } = useMemo(() => {
    const characterSequences: React.ReactNode[] = [];
    const audioSequences: React.ReactNode[] = [];

    for (const [i, seg] of segments.entries()) {
      const fromFrame = msToFrames(seg.startMs, fps);
      const durationInFrames = msToFrames(seg.endMs - seg.startMs, fps);
      const isStewie = i % 2 === 0;
      const charSrc = isStewie ? stewieImage : peterImage;
      const side: 'Left' | 'Right' = isStewie ? 'Left' : 'Right';
      characterSequences.push(
        <Sequence
          from={fromFrame}
          durationInFrames={durationInFrames}
        >
          <CharacterOverlay src={staticFile(charSrc)} side={side} stewieImageMetadata={stewieImageMetadata} peterImageMetadata={peterImageMetadata} />
        </Sequence>,
      );

      audioSequences.push(
        <Sequence
          from={fromFrame}
          durationInFrames={durationInFrames}
        >
          <Audio src={staticFile(src)} trimBefore={msToFrames(seg.startMs, fps)} trimAfter={msToFrames(seg.endMs, fps)} />
        </Sequence>,
      );
    }
    return { characterSequences, audioSequences };
  }, [segments, fps, stewieImage, peterImage, src]);

  const imageSequences = useMemo(() => {
    return images
      .filter((img) => img.image_url && img.w != null && img.h != null)
      .map((img, idx) => {
        const fromFrame = msToFrames(img.start, fps);
        const durationMs = img.end != null ? img.end - img.start : 5000;
        const durationInFrames = msToFrames(durationMs, fps);

        return (
          <Sequence key={`image-${idx}`} from={fromFrame} durationInFrames={durationInFrames}>
            <ImageOverlay src={img.image_url!} meta={{ w: img.w!, h: img.h! }} />
          </Sequence>
        );
      });
  }, [images, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <AbsoluteFill>
        <OffthreadVideo
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
          src={staticFile(backgroundVideo)}
          trimBefore={videoStartFrame}
          trimAfter={videoEndFrame}
        />
      </AbsoluteFill>
      {imageSequences}
      {characterSequences}
      <CaptionOverlay
        audioFile={staticFile(src)}
        captions={captions}
        combineTokensWithinMilliseconds={SWITCH_CAPTIONS_EVERY_MS}
      />
      {audioSequences}
    </AbsoluteFill>
  );
};
