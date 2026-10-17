import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshData, STORAGE_KEY } from "./model";

const provider = vi.hoisted(() => ({
  getSession: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signIn: vi.fn(),
  google: vi.fn(),
  signOut: vi.fn(),
  readProfile: vi.fn(),
  upsert: vi.fn(),
  updateUser: vi.fn(),
  unsubscribe: vi.fn(),
  onChange: null as null | ((_event: string, session: unknown) => void),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: provider.getSession,
      signUp: provider.signUp,
      resend: provider.resend,
      signInWithPassword: provider.signIn,
      signInWithOAuth: provider.google,
      signOut: provider.signOut,
      updateUser: provider.updateUser,
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
  provider.resend.mockResolvedValue({ error: null });
  provider.signIn.mockResolvedValue({ error: null });
  provider.google.mockResolvedValue({
    data: { provider: "google", url: "https://accounts.google.com/" },
    error: null,
  });
  provider.signOut.mockResolvedValue({ error: null });
  provider.updateUser.mockImplementation(async ({ data }) => ({
    data: { user: { ...session().user, user_metadata: data } },
    error: null,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("integração da conta com o cliente Supabase", () => {
  it("guarda nome e tratamento escolhidos no cadastro e permite mudá-los no perfil", async () => {
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.profileChecked).toBe(true));
    await result.current.signUp("new@example.invalid", "test-password", {
      displayName: "Ana Clara",
      treatment: "feminine",
    });
    expect(provider.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: {
            display_name: "Ana Clara",
            phrase_treatment: "feminine",
          },
        }),
      }),
    );
    await act(async () =>
      result.current.saveProfile(result.current.profile!, {
        displayName: "João",
        treatment: "masculine",
      }),
    );
    expect(result.current.phrasePreferences).toEqual({
      displayName: "João",
      treatment: "masculine",
    });
  });
  it.each([
    { data: { session: null, user: { identities: [] } }, error: null },
    { data: { session: null }, error: { code: "user_already_exists" } },
  ])(
    "reconhece conta existente na resposta do cadastro sem consultar uma lista de e-mails",
    async (response) => {
      provider.signUp.mockResolvedValue(response);
      const { useAccount } = await import("./account");
      const { result } = renderHook(useAccount);
      await waitFor(() => expect(result.current.initializing).toBe(false));
      await expect(
        result.current.signUp("test@example.invalid", "unit-test-password"),
      ).rejects.toMatchObject({ name: "AccountExistsError" });
      expect(provider.signIn).not.toHaveBeenCalled();
    },
  );
  it.each([
    [
      "signUp",
      "signUp",
      { code: "email_address_not_authorized", status: 403 },
      /liberar o serviço de e-mail/,
    ],
    [
      "signUp",
      "signUp",
      { code: "weak_password", status: 422 },
      /senha mais forte/,
    ],
    [
      "resendConfirmation",
      "resend",
      { code: "over_email_send_rate_limit", status: 429 },
      /limite de envio de e-mails/,
    ],
    [
      "signIn",
      "signIn",
      { code: "email_not_confirmed", status: 400 },
      /Reenviar confirmação/,
    ],
    [
      "signIn",
      "signIn",
      { code: "invalid_credentials", status: 400 },
      /E-mail ou senha incorretos/,
    ],
  ] as const)(
    "preserva o motivo da falha de %s",
    async (method, mock, error, message) => {
      provider[mock].mockResolvedValue({
        data: { user: null, session: null },
        error,
      });
      const { useAccount } = await import("./account");
      const { result } = renderHook(useAccount);
      await waitFor(() => expect(result.current.initializing).toBe(false));
      await expect(
        result.current[method]("new@example.invalid", "test-password"),
      ).rejects.toThrow(message);
    },
  );
  it.each(["signUp", "signIn", "resendConfirmation"] as const)(
    "traduz uma exceção de conexão durante %s",
    async (method) => {
      const mock = method === "resendConfirmation" ? "resend" : method;
      provider[mock].mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const { useAccount } = await import("./account");
      const { result } = renderHook(useAccount);
      await waitFor(() => expect(result.current.initializing).toBe(false));
      await expect(
        result.current[method]("new@example.invalid", "test-password"),
      ).rejects.toThrow(/Confira a conexão/);
    },
  );
  it("distingue um perfil ainda não verificado, erro de consulta e ausência confirmada", async () => {
    let finish!: (value: unknown) => void;
    provider.readProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.profileLoading).toBe(true);
    expect(result.current.profileChecked).toBe(false);
    await act(async () => finish({ data: null, error: { code: "network" } }));
    expect(result.current.profileLoading).toBe(false);
    expect(result.current.profileChecked).toBe(false);
    expect(result.current.profileError).toMatch(/verificar seu perfil/);
    provider.readProfile.mockResolvedValue({ data: null, error: null });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.profileChecked).toBe(true));
    expect(result.current.profile).toBeNull();
    expect(result.current.profileError).toBe("");
  });
  it("não substitui o perfil recém-salvo por uma consulta anterior atrasada", async () => {
    let finish!: (value: unknown) => void;
    provider.readProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await act(async () =>
      result.current.saveProfile({
        nickname: "novo.nick",
        style: "bolt",
        color: "blue",
        photo: null,
      }),
    );
    await act(async () => finish({ data: null, error: null }));
    expect(result.current.profile?.nickname).toBe("novo.nick");
    expect(result.current.profileChecked).toBe(true);
  });
  it("limpa dados pessoais no logout e preserva tema e dados alheios ao aplicativo", async () => {
    const personal = `${STORAGE_KEY}:account:user-a`;
    localStorage.setItem(personal, JSON.stringify(freshData()));
    localStorage.setItem(
      `${personal}:weight-sync`,
      JSON.stringify({
        version: 1,
        records: [],
        pending: [],
        guestImported: false,
      }),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData()));
    localStorage.setItem("fokus-push:user-a", "preferences");
    localStorage.setItem("fokus-trainer:theme", "dark");
    localStorage.setItem("another-app", "keep");
    sessionStorage.setItem(personal, "private");
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.profileChecked).toBe(true));
    await act(async () => result.current.signOut());
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    for (const key of [
      personal,
      `${personal}:weight-sync`,
      STORAGE_KEY,
      "fokus-push:user-a",
    ])
      expect(localStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(personal)).toBeNull();
    expect(localStorage.getItem("fokus-trainer:theme")).toBe("dark");
    expect(localStorage.getItem("another-app")).toBe("keep");
  });
  it("preserva pesos ainda não sincronizados e informa como resolver antes de sair", async () => {
    const key = `${STORAGE_KEY}:account:user-a:weight-sync`;
    const raw = JSON.stringify({
      version: 1,
      records: [],
      pending: [
        {
          date: "2026-10-17",
          kg: 72.5,
          baseVersion: 0,
          mutationId: crypto.randomUUID(),
        },
      ],
      guestImported: false,
    });
    localStorage.setItem(key, raw);
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await expect(result.current.signOut()).rejects.toThrow(/Há pesos/);
    expect(provider.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe(raw);
    expect(result.current.user).not.toBeNull();
  });
  it("não limpa dados se o Supabase recusa a saída", async () => {
    localStorage.setItem(`${STORAGE_KEY}:account:user-a`, "private");
    provider.signOut.mockResolvedValueOnce({ error: { code: "network" } });
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await expect(result.current.signOut()).rejects.toThrow(
      /Não foi possível sair/,
    );
    expect(localStorage.getItem(`${STORAGE_KEY}:account:user-a`)).toBe(
      "private",
    );
  });
  it("usa o endereço público configurado no cadastro, reenvio e Google, mesmo numa prévia local", async () => {
    vi.stubEnv("VITE_APP_URL", "https://savitzki.github.io/FokusTrainer/");
    window.history.replaceState(null, "", "/preview/?test=1#local");
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await act(async () => {
      await result.current.signUp(
        " test@example.invalid ",
        "unit-test-password",
      );
      await result.current.resendConfirmation(" test@example.invalid ");
      await result.current.signInWithGoogle();
    });
    const destination = "https://savitzki.github.io/FokusTrainer/";
    expect(provider.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: destination },
      }),
    );
    expect(provider.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "test@example.invalid",
      options: { emailRedirectTo: destination },
    });
    expect(provider.google).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ redirectTo: destination }),
      }),
    );
  });
  it("não anuncia reenvio quando o serviço de e-mail recusa a solicitação", async () => {
    provider.resend.mockResolvedValue({
      error: { code: "over_email_send_rate_limit" },
    });
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    await expect(
      result.current.resendConfirmation("test@example.invalid"),
    ).rejects.toThrow(/limite de envio de e-mails/);
  });
  it("orienta pedir um link novo quando a confirmação expira e limpa o erro da URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/FokusTrainer/#error=access_denied&error_code=otp_expired&error_description=untrusted_text",
    );
    const { useAccount } = await import("./account");
    const { result } = renderHook(useAccount);
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.authNotice).toMatch(/Reenviar confirmação/);
    expect(window.location.hash).toBe("");
  });
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
