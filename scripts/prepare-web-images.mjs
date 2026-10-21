// Delivery copies only: preserve official originals, framing and transparency.
// Requires ImageMagick 7. Generated WebP files are committed for reproducible CI.
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../public/", import.meta.url);
// Newly registered official expressions; originals remain byte-for-byte unchanged.
if (process.argv.includes("--mascot")) {
  for (const name of ["empolgada", "deboa", "tedio"]) {
    await mkdir(new URL("mascot/web/", root), { recursive: true });
    execFileSync("magick", [
      fileURLToPath(new URL(`mascot/${name}.png`, root)),
      "-channel",
      "A",
      "-fx",
      "u<=15/255?0:u",
      "+channel",
      "-trim",
      "+repage",
      "-resize",
      "320x320>",
      "-strip",
      "-define",
      "webp:alpha-quality=100",
      "-quality",
      "82",
      fileURLToPath(new URL(`mascot/web/${name}.webp`, root)),
    ]);
    console.log(`mascot/web/${name}.webp`);
  }
  process.exit(0);
}
// Arena artwork: delivery copies keep the original drawings intact and remove
// transparent canvas only, so the illustration is legible in a compact banner.
for (const [source, destination] of [
  ["images/capi-group.png", "images/web/capi-group.webp"],
  ["mascot/capi-sosa.png", "mascot/web/capi-sosa.webp"],
]) {
  await mkdir(new URL("./", new URL(destination, root)), { recursive: true });
  execFileSync("magick", [
    fileURLToPath(new URL(source, root)),
    "-channel",
    "A",
    "-fx",
    "u<=15/255?0:u",
    "+channel",
    "-trim",
    "+repage",
    "-resize",
    "640x480>",
    "-strip",
    "-define",
    "webp:alpha-quality=100",
    "-quality",
    "82",
    fileURLToPath(new URL(destination, root)),
  ]);
  console.log(destination);
}
const images = [
  ["images/capiwhey.png", "images/web/capiwhey.webp", 128],
  ["images/capi-kit-medico.png", "images/web/capi-kit-medico.webp", 192],
  ...["faixa-esportiva", "onda-aquatica", "chama-viva", "classica"].map(
    (name) => [
      `images/shop/frames/${name}.png`,
      `images/shop/frames/web/${name}.webp`,
      512,
    ],
  ),
  ...["entardecer", "floresta", "noite", "churrasco"].map((name) => [
    `images/shop/banners/${name}.png`,
    `images/shop/banners/web/${name}.webp`,
    1024,
  ]),
];
for (const [source, destination, size] of images) {
  const target = new URL(destination, root);
  await mkdir(new URL("./", target), { recursive: true });
  execFileSync("magick", [
    fileURLToPath(new URL(source, root)),
    "-resize",
    `${size}x${size}>`,
    "-strip",
    "-define",
    "webp:alpha-quality=100",
    "-quality",
    "82",
    fileURLToPath(target),
  ]);
  console.log(destination);
}
