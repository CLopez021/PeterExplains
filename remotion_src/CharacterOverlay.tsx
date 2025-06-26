import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, Img, interpolate } from 'remotion';
import { makeTransform, translateX } from '@remotion/animation-utils';

type CharacterOverlayProps = {
  src: string;
  side: 'Left' | 'Right';
};

const CharacterOverlay: React.FC<CharacterOverlayProps> = ({ src, side }) => {
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

  const imgWidth = width * 0.3;
  const margin = width * 0.05;
  const finalX = side === 'Left' ? margin : width - imgWidth - margin;
  const initialX = side === 'Left' ? -imgWidth : width + imgWidth;

  const xTransform = translateX(
    interpolate(enterProgress, [0, 1], [initialX, finalX])
  );

  return (
    <Img
      src={src}
      style={{
        position: 'absolute',
        top: height * 0.35,
        left: 0,
        transform: makeTransform([xTransform]),
        width: imgWidth,
        height: 'auto',
      }}
    />
  );
};

export default CharacterOverlay;
