import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig, Audio } from "remotion";
import { Caption, createTikTokStyleCaptions } from "@remotion/captions";
import SubtitlePage from "./CaptionedVideo/SubtitlePage";

export const SWITCH_CAPTIONS_EVERY_MS = 200;

const CaptionOverlay: React.FC<{
  audioFile: string;
  captions: Caption[];
  combineTokensWithinMilliseconds: number;
}> = ({ audioFile, captions, combineTokensWithinMilliseconds }) => {
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        combineTokensWithinMilliseconds,
        captions,
      }),
    [captions],
  );

  return (
    <AbsoluteFill>
      <Audio src={audioFile} />
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const subtitleStartFrame = (page.startMs / 1000) * fps;
        const subtitleEndFrame = Math.min(
          nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
          subtitleStartFrame + combineTokensWithinMilliseconds,
        );
        const durationInFrames = subtitleEndFrame - subtitleStartFrame;
        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            key={index}
            from={subtitleStartFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitlePage key={index} page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default CaptionOverlay; 