import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import NotificationOptIn from "./NotificationOptIn";
it("explica os avisos com a mascote e só ativa no SIM", async () => {
  const enable = vi.fn().mockResolvedValue(undefined),
    decline = vi.fn(),
    dismiss = vi.fn();
  const view = render(
    <NotificationOptIn
      onEnable={enable}
      onDecline={decline}
      onDismiss={dismiss}
    />,
  );
  expect(view.container.querySelector("img.capibora-mascot")).toHaveAttribute(
    "alt",
    "",
  );
  expect(screen.getByText(/Sem cobranças/)).toBeVisible();
  expect(screen.getByRole("button", { name: "SIM" })).toHaveClass(
    "primary-button",
  );
  expect(screen.getByRole("button", { name: "NÃO" })).toHaveClass(
    "outline-button",
  );
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "SIM" }));
  await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  expect(enable).toHaveBeenCalledOnce();
  expect(decline).not.toHaveBeenCalled();
});
it("NÃO guarda a escolha sem pedir permissão", async () => {
  const enable = vi.fn(),
    decline = vi.fn().mockResolvedValue(undefined),
    dismiss = vi.fn();
  render(
    <NotificationOptIn
      onEnable={enable}
      onDecline={decline}
      onDismiss={dismiss}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "NÃO" }));
  await waitFor(() => expect(dismiss).toHaveBeenCalledOnce());
  expect(decline).toHaveBeenCalledOnce();
  expect(enable).not.toHaveBeenCalled();
});
it("bloqueia cliques duplicados e mantém o convite aberto se a ativação falhar", async () => {
  let fail!: (e: Error) => void;
  const enable = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    ),
    dismiss = vi.fn();
  render(
    <NotificationOptIn
      onEnable={enable}
      onDecline={vi.fn()}
      onDismiss={dismiss}
    />,
  );
  const yes = screen.getByRole("button", { name: "SIM" });
  fireEvent.click(yes);
  fireEvent.click(yes);
  expect(enable).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "NÃO" })).toBeDisabled();
  fail(new Error("Permissão não concedida"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Permissão não concedida",
  );
  expect(dismiss).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "SIM" })).toBeEnabled();
});
