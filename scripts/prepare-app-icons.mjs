// Installation-only exports; requires ImageMagick 7.
// Loading artwork and system bar/theme colors are intentionally independent.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = fileURLToPath(
  new URL("public/brand/logo-capibora-sem-fundo.png", root),
);
const iconBackground = "#ff7900";
for (const [file, size, artwork, background] of [
  ["icon-192.png", 192, 180, iconBackground],
  ["icon-512.png", 512, 480, iconBackground],
  ["apple-touch-icon.png", 180, 170, iconBackground],
  // The head fits the Android safe circle; avoid the old oversized padding.
  // Both themes use the same orange icon, independently of the splash color.
  ["maskable-512.png", 512, 384, iconBackground],
  ["maskable-light-512.png", 512, 384, iconBackground],
]) {
  execFileSync("magick", [
    source,
    "-resize", `${artwork}x${artwork}`,
    "-gravity", "center",
    "-background", background,
    "-extent", `${size}x${size}`,
    ...(background === "none" ? [] : ["-alpha", "remove", "-alpha", "off"]),
    "-strip",
    fileURLToPath(new URL(`public/icons/${file}`, root)),
  ]);
}
const artwork = await readFile(
  new URL("public/icons/icon-192.png", root),
);
await writeFile(
  new URL("public/icon.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="Capibora"><image width="192" height="192" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${artwork.toString("base64")}"/></svg>\n`,
);
