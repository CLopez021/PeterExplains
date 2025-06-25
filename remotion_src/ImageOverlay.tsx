import React from "react";
import { Img, useVideoConfig } from "remotion";

const height_placement = 0.3;
const width_placement = 0.5;
const size_percentage = 0.3;
const ImageOverlay: React.FC<{ src: string }> = ({ src }) => {
  const { width, height } = useVideoConfig();
  return (
    <Img
      src={src}
      style={{
        position: "absolute",
        top: height * height_placement,
        left: width * width_placement,
        transform: "translateX(-50%)",
        width: width * size_percentage,
        height: "auto",
      }}
    />
  );
};

export default ImageOverlay;
