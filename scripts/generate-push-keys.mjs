import { generateKeyPairSync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");
writeFileSync(
  ".env.push-secrets",
  `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${jwk.d}\nVAPID_SUBJECT=mailto:seu-email@example.com\nPUSH_CRON_SECRET=${randomBytes(32).toString("base64url")}\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Chaves salvas em .env.push-secrets (ignorado pelo Git). Edite VAPID_SUBJECT e configure os segredos no Supabase. Copie somente VAPID_PUBLIC_KEY para a variável pública do site.",
);
