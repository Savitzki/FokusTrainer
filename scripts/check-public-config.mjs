import { loadEnv } from "vite";

const config = loadEnv(
  process.argv[2] ?? "production",
  process.cwd(),
  "VITE_SUPABASE_",
);
const url = (
  process.env.VITE_SUPABASE_URL ??
  config.VITE_SUPABASE_URL ??
  ""
).trim();
const key = (
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  config.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();
if (Boolean(url) !== Boolean(key))
  throw new Error(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY juntas, ou deixe ambas vazias para usar o modo local.",
  );
if (url && key) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL não é um endereço HTTPS válido.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error(
      "VITE_SUPABASE_URL precisa ser um endereço HTTPS sem credenciais.",
    );
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey && key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {
      /* Invalid key. */
    }
  }
  if (!publicKey)
    throw new Error(
      "Use somente a chave publishable (ou anon legada) do Supabase. Chaves secret e service_role não podem ir ao frontend.",
    );
}
