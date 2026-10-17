import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ProfilePanel from "./ProfilePanel";
import type { Account } from "./account";

function account() {
  return {
    configured: true,
    initializing: false,
    user: null,
    profile: null,
    profileLoading: false,
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
