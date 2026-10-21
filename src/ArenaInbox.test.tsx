import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import ArenaInbox from "./ArenaInbox";
import Modal from "./Modal";
import { STORAGE_KEY } from "./model";
import { notifySyncWrite } from "./sync";
import { readArenaInbox, type ArenaInbox as Inbox } from "./arenaTaunts";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./backend", () => ({ accountConfigured: true, backendRpc: rpc, getBackendClient: async () => null }));
const userId = "notice-viewer";
const id = "d3701000-0000-4000-8000-000000000001";
const original = {
  id,
  sender: "friend",
  nickname: "bia",
  messageId: "online",
  text: "Vai treinar ou só ficar online?",
  pose: "judging" as const,
  createdAt: "2026-10-20T12:00:00Z",
  seen: false,
  replyTo: null,
  canReply: true,
};
const reply = {
  ...original,
  id: "d3702000-0000-4000-8000-000000000001",
  messageId: "reply-back",
  text: "Olha quem fala... quero ver você também",
  pose: "suspicious" as const,
  replyTo: id,
  canReply: false,
};
let data: Inbox;
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  data = { version: 2, muted: false, push: false, messages: [original] };
  rpc.mockReset().mockImplementation(async (name, args) => {
    if (name === "get_arena_inbox") return structuredClone(data);
    if (name === "acknowledge_arena_taunt" || name === "reply_arena_taunt") {
      data.messages = data.messages.filter((m) => m.id !== args.p_id);
      return null;
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
});
it("mostra uma notificação com remetente e arte oficial, sem caixa de recebidos", async () => {
  render(<ArenaInbox userId={userId} />);
  const notice = await screen.findByRole("dialog", {
    name: "@bia te provocou!",
  });
  expect(within(notice).getByText("@bia te provocou!")).toBeVisible();
  expect(within(notice).getByText(original.text)).toBeVisible();
  expect(notice.querySelector(".capibora-mascot")).toHaveAttribute(
    "src",
    expect.stringContaining("julgando"),
  );
  expect(
    within(notice).getByRole("button", { name: "Revidar" }),
  ).toHaveTextContent("Revidar");
  expect(screen.queryByText("Provocações")).not.toBeInTheDocument();
  expect(screen.queryByText(/recebidas|Visto/)).not.toBeInTheDocument();
});
it("o aviso permanece global ao trocar de página sem repetir consultas", async () => {
  const view = render(<ArenaInbox userId={userId} />);
  await screen.findByText(original.text);
  view.rerender(<ArenaInbox userId={userId} />);
  expect(screen.getByText(original.text)).toBeVisible();
  view.rerender(<ArenaInbox userId={userId} />);
  expect(screen.getByText(original.text)).toBeVisible();
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_arena_inbox", {
    p_version: 3,
  });
});
it("X encerra a provocação no servidor e não a mostra após reabrir", async () => {
  const view = render(<ArenaInbox userId={userId} />);
  await screen.findByText(original.text);
  await userEvent.click(
    screen.getByRole("button", { name: "Fechar janela" }),
  );
  expect(screen.queryByText(original.text)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("acknowledge_arena_taunt", { p_id: id }),
  );
  await waitFor(() =>
    expect(
      localStorage.getItem(`${STORAGE_KEY}:account:${userId}:arena-dismissals`),
    ).toBeNull(),
  );
  view.unmount();
  render(<ArenaInbox userId={userId} />);
  await waitFor(() =>
    expect(
      rpc.mock.calls.filter(([name]) => name === "get_arena_inbox").length,
    ).toBeGreaterThan(1),
  );
  expect(screen.queryByText(original.text)).not.toBeInTheDocument();
});
it("revida uma vez por clique repetido e oculta o aviso só após confirmação", async () => {
  render(<ArenaInbox userId={userId} />);
  const button = await screen.findByRole("button", {
    name: "Revidar",
  });
  await userEvent.dblClick(button);
  await waitFor(() =>
    expect(screen.queryByText(original.text)).not.toBeInTheDocument(),
  );
  expect(
    rpc.mock.calls.filter(([name]) => name === "reply_arena_taunt"),
  ).toEqual([
    ["reply_arena_taunt", { p_id: id, p_request: expect.any(String) }],
  ]);
});
it("não envia revide offline e permite tentar novamente sem duplicar a operação", async () => {
  rpc.mockImplementation(async (name, args) => {
    if (name === "get_arena_inbox") return structuredClone(data);
    if (name === "reply_arena_taunt") throw new Error("Falha de conexão");
    throw new Error(args?.p_id);
  });
  render(<ArenaInbox userId={userId} />);
  const button = await screen.findByRole("button", {
    name: "Revidar",
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  await userEvent.click(button);
  expect(
    rpc.mock.calls.filter(([name]) => name === "reply_arena_taunt"),
  ).toHaveLength(0);
  expect(screen.getByText(original.text)).toBeVisible();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  await userEvent.click(button);
  await screen.findByText("Falha de conexão");
  await userEvent.click(button);
  const calls = rpc.mock.calls.filter(([name]) => name === "reply_arena_taunt");
  expect(calls).toHaveLength(2);
  expect(calls[0][1].p_request).toBe(calls[1][1].p_request);
});
it("o revide abre modal fora da Arena, sem encadear respostas, e só fecha pelo X", async () => {
  data.messages = [reply];
  render(<ArenaInbox userId={userId} />);
  const dialog = await screen.findByRole("dialog", { name: "@bia revidou!" });
  expect(within(dialog).getByText(reply.text)).toBeVisible();
  expect(within(dialog).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(dialog);
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  expect(dialog).toBeInTheDocument();
  expect(cancel.defaultPrevented).toBe(true);
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Fechar janela" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("acknowledge_arena_taunt", {
      p_id: reply.id,
    }),
  );
  expect(rpc.mock.calls.some(([name]) => name === "reply_arena_taunt")).toBe(
    false,
  );
});
it("aguarda o formulário existente ser fechado para mostrar o revide", async () => {
  data.messages = [reply];
  const view = render(
    <>
      <Modal title="Treino" onClose={vi.fn()}>
        Em andamento
      </Modal>
      <ArenaInbox userId={userId} blocked />
    </>,
  );
  await waitFor(() => expect(rpc).toHaveBeenCalled());
  expect(
    screen.queryByRole("dialog", { name: "@bia revidou!" }),
  ).not.toBeInTheDocument();
  view.rerender(<ArenaInbox userId={userId} />);
  expect(
    await screen.findByRole("dialog", { name: "@bia revidou!" }),
  ).toBeVisible();
});
it("o fechamento offline é guardado por conta e reenviado ao reconectar", async () => {
  const view = render(<ArenaInbox userId={userId} />);
  await screen.findByText(original.text);
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Fechar janela" }),
  );
  expect(
    JSON.parse(
      localStorage.getItem(
        `${STORAGE_KEY}:account:${userId}:arena-dismissals`,
      )!,
    ),
  ).toEqual([id]);
  view.unmount();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  render(<ArenaInbox userId={userId} />);
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("acknowledge_arena_taunt", { p_id: id }),
  );
  expect(screen.queryByText(original.text)).not.toBeInTheDocument();
});
it("não repete recibos já vistos nem mostra conteúdo de cache antes de validar", async () => {
  localStorage.setItem(
    `${STORAGE_KEY}:account:${userId}:resource:get_arena_inbox:{"p_version":2}`,
    JSON.stringify(data),
  );
  let resolve!: (value: unknown) => void;
  rpc.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(<ArenaInbox userId={userId} />);
  expect(screen.queryByText(original.text)).not.toBeInTheDocument();
  await act(async () =>
    resolve({ ...data, messages: [{ ...original, seen: true }] }),
  );
  expect(screen.queryByText(original.text)).not.toBeInTheDocument();
});
it("silenciamento e nova sincronização retiram as notificações", async () => {
  render(<ArenaInbox userId={userId} />);
  await screen.findByText(original.text);
  data.muted = true;
  await act(async () => {
    notifySyncWrite(userId, "set_arena_social_preferences");
  });
  await waitFor(() =>
    expect(screen.queryByText(original.text)).not.toBeInTheDocument(),
  );
});
it("valida o contrato de revide e rejeita texto livre e cadeias de resposta", () => {
  expect(() =>
    readArenaInbox({ ...data, messages: [{ ...reply, canReply: true }] }),
  ).toThrow();
  expect(() =>
    readArenaInbox({
      ...data,
      messages: [{ ...original, text: "Texto livre" }],
    }),
  ).toThrow();
  expect(() =>
    readArenaInbox({ ...data, messages: [{ ...original, replyTo: "x" }] }),
  ).toThrow();
});

it("também aguarda modais locais da Arena, sem empilhar o perfil do amigo", async () => {
  data.messages = [reply];
  const close = vi.fn();
  const view = render(
    <>
      <Modal title="Perfil do amigo" compactHeader onClose={close}>
        Identidade
      </Modal>
      <ArenaInbox userId={userId} />
    </>,
  );
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith("get_arena_inbox", { p_version: 3 }),
  );
  await act(async () => {});
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: "Perfil do amigo" })).toBeVisible();
  view.rerender(
    <>
      <ArenaInbox userId={userId} />
    </>,
  );
  expect(
    await screen.findByRole("dialog", { name: "@bia revidou!" }),
  ).toBeVisible();
});
it("recebe a mensagem aleatória gravada no catálogo v3 sem reescrever nem sortear novamente",async()=>{
 data={version:3,muted:false,push:false,messages:[{...original,messageId:'gossip-streak',pose:'impatient',text:'EU NÃO TENHO NADA A VER COM ISSO, MAAAAS teu amigo disse que sua ofensiva é igual relacionamento ruim: nunca dura!'}]};
 render(<ArenaInbox userId={userId}/>);
 const notice=await screen.findByRole('dialog',{name:'@bia te provocou!'});
 expect(within(notice).getByText(data.messages[0].text)).toBeVisible();
 await userEvent.click(within(notice).getByRole('button',{name:'Revidar'}));
 expect(rpc).toHaveBeenCalledWith('reply_arena_taunt',{p_id:id,p_request:expect.any(String)});
});

it("apresenta uma por vez, na ordem de criação, sem substituir a mensagem em leitura", async () => {
 const next={...original,id:"d3701000-0000-4000-8000-000000000003",nickname:"caio",createdAt:"2026-10-21T12:00:00Z"};
 data.messages=[next,original];
 render(<ArenaInbox userId={userId} />);
 await screen.findByRole("dialog",{name:"@bia te provocou!"});
 data.messages.push({...original,id:"d3701000-0000-4000-8000-000000000004",nickname:"duda",createdAt:"2026-10-19T12:00:00Z"});
 await act(async()=>{notifySyncWrite(userId,"send_arena_taunt");});
 expect(screen.getByRole("dialog",{name:"@bia te provocou!"})).toBeVisible();
 await userEvent.click(screen.getByRole("button",{name:"Fechar"}));
 await screen.findByRole("dialog",{name:"@duda te provocou!"});
 expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

it("não atravessa contas ao trocar de usuário sem remontagem pelo chamador", async()=>{
 const view=render(<ArenaInbox userId={userId}/>);await screen.findByText(original.text);
 data.messages=[];view.rerender(<ArenaInbox userId="another-account"/>);
 expect(screen.queryByText(original.text)).not.toBeInTheDocument();
 await waitFor(()=>expect(rpc.mock.calls.filter(([name])=>name==="get_arena_inbox")).toHaveLength(2));
});

it("aguarda uma operação financeira sem modal antes de exibir a provocação", async()=>{
 const {registerSync}=await import("./sync");
 const flags={initialLoading:false,refreshing:false,writing:true,stale:false,error:"",errorKind:null,lastSuccess:1};
 const registration=registerSync({userId,resource:"economy",refresh:()=>{},invalidate:()=>{},status:flags});
 try {
  render(<ArenaInbox userId={userId}/>);await waitFor(()=>expect(rpc).toHaveBeenCalledWith("get_arena_inbox",{p_version:3}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  act(()=>registration.update({...flags,writing:false}));
  expect(await screen.findByRole("dialog",{name:"@bia te provocou!"})).toBeVisible();
 }finally{registration.dispose();}
});
