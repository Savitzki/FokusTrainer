/** Only a pseudonymous bucket reaches SQL. Headers never authorize an identity. */
export async function loginSourceBucket(request: Request, secret: string) {
  // The gateway appends its hop; a caller-controlled prefix must not pick a bucket.
  const hop = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const source = hop && hop.length <= 64 && /^[\da-fA-F.:]+$/.test(hop)
    ? hop
    : "unknown";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`capibora:nickname-login:${source}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
