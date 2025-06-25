import {
  AbsoluteFill,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  Audio,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import {parseMedia} from '@remotion/media-parser';
import { Caption } from "@remotion/captions";
import CaptionOverlay, { SWITCH_CAPTIONS_EVERY_MS } from "./CaptionOverlay";
import { staticFile } from "remotion";

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
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 30;
  const metadata = await parseMedia({src: props.src, fields: {durationInSeconds: true}});

  return {
    fps,
    durationInFrames: Math.floor((metadata.durationInSeconds ?? 0) * fps),
  };
};

export const CaptionedVideo: React.FC<{
  src: string;
  captions: Caption[];
  segments: { startMs: number; endMs: number }[];
}> = ({ src, captions, segments }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <AbsoluteFill>
        <OffthreadVideo style={{ objectFit: "cover" }} src={staticFile("sample-video.mp4")} />
      </AbsoluteFill>
      <CaptionOverlay
        audioFile={src}
        captions={captions}
        combineTokensWithinMilliseconds={SWITCH_CAPTIONS_EVERY_MS}
      />
      {/* Render audio in segments excluding 'fart' words */}
      {segments.map((seg, i) => {
        const fromFrame = Math.round((seg.startMs / 1000) * fps);
        const durationFrames = Math.round(((seg.endMs - seg.startMs) / 1000) * fps);
        return (
          <Sequence key={i} from={fromFrame} durationInFrames={durationFrames}>
            <Audio src={src} trimBefore={seg.startMs / 1000} trimAfter={seg.endMs / 1000} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
