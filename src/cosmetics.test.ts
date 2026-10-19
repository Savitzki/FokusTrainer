import { expect, it } from "vitest";
import {
  FRAME_IMAGES,
  FRAME_LAYOUT,
  frameArtworkStyle,
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
it("associa as quatro imagens a molduras utilizáveis e recusa produtos sem renderer", () => {
  expect(Object.keys(FRAME_IMAGES)).toHaveLength(4);
  for (const id of Object.keys(FRAME_IMAGES))
    expect(knownCosmetic(id, "frame")).toBe(true);
  expect(knownCosmetic("inexistente", "frame")).toBe(false);
  expect(knownCosmetic("futura", "selos")).toBe(false);
  expect(themeVariables(undefined, "dark")).toEqual({});
});

it("ajusta cada abertura oficial sem alterar a caixa circular do avatar", () => {
  for (const id of Object.keys(FRAME_IMAGES)) {
    const layout = FRAME_LAYOUT[id];
    expect(layout.scale).toBeGreaterThan(1);
    expect(layout.scale).toBeLessThan(1.6);
    expect(layout.left).toBeLessThan(0);
    expect(layout.top).toBeLessThan(0);
    expect(frameArtworkStyle(id)).toMatchObject({
      right: "auto",
      bottom: "auto",
    });
  }
  expect(frameArtworkStyle("frame-energy")).toBeUndefined();
  expect(FRAME_LAYOUT["frame-water-wave"].left).not.toBe(
    FRAME_LAYOUT["frame-classic"].left,
  );
});

it.each([32, 44, 72, 112])(
  "centraliza a abertura da Onda Aquática sobre a foto de %ipx",
  (size) => {
    // Opposite inner edges measured in the official 1254px artwork.
    const layout = FRAME_LAYOUT["frame-water-wave"];
    const width = size * layout.scale,
      height = size * (layout.heightScale ?? layout.scale);
    const centerX = size * layout.left + width * (640 / 1254);
    const centerY = size * layout.top + height * (610.5 / 1254);
    expect(centerX).toBeCloseTo(size / 2, 2);
    expect(centerY).toBeCloseTo(size / 2, 2);
    expect((width * (1132 - 148)) / 1254).toBeCloseTo(size, 2);
    expect((height * (1068 - 153)) / 1254).toBeCloseTo(size, 2);
  },
);
