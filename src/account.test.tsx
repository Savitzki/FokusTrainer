import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  getSession: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  google: vi.fn(),
  signOut: vi.fn(),
  readProfile: vi.fn(),
  upsert: vi.fn(),
  unsubscribe: vi.fn(),
  onChange: null as null | ((_event: string, session: unknown) => void),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: provider.getSession,
      signUp: provider.signUp,
      signInWithPassword: provider.signIn,
      signInWithOAuth: provider.google,
      signOut: provider.signOut,
      onAuthStateChange: (callback: typeof provider.onChange) => {
        provider.onChange = callback;
        return {
          data: { subscription: { unsubscribe: provider.unsubscribe } },
        };
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: provider.readProfile }) }),
      upsert: provider.upsert,
    }),
  }),
}));
const session = (id = "user-a") => ({
  user: { id, email: "test@example.invalid" },
});
const row = {
  nickname: "dani.treina",
  avatar_color: "orange",
  avatar_style: "initials",
  avatar_photo: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_for_unit_tests");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ external: { google: true } })),
  );
  provider.getSession.mockResolvedValue({
    data: { session: session() },
    error: null,
  });
  provider.readProfile.mockResolvedValue({ data: row, error: null });
  provider.upsert.mockResolvedValue({ error: null });
  provider.signUp.mockResolvedValue({ data: { session: null }, error: null });
  provider.signIn.mockResolvedValue({ error: null });
  provider.google.mockResolvedValue({
    data: { provider: "google", url: "https://accounts.google.com/" },
    error: null,
  });
  provider.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("integração da conta com o cliente Supabase", () => {
  it("mantém o usuário no app e explica quando o provedor Google não foi habilitado", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ external: { google: false } }),
    );
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await expect(result.current.signInWithGoogle()).rejects.toThrow(
      /ainda está sendo ativado/,
    );
    expect(provider.google).not.toHaveBeenCalled();
  });
  it("abre o Google sem senha do FokusTrainer e retorna à subpasta do app", async () => {
    window.history.replaceState(null, "", "/FokusTrainer/?source=test#social");
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(provider.google).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/FokusTrainer/`,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    });
    expect(provider.signIn).not.toHaveBeenCalled();
    expect(provider.signUp).not.toHaveBeenCalled();
  });
  it("trata falha ao abrir o Google sem exibir detalhes internos do provedor", async () => {
    provider.google.mockResolvedValue({
      error: { message: "internal detail" },
    });
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await expect(result.current.signInWithGoogle()).rejects.toThrow(
      /Não foi possível abrir o Google/,
    );
  });
  it("informa cancelamento do login e limpa os erros da URL sem expor a descrição recebida", async () => {
    window.history.replaceState(
      null,
      "",
      "/FokusTrainer/?source=keep#error=access_denied&error_description=untrusted_text",
    );
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.authNotice).toMatch(/entrada foi cancelada/);
    expect(result.current.authNotice).not.toContain("untrusted_text");
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?source=keep");
    await act(async () => {
      result.current.dismissAuthNotice();
    });
    expect(result.current.authNotice).toBe("");
  });
  it("carrega o perfil e salva sempre com o ID da sessão, sem senha no perfil", async () => {
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() =>
      expect(result.current.profile?.nickname).toBe("dani.treina"),
    );
    await act(async () => {
      await result.current.saveProfile({
        nickname: "novo.nick",
        style: "bolt",
        color: "blue",
        photo: null,
      });
    });
    expect(provider.upsert).toHaveBeenCalledWith({
      id: "user-a",
      nickname: "novo.nick",
      avatar_style: "bolt",
      avatar_color: "blue",
      avatar_photo: null,
    });
    expect(result.current.profile?.nickname).toBe("novo.nick");
  });
  it("aguarda confirmação de e-mail quando o cadastro não abre uma sessão", async () => {
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    let signedIn: boolean | undefined;
    await act(async () => {
      signedIn = await result.current.signUp(
        " test@example.invalid ",
        "unit-test-password",
      );
    });
    expect(signedIn).toBe(false);
    expect(provider.signUp).toHaveBeenCalledWith({
      email: "test@example.invalid",
      password: "unit-test-password",
      options: { emailRedirectTo: expect.any(String) },
    });
  });
  it("não expõe o perfil de uma conta ao trocar de sessão", async () => {
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() =>
      expect(result.current.profile?.nickname).toBe("dani.treina"),
    );
    provider.readProfile.mockResolvedValue({ data: null, error: null });
    await act(async () => {
      provider.onChange?.("SIGNED_IN", session("user-b"));
    });
    expect(result.current.user?.id).toBe("user-b");
    expect(result.current.profile).toBeNull();
    await act(async () => {
      await result.current.signOut();
    });
    expect(provider.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("exibe falhas de acesso sem afirmar que o perfil foi salvo", async () => {
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() =>
      expect(result.current.profile?.nickname).toBe("dani.treina"),
    );
    provider.upsert.mockResolvedValue({ error: { code: "42501" } });
    await expect(
      result.current.saveProfile({
        nickname: "novo.nick",
        style: "bolt",
        color: "blue",
        photo: null,
      }),
    ).rejects.toThrow(/Não foi possível salvar/);
    expect(result.current.profile?.nickname).toBe("dani.treina");
  });
});
