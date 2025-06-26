export const msToFrames = (ms: number, fps: number) => {
  return Math.round(ms / 1000 * fps);
};