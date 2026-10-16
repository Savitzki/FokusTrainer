import { loadEnv } from "vite";

const config = loadEnv(process.argv[2] ?? "production", process.cwd(), "VITE_");
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
const vapidKey = (
  process.env.VITE_VAPID_PUBLIC_KEY ??
  config.VITE_VAPID_PUBLIC_KEY ??
  ""
).trim();
if (
  vapidKey &&
  (!url ||
    !key ||
    !/^[A-Za-z0-9_-]{87}=?$/.test(vapidKey) ||
    Buffer.from(vapidKey, "base64url").length !== 65 ||
    Buffer.from(vapidKey, "base64url")[0] !== 4)
)
  throw new Error(
    "VITE_VAPID_PUBLIC_KEY precisa ser a chave pública VAPID P-256, com Supabase também configurado. Nunca use a chave privada no frontend.",
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
