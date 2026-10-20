import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Modal from "./Modal";

it("preserva o fechamento pelo fundo e por Escape nas outras janelas", () => {
  const close = vi.fn();
  render(<Modal title="Peso" onClose={close}>Conteúdo</Modal>);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(dialog);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(close).toHaveBeenCalledTimes(2);
});

it("no registro, ignora fundo e cancelamento nativo e permite somente o X", async () => {
  const close = vi.fn();
  render(<Modal title="Treino" onClose={close} dismissible={false}>Avaliação</Modal>);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("closedby", "none");
  fireEvent.click(dialog);
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
  expect(close).toHaveBeenCalledOnce();
});

it("protege a confirmação em andamento e atualiza a política sem recriar listeners", async () => {
  const close = vi.fn();
  const view = render(<Modal title="Treino" onClose={close} dismissible={false} closeDisabled>Formulário</Modal>);
  const dialog = screen.getByRole("dialog");
  expect(screen.getByRole("button", { name: "Fechar janela" })).toBeDisabled();
  fireEvent.click(dialog);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  view.rerender(<Modal title="Treino" onClose={close} dismissible={false}>Formulário</Modal>);
  await userEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(<Modal title="Outro" onClose={close}>Conteúdo</Modal>);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(close).toHaveBeenCalledTimes(2);
});
