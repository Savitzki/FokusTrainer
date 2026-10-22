import { readFile, writeFile } from "node:fs/promises";
import { loadEnv } from "vite";
import { secureHtml } from "./security-policy.mjs";

const environment = loadEnv("production", process.cwd(), "VITE_");
const backendUrl = process.env.VITE_SUPABASE_URL ?? environment.VITE_SUPABASE_URL ?? "";
const index = new URL("../dist/index.html", import.meta.url);
const html = await readFile(index, "utf8");
if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error("CSP already generated");
const secured = secureHtml(html, backendUrl.trim());
if (secured === html) throw new Error("HTML charset marker not found");
await writeFile(index, secured);
console.log("Security: CSP with startup hashes and private referrer policy");
