export class InvalidJsonRequest extends Error {
  constructor() {
    super("Invalid JSON request");
  }
}

/** Bound bytes and reading time even for chunked bodies without Content-Length. */
export async function readLimitedJson(
  request: Request,
  maxBytes: number,
  timeoutMs = 5000,
): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    void request.body?.cancel().catch(() => {});
    throw new InvalidJsonRequest();
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidJsonRequest();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let complete = false;
  try {
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new InvalidJsonRequest()), timeoutMs);
    });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new InvalidJsonRequest();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    complete = true;
    return result;
  } catch {
    // Never include credentials, user content or parser errors in responses/logs.
    throw new InvalidJsonRequest();
  } finally {
    clearTimeout(timer);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
