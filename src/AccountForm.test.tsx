import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import AccountForm from "./AccountForm";
import type { Account } from "./account";
import Modal from "./Modal";
const makeAccount = () =>
  ({
    configured: true,
    user: null,
    checkEmail: vi.fn().mockResolvedValue(false),
    signUp: vi.fn().mockResolvedValue(false),
    signIn: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn(),
    resendConfirmation: vi.fn(),
  }) as unknown as Account;
async function signup(auth = makeAccount()) {
  const signedIn = vi.fn(),
    view = render(
      <AccountForm account={auth} profile={null} onSignedIn={signedIn} />,
    ),
    user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  return { auth, user, signedIn, ...view };
}
it.each(["", "inválido", "bad@example", "a".repeat(250) + "@example.com"])(
  "bloqueia e-mail inválido sem consultar: %s",
  async (email) => {
    const { auth, user } = await signup();
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: email },
    });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(auth.checkEmail).not.toHaveBeenCalled();
  },
);
it("remove erro imediatamente ao corrigir e-mail e senha, sem sucesso intermediário", async () => {
  const { auth, user } = await signup();
  await user.type(screen.getByLabelText("E-mail"), "erro");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.clear(screen.getByLabelText("E-mail"));
  await user.type(screen.getByLabelText("E-mail"), "valid@example.com");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(auth.checkEmail).toHaveBeenCalledExactlyOnceWith("valid@example.com");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Senha"), "curta");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/8 caracteres/);
  await user.type(screen.getByLabelText("Senha"), "123");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByLabelText("Seu nome")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Voltar/ }),
  ).not.toBeInTheDocument();
  expect(auth.signUp).not.toHaveBeenCalled();
});
it("deduplica cliques durante resposta lenta e avança sem outro clique", async () => {
  let resolve!: (exists: boolean) => void;
  const auth = makeAccount();
  vi.mocked(auth.checkEmail).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { user } = await signup(auth);
  await user.type(screen.getByLabelText("E-mail"), "valid@example.com");
  await user.dblClick(screen.getByRole("button", { name: "Continuar" }));
  expect(auth.checkEmail).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  await act(async () => resolve(false));
  expect(screen.getByLabelText("Senha")).toHaveFocus();
});
it("falha de rede permanece na etapa e permite repetir a consulta", async () => {
  const auth = makeAccount();
  vi.mocked(auth.checkEmail).mockRejectedValueOnce(new Error("network"));
  const { user } = await signup(auth);
  await user.type(screen.getByLabelText("E-mail"), "valid@example.com");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    /Não foi possível verificar/,
  );
  expect(auth.signUp).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByLabelText("Senha")).toBeVisible();
  expect(auth.checkEmail).toHaveBeenCalledTimes(2);
});
it("X cancela etapas não enviadas e reabre sem senha ou e-mail temporários", async () => {
  const auth = makeAccount();
  function Example() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        {open && (
          <Modal title="Cadastro" onClose={() => setOpen(false)}>
            <AccountForm account={auth} profile={null} onSignedIn={vi.fn()} />
          </Modal>
        )}
      </>
    );
  }
  const user = userEvent.setup();
  render(<Example />);
  await user.click(
    screen.getByRole("button", { name: "Quero criar uma conta" }),
  );
  await user.type(screen.getByLabelText("E-mail"), "valid@example.com");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText("Senha"), "private-password");
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  expect(auth.signUp).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Abrir" }));
  expect(screen.getByLabelText("Senha")).toHaveValue("");
  expect(screen.getByLabelText("E-mail ou @nick")).toHaveValue("");
});
it.each([true, false])(
  "cadastro com sessão emitida %s mantém contrato seguro",
  async (issued) => {
    const { auth, user, signedIn } = await signup();
    vi.mocked(auth.signUp).mockResolvedValue(issued);
    await user.type(screen.getByLabelText("E-mail"), "valid@example.com");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Senha"), "valid-password");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Seu nome"), "Ana");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(auth.signUp).toHaveBeenCalledOnce();
    if (issued) expect(signedIn).toHaveBeenCalledOnce();
    else {
      expect(signedIn).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "Confira seu e-mail" }),
      ).toBeVisible();
    }
    expect(auth.signIn).not.toHaveBeenCalled();
  },
);
