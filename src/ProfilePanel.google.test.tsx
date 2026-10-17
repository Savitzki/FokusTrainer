import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ProfilePanel from "./ProfilePanel";
import type { Account } from "./account";
import { AccountAuthError, AccountExistsError } from "./accountErrors";

function account() {
  return {
    configured: true,
    initializing: false,
    user: null,
    phrasePreferences: { displayName: "", treatment: "neutral" as const },
    profile: null,
    profileLoading: false,
    profileChecked: false,
    profileError: "",
    error: "",
    authNotice: "",
    dismissAuthNotice: vi.fn(),
    retry: vi.fn(),
    checkNickname: vi
      .fn()
      .mockResolvedValue({ valid: true, available: true, suggestions: [] }),
    checkEmail: vi.fn().mockResolvedValue(false),
    signUp: vi.fn(),
    resendConfirmation: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn(),
  } satisfies Account;
}
async function advance(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}
async function fillSignup(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
) {
  const create = screen.queryByRole("button", {
    name: "Quero criar uma conta",
  });
  if (create) await user.click(create);
  await user.type(screen.getByLabelText(/^E-mail/), email);
  await advance(user);
  await user.type(screen.getByLabelText("Senha"), "test-password");
  await advance(user);
  await user.type(screen.getByLabelText("Seu nome"), "Marina");
  await advance(user);
  await user.selectOptions(screen.getByLabelText("Sexo"), "feminine");
}
it("leva uma conta existente ao login, mantém o e-mail e pede a senha novamente", async () => {
  const user = userEvent.setup();
  const auth = account();
  auth.signUp.mockRejectedValueOnce(new AccountExistsError());
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
  await fillSignup(user, "test@example.invalid");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    /já tem uma conta/,
  );
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue("test@example.invalid");
  expect(screen.getByLabelText("Senha")).toHaveValue("");
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(auth.signIn).not.toHaveBeenCalled();
});
it("mantém uma conta nova no cadastro até a confirmação do e-mail", async () => {
  const user = userEvent.setup();
  const auth = account();
  auth.signUp.mockResolvedValueOnce(false);
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
  await fillSignup(user, "new@example.invalid");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(auth.signUp).toHaveBeenCalledWith(
    "new@example.invalid",
    "test-password",
    { displayName: "Marina", treatment: "feminine" },
  );
  expect(
    await screen.findByRole("heading", { name: "Confira seu e-mail" }),
  ).toHaveFocus();
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(auth.resendConfirmation).toHaveBeenCalledWith("new@example.invalid");
});
it("reenvia a confirmação com e-mail válido sem exigir senha", async () => {
  const user = userEvent.setup();
  const auth = account();
  auth.checkEmail.mockResolvedValue(true);
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
  await user.click(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(auth.resendConfirmation).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText(/^E-mail/), "test@example.invalid");
  await user.click(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(auth.resendConfirmation).toHaveBeenCalledWith("test@example.invalid");
  expect(await screen.findByRole("status")).toHaveTextContent(
    /cadastro pendente/,
  );
  expect(auth.signUp).not.toHaveBeenCalled();
});
it("permite entrar com Google sem preencher os campos obrigatórios de e-mail e senha", async () => {
  const user = userEvent.setup();
  const auth = account();
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
  await user.click(
    screen.getByRole("button", { name: "Continuar com Google" }),
  );
  expect(auth.signInWithGoogle).toHaveBeenCalledOnce();
  expect(auth.signUp).not.toHaveBeenCalled();
  expect(auth.signIn).not.toHaveBeenCalled();
});
it("oferece nova tentativa com Google ou e-mail quando a conexão falha", async () => {
  const user = userEvent.setup();
  const auth = account();
  auth.checkEmail.mockResolvedValue(true);
  auth.signInWithGoogle.mockRejectedValueOnce(
    new Error("Não foi possível abrir o Google."),
  );
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Entrar na conta" }));
  await user.click(
    screen.getByRole("button", { name: "Continuar com Google" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível abrir o Google.",
  );
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(
    screen.getByRole("button", { name: "Continuar com Google" })
      .nextElementSibling,
  ).toBe(screen.getByRole("alert"));
  expect(
    screen.getByRole("button", { name: "Continuar com Google" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Continuar com Google" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Senha")).toBeRequired();
  await user.type(screen.getByLabelText(/^E-mail/), "login@example.invalid");
  await user.type(screen.getByLabelText("Senha"), "secret");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(auth.signIn).toHaveBeenCalledWith("login@example.invalid", "secret");
});
it("mostra uma informação por etapa, preserva valores ao voltar e só cadastra no final", async () => {
  const user = userEvent.setup();
  const auth = account();
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
      initialTab="account"
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  await advance(user);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^E-mail/)).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^E-mail/), "steps@example.invalid");
  await advance(user);
  expect(screen.getByLabelText("Senha")).toHaveFocus();
  expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Senha"), "test-password");
  await advance(user);
  await user.type(screen.getByLabelText("Seu nome"), "Ana123");
  await advance(user);
  expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/Use até 40 caracteres/);
  await user.clear(screen.getByLabelText("Seu nome"));
  await user.type(screen.getByLabelText("Seu nome"), "Ana");
  await advance(user);
  await user.selectOptions(screen.getByLabelText("Sexo"), "masculine");
  await user.click(
    screen.getByRole("button", { name: "Voltar à etapa anterior" }),
  );
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Ana");
  await advance(user);
  expect(screen.getByLabelText("Sexo")).toHaveValue("masculine");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(auth.signUp).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(auth.signUp).toHaveBeenCalledExactlyOnceWith(
    "steps@example.invalid",
    "test-password",
    { displayName: "Ana", treatment: "masculine" },
  );
});

it("valida e-mail e senha na própria etapa, com mensagens acessíveis", async () => {
  const user = userEvent.setup();
  const auth = account();
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
      initialTab="account"
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  await user.type(screen.getByLabelText(/^E-mail/), "ana@servidor");
  await advance(user);
  expect(screen.getByRole("alert")).toHaveTextContent(/e-mail está correto/);
  expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText(/^E-mail/));
  await user.type(
    screen.getByLabelText(/^E-mail/),
    "ana+treino@example.invalid",
  );
  await advance(user);
  await user.type(screen.getByLabelText("Senha"), "curta");
  await advance(user);
  expect(screen.getByRole("alert")).toHaveTextContent(
    /pelo menos 8 caracteres/,
  );
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(auth.signUp).not.toHaveBeenCalled();
});

it.each([
  ["password", "Senha", "Essa senha foi recusada. Use uma senha mais forte"],
  ["email", "E-mail", "Confira se o e-mail está correto"],
] as const)(
  "volta ao campo %s quando o serviço recusa os dados, preservando as outras etapas",
  async (field, label, message) => {
    const user = userEvent.setup();
    const auth = account();
    auth.signUp
      .mockRejectedValueOnce(new AccountAuthError(message, field))
      .mockResolvedValueOnce(false);
    render(
      <ProfilePanel
        profile={null}
        account={auth}
        onSaveLocal={vi.fn()}
        onSaved={vi.fn()}
        initialTab="account"
      />,
    );
    await fillSignup(user, "new@example.invalid");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText(label)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(label)).toHaveValue(
      field === "email" ? "new@example.invalid" : "test-password",
    );
    await user.clear(screen.getByLabelText(label));
    await user.type(
      screen.getByLabelText(label),
      field === "email" ? "fixed@example.invalid" : "a-stronger-password",
    );
    await advance(user);
    if (field === "email") {
      expect(screen.getByLabelText("Senha")).toHaveValue("test-password");
      await advance(user);
    }
    expect(screen.getByLabelText("Seu nome")).toHaveValue("Marina");
    await advance(user);
    expect(screen.getByLabelText("Sexo")).toHaveValue("feminine");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(
      await screen.findByRole("heading", { name: "Confira seu e-mail" }),
    ).toBeInTheDocument();
    expect(auth.signUp).toHaveBeenLastCalledWith(
      field === "email" ? "fixed@example.invalid" : "new@example.invalid",
      field === "password" ? "a-stronger-password" : "test-password",
      { displayName: "Marina", treatment: "feminine" },
    );
  },
);

it("mantém os dados após falha do serviço e permite tentar novamente sem anunciar sucesso", async () => {
  const user = userEvent.setup();
  const auth = account();
  const onSaved = vi.fn();
  auth.signUp
    .mockRejectedValueOnce(
      new AccountAuthError("O limite de envio de e-mails foi atingido"),
    )
    .mockResolvedValueOnce(false);
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={onSaved}
      initialTab="account"
    />,
  );
  await fillSignup(user, "retry@example.invalid");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/limite de envio/);
  expect(screen.getByRole("alert")).toHaveFocus();
  expect(
    screen.queryByRole("heading", { name: "Confira seu e-mail" }),
  ).not.toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(auth.signUp).toHaveBeenNthCalledWith(
    2,
    "retry@example.invalid",
    "test-password",
    { displayName: "Marina", treatment: "feminine" },
  );
  expect(
    await screen.findByRole("heading", { name: "Confira seu e-mail" }),
  ).toBeInTheDocument();
});

it("verifica o e-mail antes de avançar e abre login sem tentar cadastrar ou enviar mensagens", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.checkEmail.mockResolvedValue(true);
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  await user.type(screen.getByLabelText(/^E-mail/), "Existing@Example.com");
  await advance(user);
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue("Existing@Example.com");
  expect(screen.getByLabelText("Senha")).toHaveValue("");
  expect(auth.checkEmail).toHaveBeenCalledWith("existing@example.com");
  expect(auth.signUp).not.toHaveBeenCalled();
  expect(auth.resendConfirmation).not.toHaveBeenCalled();
});
it("ao terminar de digitar um e-mail existente, muda para login mesmo sem tocar em Continuar", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.checkEmail.mockResolvedValue(true);
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  await user.type(screen.getByLabelText(/^E-mail/), "existing@example.com");
  expect(
    await screen.findByRole("button", { name: "Entrar" }),
  ).toBeInTheDocument();
  expect(auth.signUp).not.toHaveBeenCalled();
});
it("uma falha na consulta do e-mail permite corrigir ou tentar novamente, sem criar conta", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.checkEmail.mockRejectedValueOnce(new Error("offline"));
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText(/^E-mail/), "new@example.com");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível verificar o e-mail",
  );
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue("new@example.com");
  expect(auth.signUp).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
});

it("ignora a resposta de um e-mail anterior quando o endereço é corrigido", async () => {
  const auth = account(),
    user = userEvent.setup();
  let finish!: (exists: boolean) => void;
  auth.checkEmail.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  await user.type(screen.getByLabelText(/^E-mail/), "old@example.com");
  await screen.findByText("Conferindo e-mail…");
  await user.clear(screen.getByLabelText(/^E-mail/));
  await user.type(screen.getByLabelText(/^E-mail/), "new@example.com");
  finish(true);
  await advance(user);
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  expect(
    screen.queryByText("Este e-mail já tem uma conta. Entre para continuar"),
  ).not.toBeInTheDocument();
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("abre direto no login e mantém a senha de uma conta existente após verificar o e-mail", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.checkEmail.mockResolvedValue(true);
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(
    screen.queryByRole("button", { name: "Continuar" }),
  ).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/^E-mail/), "existing@example.com");
  await user.type(screen.getByLabelText("Senha"), "my-password");
  await waitFor(() =>
    expect(auth.checkEmail).toHaveBeenCalledWith("existing@example.com"),
  );
  expect(screen.getByLabelText("Senha")).toHaveValue("my-password");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(auth.signIn).toHaveBeenCalledExactlyOnceWith(
    "existing@example.com",
    "my-password",
  );
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("um e-mail novo no login abre automaticamente o cadastro com o endereço preservado", async () => {
  const auth = account(),
    user = userEvent.setup();
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText(/^E-mail/), "new@example.com");
  expect(
    await screen.findByText(
      "Este e-mail ainda não tem conta. Vamos criar a sua",
    ),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  expect(screen.getByLabelText("Senha")).toHaveFocus();
  expect(auth.signIn).not.toHaveBeenCalled();
  expect(auth.signUp).not.toHaveBeenCalled();
  expect(auth.resendConfirmation).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Voltar à etapa anterior" }),
  );
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue("new@example.com");
});

it("ao tocar rápido em Entrar com e-mail novo, encaminha ao cadastro antes de exigir senha", async () => {
  const auth = account(),
    user = userEvent.setup();
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText(/^E-mail/), "new@example.com");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(auth.checkEmail).toHaveBeenCalledExactlyOnceWith("new@example.com");
  expect(auth.signIn).not.toHaveBeenCalled();
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("ignora uma resposta atrasada de e-mail novo quando a pessoa corrige para uma conta existente", async () => {
  const auth = account(),
    user = userEvent.setup();
  let finish!: (exists: boolean) => void;
  auth.checkEmail.mockResolvedValue(true).mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText(/^E-mail/), "old@example.com");
  await screen.findByText("Conferindo e-mail…");
  await user.clear(screen.getByLabelText(/^E-mail/));
  await user.type(screen.getByLabelText(/^E-mail/), "existing@example.com");
  finish(false);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(screen.getByLabelText(/^E-mail/)).toHaveValue("existing@example.com");
  expect(screen.getByLabelText("Senha")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Preencha sua senha");
  expect(
    screen.queryByText("Este e-mail ainda não tem conta. Vamos criar a sua"),
  ).not.toBeInTheDocument();
  expect(auth.signIn).not.toHaveBeenCalled();
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("entra com nick sem consultar e-mail e mantém o cadastro por e-mail disponível", async () => {
  const auth = account(),
    user = userEvent.setup();
  render(
    <ProfilePanel
      initialTab="account"
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("E-mail ou @nick"), "@Dani");
  await user.type(screen.getByLabelText("Senha"), "test-password");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect(auth.checkEmail).not.toHaveBeenCalled();
  expect(auth.signIn).toHaveBeenCalledWith("@Dani", "test-password");
});
