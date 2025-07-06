import React from "react";
import { Img, useVideoConfig } from "remotion";

const MAX_HEIGHT_PERCENTAGE = 0.40;
// ImageOverlay displays an image within the top 24% of the video frame, preserving aspect ratio
const ImageOverlay: React.FC<{ src: string; meta: { w: number; h: number } }> = ({ src, meta }) => {
  const { width: videoWidth, height: videoHeight } = useVideoConfig();
  const { w: originalWidth, h: originalHeight } = meta;
  const aspectRatio = originalWidth / originalHeight;
  const padding = videoHeight * 0.05;
  const maxHeight = videoHeight * MAX_HEIGHT_PERCENTAGE - 2 * padding;
  const maxWidth = videoWidth;
  // Scale based on maxHeight first, then cap at maxWidth
  const widthBasedOnHeight = maxHeight * aspectRatio;
  console.error("widthBasedOnHeight", widthBasedOnHeight);
  const widthScaled = Math.min(maxWidth, widthBasedOnHeight);
  const heightScaled = widthScaled / aspectRatio;
  const left = (videoWidth - widthScaled) / 2;
  const top = padding;

  return (
    <Img
      src={src}
      style={{
        position: "absolute",
        top,
        left,
        width: widthScaled,
        height: heightScaled,
      }}
    />
  );
};

export default ImageOverlay;
