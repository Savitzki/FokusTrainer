import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { Account } from "./account";
import {
  EmailConfirmationNotice,
  ProfileCompletionNotice,
} from "./EntryNotices";
const account = () =>
  ({
    user: { id: "a", email: "private@example.invalid" },
    resendConfirmation: vi.fn().mockResolvedValue(undefined),
  }) as unknown as Account;
afterEach(() => vi.useRealTimers());
it("mantém e-mail pendente e mensagem exata do perfil juntos, sem expor o endereço", async () => {
  const auth = account(),
    open = vi.fn();
  render(
    <>
      <EmailConfirmationNotice account={auth} />
      <ProfileCompletionNotice onOpen={open} />
    </>,
  );
  expect(
    screen.getByRole("heading", { name: "Confirme seu e-mail" }),
  ).toBeVisible();
  expect(screen.getByText("Nova mensagem: Capibora")).toBeVisible();
  expect(
    screen.getByText("Complete se perfil, me diga como devo te chamar"),
  ).toBeVisible();
  expect(screen.queryByText(auth.user!.email!)).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Nova mensagem: Capibora/ }),
  );
  expect(open).toHaveBeenCalledOnce();
});
it("reenvia uma vez, aplica espera local e desaparece ao reconhecer confirmação", async () => {
  const auth = account(),
    view = render(<EmailConfirmationNotice account={auth} />);
  await userEvent.dblClick(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(auth.resendConfirmation).toHaveBeenCalledExactlyOnceWith(
    "private@example.invalid",
  );
  expect(
    screen.getByRole("button", { name: "Aguarde para reenviar" }),
  ).toBeDisabled();
  view.rerender(
    <EmailConfirmationNotice
      account={{
        ...auth,
        user: { ...auth.user!, email_confirmed_at: "2026-10-20T12:00:00Z" },
      }}
    />,
  );
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
it("a espera termina sem polling de consultas", async () => {
  vi.useFakeTimers();
  const auth = account();
  render(<EmailConfirmationNotice account={auth} />);
  await act(async () =>
    screen.getByRole("button", { name: "Reenviar confirmação" }).click(),
  );
  await act(async () => vi.advanceTimersByTime(60000));
  expect(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  ).toBeEnabled();
  expect(auth.resendConfirmation).toHaveBeenCalledOnce();
});
it("respeita erro de limite do servidor sem anunciar envio", async () => {
  const auth = account();
  vi.mocked(auth.resendConfirmation).mockRejectedValue(
    new Error("O limite de envio de e-mails foi atingido"),
  );
  render(<EmailConfirmationNotice account={auth} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Reenviar confirmação" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/limite/);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it.each([
  null,
  { id: "a" },
  {
    id: "a",
    email: "private@example.invalid",
    email_confirmed_at: "2026-10-20T12:00:00Z",
  },
])("não apresenta aviso sem e-mail pendente: %j", (user) => {
  render(
    <EmailConfirmationNotice account={{ ...account(), user } as Account} />,
  );
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
