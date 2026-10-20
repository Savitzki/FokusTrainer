import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { shouldPrecache } from "./offline-assets.mjs";

const root = new URL("../dist/", import.meta.url);
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collect(path) : path;
    }),
  );
  return paths.flat();
}
const { fileURLToPath } = await import("node:url");
const dist = fileURLToPath(root);
const files = (await collect(dist))
  .filter((path) => shouldPrecache(relative(dist, path).split("\\").join("/")))
  .sort();
const hash = createHash("sha256");
let totalBytes = 0;
for (const file of files) {
  hash.update(relative(dist, file));
  const content = await readFile(file);
  hash.update(content);
  totalBytes += content.length;
}
if (totalBytes > 5 * 1024 * 1024)
  throw new Error(`Cache inicial excedeu o orçamento de 5 MiB: ${totalBytes} bytes`);
const workerPath = new URL("sw.js", root);
const worker = await readFile(workerPath, "utf8");
const version = createHash("sha256")
  .update(hash.digest("hex"))
  .update(worker)
  .digest("hex")
  .slice(0, 16);
if (
  !worker.includes('"__FOKUS_PRECACHE__"') ||
  !worker.includes("__FOKUS_CACHE_VERSION__")
)
  throw new Error("Service worker sem marcadores de compilação");
await writeFile(
  workerPath,
  worker
    .replace(
      '"__FOKUS_PRECACHE__"',
      JSON.stringify(
        files.map((path) => relative(dist, path).split("\\").join("/")),
      ),
    )
    .replace("__FOKUS_CACHE_VERSION__", version),
);
console.log(`Offline: ${files.length} arquivos, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB, versão ${version}`);
