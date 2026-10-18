import type { MascotPose } from "./capiboraVoice";
export const MASCOT_POSES: MascotPose[] = [
  "neutral",
  "judging",
  "suspicious",
  "happy",
  "resting",
  "tired",
  "celebrating",
  "impatient",
  "running",
  "training",
];
export type MascotAsset = {
  src: string;
  animatedSrc?: string;
  durationMs?: number;
};
/** Only supplied official art. Compatible expressions reuse the same file; missing poses render nothing. */
export const MASCOT_ASSETS: Partial<Record<MascotPose, MascotAsset>> = {
  neutral: { src: "mascot/web/neutro.webp" },
  judging: { src: "mascot/web/julgando.webp" },
  suspicious: { src: "mascot/web/julgando.webp" },
  impatient: { src: "mascot/web/julgando.webp" },
  happy: { src: "mascot/web/feliz.webp" },
  resting: { src: "mascot/web/chill.webp" },
  celebrating: { src: "mascot/web/wink.webp" },
  training: { src: "mascot/web/determinado.webp" },
};
