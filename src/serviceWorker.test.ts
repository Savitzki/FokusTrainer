import { expect, it, vi } from "vitest";
import workerSource from "../public/sw.js?raw";

const base = "https://example.invalid/FokusTrainer/";
const tauntId = "d3701000-0000-4000-8000-000000000001";
const tauntTag = `capibora-taunt-${tauntId}`;
const worker = workerSource.replace('"__FOKUS_PRECACHE__"', "[]");

function setup(
  windows: {
    url: string;
    focus?: ReturnType<typeof vi.fn>;
    navigate?: ReturnType<typeof vi.fn>;
    visibilityState?: string;
    postMessage?: ReturnType<typeof vi.fn>;
  }[] = [],
) {
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
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const listeners = new Map<string, (event: unknown) => void>();
  const clients = {
    matchAll: vi.fn().mockResolvedValue(windows),
    openWindow: vi.fn().mockResolvedValue(undefined),
  };
  const runWorker = new Function(
    "self",
    "caches",
    "fetch",
    "URL",
    "Response",
    "AbortSignal",
    "clients",
    "MessageChannel",
    worker,
  );
  runWorker(
    {
      registration: { scope: base, showNotification },
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        listeners.set(type, handler),
    },
    { open: async () => cache },
    fetch,
    URL,
    Response,
    AbortSignal,
    clients,
    class TestMessageChannel {
      port1 = { onmessage: null as null | ((event: {data:unknown})=>void), onmessageerror: null, close: vi.fn() };
      port2 = { close: vi.fn(), postMessage: (data: unknown) => this.port1.onmessage?.({data}) };
    },
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
  return {
    entries,
    fetch,
    cache,
    request,
    listeners,
    showNotification,
    clients,
  };
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

it("recupera JS e CSS públicos mesmo quando o host usa Vary: Origin", async () => {
  const { fetch, cache, request } = setup();
  cache.match.mockImplementationOnce(async (_request, options?: CacheQueryOptions) =>
    options?.ignoreVary ? new Response("installed-module") : undefined,
  );
  expect(await (await request("assets/current.js")).text()).toBe("installed-module");
  expect(fetch).not.toHaveBeenCalled();
});

it("não intercepta dados privados do Supabase ou operações de escrita", () => {
  const { listeners } = setup();
  for (const request of [
    new Request("https://backend.invalid/rest/v1/profiles"),
    new Request(base + "rpc", { method: "POST" }),
  ]) {
    const respondWith = vi.fn();
    listeners.get("fetch")!({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
});

it("usa Capibora no push sem payload e mantém origem, ícones e deduplicação existentes", async () => {
  const { listeners, showNotification } = setup();
  let pending: Promise<unknown> | undefined;
  listeners.get("push")!({
    data: null,
    waitUntil: (value: Promise<unknown>) => {
      pending = value;
    },
  });
  await pending;
  expect(showNotification).toHaveBeenCalledWith(
    "Capibora",
    expect.objectContaining({
      body: "Abra a Capibora para acompanhar seus treinos.",
      icon: base + "icons/icon-192.png",
      badge: base + "icons/notification-badge.png",
      vibrate: [120, 60, 120],
      tag: "fokus-push",
      data: { url: base },
    }),
  );
});

it("leva o aviso de grupo à Arena na janela existente em vez de apenas focar uma página incorreta", async () => {
  const target = {
    url: base + "#/peso",
    navigate: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn(),
  };
  const { listeners, clients } = setup([target]);
  let pending!: Promise<unknown>;
  listeners.get("notificationclick")!({
    notification: { tag: "fokus-group-event", close: vi.fn() },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
  expect(target.navigate).toHaveBeenCalledWith(base + "#/arena?aba=groups");
  expect(target.focus).toHaveBeenCalledOnce();
  expect(clients.openWindow).not.toHaveBeenCalled();
});
it("abre o registro de peso numa nova janela e rejeita destinos externos recebidos", async () => {
  const { listeners, clients } = setup();
  let pending!: Promise<unknown>;
  listeners.get("notificationclick")!({
    notification: {
      tag: "fokus-2026-10-19-weight",
      data: { url: "https://external.invalid/" },
      close: vi.fn(),
    },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
  expect(clients.openWindow).toHaveBeenCalledWith(base + "#/peso");
});
it("não renavega se o aviso já corresponde à tela aberta", async () => {
  const target = { url: base, navigate: vi.fn(), focus: vi.fn() };
  const { listeners } = setup([target]);
  let pending!: Promise<unknown>;
  listeners.get("notificationclick")!({
    notification: { tag: "fokus-reminder", close: vi.fn() },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
  expect(target.focus).toHaveBeenCalledOnce();
  expect(target.navigate).not.toHaveBeenCalled();
});
it("preserva título e corpo aprovados e associa o push social à Arena", async () => {
  const { listeners, showNotification } = setup();
  let pending!: Promise<unknown>;
  listeners.get("push")!({
    data: {
      json: () => ({
        title: "IH, OLHA LÁ 👀",
        body: "Seu amigo já treinou hoje",
        tag: "fokus-group-event",
      }),
    },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
  expect(showNotification).toHaveBeenCalledWith(
    "IH, OLHA LÁ 👀",
    expect.objectContaining({
      body: "Seu amigo já treinou hoje",
      data: { url: base + "#/arena?aba=groups" },
    }),
  );
});
it("abre o aplicativo para a provocação sem aceitar destinos externos", async () => {
  const { listeners, clients } = setup();
  let pending!: Promise<unknown>;
  listeners.get("notificationclick")!({
    notification: {
      tag: "capibora-taunt-fixture",
      data: { url: "https://external.invalid" },
      close: vi.fn(),
    },
    waitUntil: (p: Promise<unknown>) => {
      pending = p;
    },
  });
  await pending;
  expect(clients.openWindow).toHaveBeenCalledWith(base);
});

it("o push de provocação é genérico e usa somente a Capibora julgando",async()=>{
 const {listeners,showNotification}=setup();let pending!:Promise<unknown>;
 listeners.get("push")!({data:{json:()=>({title:"@private",body:"private phrase",tag:"capibora-taunt-fixture"})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 expect(showNotification).toHaveBeenCalledWith("Capibora",expect.objectContaining({body:"Psiu, alguém mandou uma provocação",icon:base+"mascot/web/julgando.webp",data:{url:base}}));
 const options=showNotification.mock.calls[0][1]; expect(options).not.toHaveProperty("actions");expect(options).not.toHaveProperty("image");
});
it("somente a confirmação específica da conta visível evita o aviso do sistema",async()=>{
 const target={url:base+"#/peso",visibilityState:"visible",postMessage:vi.fn((_message, ports: MessagePort[])=>ports[0].postMessage({received:true}))};
 const {listeners,showNotification}=setup([target]);let pending!:Promise<unknown>;
 listeners.get("push")!({data:{json:()=>({tag:tauntTag})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 expect(target.postMessage).toHaveBeenCalledWith({type:"capibora:taunt-push",id:tauntId},[expect.anything()]);expect(showNotification).not.toHaveBeenCalled();
});
it("uma janela em segundo plano ou de outro aplicativo não impede o push",async()=>{
 const {listeners,showNotification}=setup([{url:base,visibilityState:"hidden"},{url:"https://other.invalid/",visibilityState:"visible"}]);let pending!:Promise<unknown>;
 listeners.get("push")!({data:{json:()=>({tag:"capibora-taunt-fixture"})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 expect(showNotification).toHaveBeenCalledOnce();
});

it("janela visível sem conta ou sem confirmação mantém a entrega do sistema",async()=>{
 vi.useFakeTimers();
 try{
  const target={url:base,visibilityState:"visible",postMessage:vi.fn()};const {listeners,showNotification}=setup([target]);let pending!:Promise<unknown>;
  listeners.get("push")!({data:{json:()=>({tag:tauntTag})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});
  await vi.advanceTimersByTimeAsync(1200);await pending;
  expect(showNotification).toHaveBeenCalledWith("Capibora",expect.objectContaining({body:"Psiu, alguém mandou uma provocação"}));
 }finally{vi.useRealTimers();}
});
it("uma janela confirmada basta entre várias janelas, sem descartar mensagens não recebidas",async()=>{
 vi.useFakeTimers();
 try{
  const received={url:base+"#/loja",visibilityState:"visible",postMessage:vi.fn((_message,ports:MessagePort[])=>ports[0].postMessage({received:true}))};
  const {listeners,showNotification}=setup([{url:base,visibilityState:"visible",postMessage:vi.fn()},received]);let pending!:Promise<unknown>;
  listeners.get("push")!({data:{json:()=>({tag:tauntTag})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});
  await vi.advanceTimersByTimeAsync(1200);await pending;expect(showNotification).not.toHaveBeenCalled();
 }finally{vi.useRealTimers();}
});
it("falha ao localizar ou avisar janelas mantém o push genérico",async()=>{
 const {listeners,showNotification,clients}=setup();clients.matchAll.mockRejectedValue(new Error("Unavailable"));let pending!:Promise<unknown>;
 listeners.get("push")!({data:{json:()=>({tag:tauntTag})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;expect(showNotification).toHaveBeenCalledOnce();
});
it("um documento da mesma origem fora da aplicação não suprime o push",async()=>{
 const target={url:base+"docs/index.html",visibilityState:"visible",postMessage:vi.fn()};const {listeners,showNotification}=setup([target]);let pending!:Promise<unknown>;
 listeners.get("push")!({data:{json:()=>({tag:tauntTag})},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 expect(target.postMessage).not.toHaveBeenCalled();expect(showNotification).toHaveBeenCalledOnce();
});
it("tocar na provocação preserva formulário, rota e histórico da janela aberta",async()=>{
 const target={url:base+"#/treinos",focus:vi.fn(),navigate:vi.fn(),postMessage:vi.fn()};const {listeners,clients}=setup([target]);let pending!:Promise<unknown>;
 listeners.get("notificationclick")!({notification:{tag:tauntTag,data:{url:base},close:vi.fn()},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 expect(target.navigate).not.toHaveBeenCalled();expect(target.focus).toHaveBeenCalledOnce();expect(clients.openWindow).not.toHaveBeenCalled();
 expect(target.postMessage).toHaveBeenCalledExactlyOnceWith({type:"capibora:taunt-push"});
});
