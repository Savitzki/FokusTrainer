/** Vite exposes VITE_* values to browsers. Fail before building with a secret. */
export function assertPublicEnvironment(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("VITE_") || !value) continue;
    let privileged = String(value).startsWith("sb_secret_");
    try {
      const payload = JSON.parse(Buffer.from(String(value).split(".")[1], "base64url").toString());
      privileged ||= payload.role === "service_role";
    } catch {
      /* Most public values are not JWTs. */
    }
    if (privileged || /(?:^|_)(?:SECRET|PRIVATE|SERVICE_ROLE|ACCESS_TOKEN|PASSWORD|DATABASE_URL)(?:_|$)/i.test(name))
      // Do not print the secret or include it in a thrown error.
      throw new Error(`${name} não pode conter credenciais privadas no frontend.`);
  }
}
