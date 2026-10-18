import { expect, it } from "vitest";
import {
  FRAME_IMAGES,
  SHARE_STYLES,
  THEME_STYLES,
  themeVariables,
  knownCosmetic,
} from "./cosmetics";
function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
it("mantém contraste legível nas cores de todos os temas e dos cards", () => {
  for (const item of Object.values(THEME_STYLES))
    for (const mode of ["dark", "light"] as const) {
      const [accent, text, soft] = item[mode];
      expect(contrast(accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(text, soft)).toBeGreaterThanOrEqual(4.5);
    }
  for (const style of Object.values(SHARE_STYLES)) {
    expect(contrast(style.ink, style.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.muted, style.background)).toBeGreaterThanOrEqual(4.5);
  }
});
it("associa as nove imagens a molduras utilizáveis e recusa produtos sem renderer", () => {
  expect(Object.keys(FRAME_IMAGES)).toHaveLength(9);
  for (const id of Object.keys(FRAME_IMAGES))
    expect(knownCosmetic(id, "frame")).toBe(true);
  expect(knownCosmetic("inexistente", "frame")).toBe(false);
  expect(knownCosmetic("futura", "selos")).toBe(false);
  expect(themeVariables(undefined, "dark")).toEqual({});
});
