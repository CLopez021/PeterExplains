import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, Img, interpolate } from 'remotion';
import { makeTransform, translateX } from '@remotion/animation-utils';

type CharacterOverlayProps = {
  src: string;
  side: 'Left' | 'Right';
  stewieImageMetadata: { width: number; height: number };
  peterImageMetadata: { width: number; height: number };
};

const heightPlacement = 0.75;

const CharacterOverlay: React.FC<CharacterOverlayProps> = ({ src, side, stewieImageMetadata, peterImageMetadata }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const enterProgress = spring({
    frame,
    fps,
    config: {
      damping: 200,
      stiffness: 100,
    },
    durationInFrames: 10,
  });

  const metadata = side === 'Left' ? stewieImageMetadata : peterImageMetadata;
  const aspectRatio = metadata.width / metadata.height;
  const finalWidth = width * 0.6;
  const finalHeight = finalWidth / aspectRatio;
  const defaultTop = height * heightPlacement;
  let topPosition = defaultTop;
  if(defaultTop + finalHeight > height) {
    topPosition = height - finalHeight;
  }
  const margin = width * 0.05;
  const initialX = side === 'Left' ? -finalWidth : width + finalWidth;
  const finalX = side === 'Left' ? margin : width - finalWidth - margin;

  const xTransform = translateX(
    interpolate(enterProgress, [0, 1], [initialX, finalX])
  );

  return (
    <Img
      src={src}
      style={{
        position: 'absolute',
        top: topPosition,
        left: 0,
        transform: makeTransform([xTransform]),
        width: finalWidth,
        height: finalHeight,
      }}
    />
  );
};

export default CharacterOverlay;
