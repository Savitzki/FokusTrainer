// Installation-only exports; requires ImageMagick 7.
// Loading artwork and system bar/theme colors are intentionally independent.
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = fileURLToPath(
  new URL("public/brand/logo-capibora-sem-fundo.png", root),
);
const iconBackground = "#ff7900";
const temporary = await mkdtemp(join(tmpdir(), "capibora-icons-"));
const trimmed = join(temporary, "mascot.miff");
try {
  // The source has almost invisible canvas residue (alpha <= 15/255).
  // Remove that residue only in exports, then trim transparent margins.
  execFileSync("magick", [
    source,
    "-channel",
    "A",
    "-fx",
    "u<=15/255?0:u",
    "+channel",
    "-trim",
    "+repage",
    trimmed,
  ]);
  for (const [file, size, artwork, background] of [
    ["icon-192.png", 192, 184, iconBackground],
    ["icon-512.png", 512, 492, iconBackground],
    ["apple-touch-icon.png", 180, 174, iconBackground],
    // The entire trimmed silhouette fits the Android safe circle (radius 204.8).
    // Both themes use the same orange icon, independently of the splash color.
    ["maskable-512.png", 512, 364, iconBackground],
    ["maskable-light-512.png", 512, 364, iconBackground],
  ]) {
    execFileSync("magick", [
      trimmed,
      "-resize",
      `${artwork}x${artwork}`,
      "-gravity",
      "center",
      "-background",
      background,
      "-extent",
      `${size}x${size}`,
      ...(background === "none" ? [] : ["-alpha", "remove", "-alpha", "off"]),
      "-strip",
      fileURLToPath(new URL(`public/icons/${file}`, root)),
    ]);
  }
  // New physical URLs prevent launchers from reusing the old charcoal icon.
  // Keep legacy paths for existing notification clients and bookmarked favicons.
  for (const [source, target] of [
    ["icon-192.png", "capibora-orange-v3-192.png"],
    ["icon-512.png", "capibora-orange-v3-512.png"],
    ["apple-touch-icon.png", "capibora-orange-v3-apple.png"],
    ["maskable-512.png", "capibora-orange-v3-maskable.png"],
  ])
    await copyFile(
      new URL(`public/icons/${source}`, root),
      new URL(`public/icons/${target}`, root),
    );
  const artwork = await readFile(new URL("public/icons/icon-192.png", root));
  await writeFile(
    new URL("public/icon.svg", root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="Capibora"><image width="192" height="192" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${artwork.toString("base64")}"/></svg>\n`,
  );
  await copyFile(
    new URL("public/icon.svg", root),
    new URL("public/icons/capibora-orange-v3.svg", root),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
