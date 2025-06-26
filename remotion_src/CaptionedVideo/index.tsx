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
import { Caption } from "@remotion/captions";
import CaptionOverlay, { SWITCH_CAPTIONS_EVERY_MS } from "./CaptionOverlay";
import { staticFile } from "remotion";
import CharacterOverlay from '../CharacterOverlay';
import { useMemo, useState, useEffect } from "react";
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
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 30;
  const metadata = await parseMedia({src: staticFile(props.src), fields: {durationInSeconds: true}});

  return {
    fps,
    durationInFrames: Math.floor((metadata.durationInSeconds ?? 0) * fps),
  };
};

export const CaptionedVideo: React.FC<{
  src: string;
  captions: Caption[];
  segments: { startMs: number; endMs: number }[];
  stewieImage: string;
  peterImage: string;
  backgroundVideo: string;
}> = ({ src, captions, segments, stewieImage, peterImage, backgroundVideo }) => {
  const { fps } = useVideoConfig();
	const [backgroundVideoDurationMs, setBackgroundVideoDurationMs] = useState(0);

	useEffect(() => {
    const getDuration = async () => {
      const meta = await parseMedia({
        src: staticFile(backgroundVideo),
        fields: { durationInSeconds: true },
      });
      setBackgroundVideoDurationMs(meta.durationInSeconds ?? 0 * 1000);
    };
    getDuration();
  }, [backgroundVideo]);

	const { videoStartFrame, videoEndFrame } = useMemo(() => {
    if (backgroundVideoDurationMs === 0 || segments.length === 0) {
      return { videoStartFrame: 0, videoEndFrame: undefined };
    }

    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) {
      return { videoStartFrame: 0, videoEndFrame: 0 };
    }

    const contentDuration = lastSegment.endMs;
    const paddedContentDurationMs = contentDuration + 2000;
    const paddedContentDurationInFrames = msToFrames(paddedContentDurationMs, fps);

    const backgroundDurationInFrames = msToFrames(backgroundVideoDurationMs, fps);

    if (paddedContentDurationInFrames >= backgroundDurationInFrames) {
      return { videoStartFrame: 0, videoEndFrame: backgroundDurationInFrames };
    }

    // const maxStartFrame = backgroundDurationInFrames - paddedContentDurationInFrames;
    const startFrame =msToFrames(random(backgroundVideoDurationMs-paddedContentDurationMs), fps);
    const endFrame = startFrame + paddedContentDurationInFrames;

    return { videoStartFrame: startFrame, videoEndFrame: endFrame };
  }, [backgroundVideoDurationMs, segments, fps]);

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
          <CharacterOverlay src={staticFile(charSrc)} side={side} />
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

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <AbsoluteFill>
        <OffthreadVideo
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
