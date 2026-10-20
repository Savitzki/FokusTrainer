// Mechanical exports of existing official artwork; requires ImageMagick 7.
// No illustration, background removal or original-file changes happen here.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = fileURLToPath(
  new URL("public/brand/logo-capibora-sem-fundo.png", root),
);
for (const [file, size, artwork, background] of [
  ["icon-192.png", 192, 168, "none"],
  ["icon-512.png", 512, 448, "none"],
  ["apple-touch-icon.png", 180, 156, "none"],
  // A square of side 288 fits fully inside the maskable safe circle (r=204.8).
  // Matching the splash background makes Android's circular mask blend in.
  ["maskable-512.png", 512, 288, "#121212"],
  ["maskable-light-512.png", 512, 288, "#faf8f5"],
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
  new URL("public/brand/web/logo-capibora-sem-fundo.webp", root),
);
await writeFile(
  new URL("public/icon.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="Capibora"><image x="12" y="12" width="168" height="168" preserveAspectRatio="xMidYMid meet" href="data:image/webp;base64,${artwork.toString("base64")}"/></svg>\n`,
);
