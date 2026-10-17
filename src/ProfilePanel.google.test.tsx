import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ProfilePanel from "./ProfilePanel";
import type { Account } from "./account";
import { AccountExistsError } from "./accountErrors";

function account() {
  return {
    configured: true,
    initializing: false,
    user: null,
    homeState: null,
    phrasePreferences: { displayName: "", treatment: "neutral" as const },
    profile: null,
    profileLoading: false,
    profileChecked: false,
    profileError: "",
    error: "",
    authNotice: "",
    dismissAuthNotice: vi.fn(),
    retry: vi.fn(),
    signUp: vi.fn(),
    resendConfirmation: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn(),
  } satisfies Account;
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
  await user.click(screen.getByRole("button", { name: "Cadastro / entrar" }));
  await user.type(screen.getByLabelText("E-mail"), "test@example.invalid");
  await user.type(screen.getByLabelText("Senha"), "test-password");
  await user.selectOptions(
    screen.getByRole("combobox", { name: /De qual estado/ }),
    "SP",
  );
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    /já tem uma conta/,
  );
  expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  expect(screen.getByLabelText("E-mail")).toHaveValue("test@example.invalid");
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
  await user.click(screen.getByRole("button", { name: "Cadastro / entrar" }));
  await user.type(screen.getByLabelText("E-mail"), "new@example.invalid");
  await user.type(screen.getByLabelText("Senha"), "test-password");
  await user.selectOptions(
    screen.getByRole("combobox", { name: /De qual estado/ }),
    "SP",
  );
  await user.type(screen.getByLabelText("Seu nome"), "Marina");
  await user.selectOptions(
    screen.getByLabelText("Tratamento nas frases"),
    "feminine",
  );
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(auth.signUp).toHaveBeenCalledWith(
    "new@example.invalid",
    "test-password",
    "SP",
    { displayName: "Marina", treatment: "feminine" },
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    /Confira seu e-mail/,
  );
  expect(
    screen.getByRole("button", { name: "Criar conta" }),
  ).toBeInTheDocument();
});
it("reenvia a confirmação com e-mail válido sem exigir senha", async () => {
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
  await user.click(screen.getByRole("button", { name: "Cadastro / entrar" }));
  await user.click(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(auth.resendConfirmation).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("E-mail"), "test@example.invalid");
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
  await user.click(screen.getByRole("button", { name: "Cadastro / entrar" }));
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
  await user.click(screen.getByRole("button", { name: "Cadastro / entrar" }));
  await user.click(
    screen.getByRole("button", { name: "Continuar com Google" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível abrir o Google.",
  );
  expect(
    screen.getByRole("button", { name: "Continuar com Google" }),
  ).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Já tenho conta" }));
  expect(
    screen.getByRole("button", { name: "Continuar com Google" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Senha")).toBeRequired();
});
