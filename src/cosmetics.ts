import type { CSSProperties } from "react";
export const FRAME_STYLES: Record<
  string,
  { color: string; line: "solid" | "double" | "dashed" | "dotted" }
> = {
  "frame-ember": { color: "#f18343", line: "solid" },
  "frame-gold": { color: "#d69c39", line: "solid" },
  "frame-champion": { color: "#d69c39", line: "double" },
  "frame-energy": { color: "#f5c553", line: "dashed" },
  "frame-night": { color: "#8d91b6", line: "double" },
  "frame-neon": { color: "#71d7be", line: "solid" },
  "frame-hardcore": { color: "#ae6459", line: "double" },
  "frame-delicate": { color: "#e4a1b7", line: "dotted" },
  "frame-fokus": { color: "#f47b37", line: "double" },
};
export const EMOJIS: Record<string, string> = {
  "emoji-fire": "🔥",
  "emoji-strong": "💪",
  "emoji-cool": "😎",
  "emoji-clap": "👏",
  "emoji-energy": "⚡",
  "emoji-brain": "🧠",
  "emoji-trophy": "🏆",
  "emoji-rocket": "🚀",
  "emoji-eyes": "👀",
  "emoji-salute": "🫡",
  "emoji-heart": "❤️",
};
export type SharePalette = {
  background: string;
  accent: string;
  ink: string;
  muted: string;
  pattern: "plain" | "border" | "diagonal" | "stripes" | "horizon" | "stars";
};
export const SHARE_STYLES: Record<string, SharePalette> = {
  classic: {
    background: "#211b18",
    accent: "#ff8a4c",
    ink: "#fff7ef",
    muted: "#e3cec0",
    pattern: "plain",
  },
  "share-ember": {
    background: "#43251d",
    accent: "#ff9b65",
    ink: "#fff7ef",
    muted: "#eed2c3",
    pattern: "plain",
  },
  "share-champion": {
    background: "#332819",
    accent: "#ffc75e",
    ink: "#fff7ef",
    muted: "#ead8b8",
    pattern: "border",
  },
  "share-impact": {
    background: "#271d16",
    accent: "#ffb03b",
    ink: "#fff7ed",
    muted: "#ead7c0",
    pattern: "diagonal",
  },
  "share-night": {
    background: "#161927",
    accent: "#b2b9ff",
    ink: "#f3f2ff",
    muted: "#c5c9e6",
    pattern: "stars",
  },
  "share-dawn": {
    background: "#f8e8d3",
    accent: "#a74019",
    ink: "#38251c",
    muted: "#6c4c3c",
    pattern: "horizon",
  },
  "share-beast": {
    background: "#2c2118",
    accent: "#fbb660",
    ink: "#fff3df",
    muted: "#e4cbb2",
    pattern: "stripes",
  },
  "share-ice": {
    background: "#dfedf1",
    accent: "#235974",
    ink: "#183747",
    muted: "#3f6170",
    pattern: "diagonal",
  },
  "share-minimal": {
    background: "#171717",
    accent: "#dedede",
    ink: "#ffffff",
    muted: "#c2c2c2",
    pattern: "border",
  },
  "share-fokus": {
    background: "#351f17",
    accent: "#ff995b",
    ink: "#fff4eb",
    muted: "#ebc6af",
    pattern: "border",
  },
};
export const THEME_STYLES: Record<string, { dark: string[]; light: string[] }> =
  {
    "theme-copper": {
      dark: ["#b44d18", "#ffa879", "#3d2c22"],
      light: ["#b44d18", "#9c4318", "#f9e9dc"],
    },
    "theme-fokus": {
      dark: ["#c54812", "#ffac70", "#422b1c"],
      light: ["#bd410c", "#a43e10", "#fff0df"],
    },
    "theme-energy": {
      dark: ["#7846bd", "#cbb0ff", "#332342"],
      light: ["#7846bd", "#673398", "#f0e5fa"],
    },
    "theme-progress": {
      dark: ["#26704c", "#9cddba", "#203a2b"],
      light: ["#26704c", "#236344", "#e2f1e8"],
    },
    "theme-power": {
      dark: ["#a82d65", "#f4b4d0", "#412331"],
      light: ["#a82d65", "#942953", "#fae5ee"],
    },
  };
export function themeVariables(
  id: string | undefined,
  mode: "dark" | "light",
): CSSProperties {
  const colors = id ? THEME_STYLES[id]?.[mode] : null;
  return colors
    ? ({
        "--accent": colors[0],
        "--accent-text": colors[1],
        "--accent-soft": colors[2],
      } as CSSProperties)
    : {};
}
export function knownCosmetic(id: string, category: string) {
  return category === "frame"
    ? Boolean(FRAME_STYLES[id] || FRAME_IMAGES[id])
    : category === "share"
      ? Boolean(SHARE_STYLES[id])
      : category === "theme"
        ? Boolean(THEME_STYLES[id])
        : category === "emoji"
          ? Boolean(EMOJIS[id])
          : false;
}

export const FRAME_IMAGES: Record<string, string> = {
  "frame-energy": "energy",
  "frame-night": "royal",
  "frame-neon": "thunder",
  "frame-hardcore": "knockout",
  "frame-delicate": "pink-power",
  "frame-fokus": "blaze",
  "frame-beast": "beast",
  "frame-victory": "champion",
  "frame-king": "king",
};
export const frameImage = (id: string) =>
  FRAME_IMAGES[id]
    ? `${import.meta.env.BASE_URL}images/shop/frames/${FRAME_IMAGES[id]}.webp`
    : null;
