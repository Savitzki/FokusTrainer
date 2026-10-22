import { createHash } from "node:crypto";

const hash = (code) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`;
export function secureHtml(html, backendUrl = "") {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes))
    .map(([, , code]) => hash(code));
  const handlers = [...html.matchAll(/\son(?:load|error)="([^"]*)"/gi)].map(([, code]) => hash(code));
  const connections = ["'self'"];
  if (backendUrl) {
    const url = new URL(backendUrl);
    if (url.protocol !== "https:") throw new Error("Backend must use HTTPS");
    connections.push(url.origin, url.origin.replace(/^https:/, "wss:"));
  }
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(scripts)].join(" ")}`,
    `script-src-attr 'unsafe-hashes' ${[...new Set(handlers)].join(" ")}`,
    // React and startup theme use inline style properties, never arbitrary scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connections.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return html.replace(/<meta charset="UTF-8"\s*\/>/i, (charset) =>
    `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="no-referrer" />`);
}
