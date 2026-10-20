// Delivery copies only: preserve official originals, framing and transparency.
// Requires ImageMagick 7. Generated WebP files are committed for reproducible CI.
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../public/", import.meta.url);
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
