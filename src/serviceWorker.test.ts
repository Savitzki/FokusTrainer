import { expect, it, vi } from "vitest";
import workerSource from "../public/sw.js?raw";

const base = "https://example.invalid/FokusTrainer/";
const worker = workerSource.replace('"__FOKUS_PRECACHE__"', "[]");

function setup() {
  const entries = new Map<string, Response>();
  const fetch = vi.fn();
  const cache = {
    match: vi.fn(async (request: Request | string) =>
      entries.get(typeof request === "string" ? request : request.url)?.clone(),
    ),
    put: vi.fn(async (url: string, response: Response) => {
      entries.set(url, response.clone());
    }),
  };
  const listeners = new Map<string, (event: unknown) => void>();
  const runWorker = new Function(
    "self",
    "caches",
    "fetch",
    "URL",
    "Response",
    "AbortSignal",
    worker,
  );
  runWorker(
    {
      registration: { scope: base },
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        listeners.set(type, handler),
    },
    { open: async () => cache },
    fetch,
    URL,
    Response,
    AbortSignal,
  );
  async function request(path: string) {
    let result: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: new Request(new URL(path, base)),
      respondWith: (response: Promise<Response>) => {
        result = response;
      },
    });
    if (!result) throw new Error("Request was not handled");
    return result;
  }
  return { entries, fetch, cache, request };
}

it.each([
  "manifest.webmanifest",
  "manifest-dark.webmanifest",
  "manifest-light.webmanifest",
])(
  "busca %s atualizado online e mantém a última versão quando fica offline",
  async (path) => {
    const { entries, fetch, request } = setup();
    const stale = { theme_color: "#ffffff" };
    const current = {
      theme_color: path.includes("light") ? "#faf8f5" : "#121212",
    };
    entries.set(base + path, Response.json(stale));
    fetch.mockResolvedValueOnce(Response.json(current));
    expect(await (await request(path + "?check=1")).json()).toEqual(current);
    fetch.mockRejectedValueOnce(new TypeError("Offline"));
    expect(await (await request(path + "?check=2")).json()).toEqual(current);
  },
);

it("usa o manifesto salvo se o servidor estiver indisponível", async () => {
  const { entries, fetch, request } = setup();
  entries.set(
    base + "manifest.webmanifest",
    Response.json({ theme_color: "#121212" }),
  );
  fetch.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
  expect(await (await request("manifest.webmanifest")).json()).toEqual({
    theme_color: "#121212",
  });
});

it("entrega a configuração online mesmo se não houver espaço para atualizar o cache", async () => {
  const { fetch, cache, request } = setup();
  fetch.mockResolvedValueOnce(Response.json({ theme_color: "#121212" }));
  cache.put.mockRejectedValueOnce(new Error("Quota exceeded"));
  expect(await (await request("manifest.webmanifest")).json()).toEqual({
    theme_color: "#121212",
  });
});

it("preserva os arquivos do shell instalado no cache sem buscar outra versão online", async () => {
  const { entries, fetch, request } = setup();
  entries.set(base + "assets/current.js", new Response("installed-shell"));
  expect(await (await request("assets/current.js")).text()).toBe(
    "installed-shell",
  );
  expect(fetch).not.toHaveBeenCalled();
});
