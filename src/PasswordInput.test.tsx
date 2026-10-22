import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PasswordInput from "./PasswordInput";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it("mostra por cinco segundos sem perder o valor ou foco e permite ocultar antes", () => {
  vi.useFakeTimers();
  render(<label>Senha<PasswordInput defaultValue="example-password" autoComplete="current-password" /></label>);
  const input = screen.getByLabelText("Senha");
  input.focus();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  expect(input).toHaveAttribute("type", "text"); expect(input).toHaveFocus();
  act(() => vi.advanceTimersByTime(4999)); expect(input).toHaveAttribute("type", "text");
  act(() => vi.advanceTimersByTime(1)); expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveValue("example-password"); expect(input).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("autocomplete", "current-password");
});
it("oculta ao começar a salvar e cancela o temporizador ao desmontar", () => {
  vi.useFakeTimers();
  const clear = vi.spyOn(globalThis, "clearTimeout");
  const view = render(<PasswordInput aria-label="Senha" />);
  fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  view.rerender(<PasswordInput aria-label="Senha" disabled />);
  expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button")).toBeDisabled();
  view.unmount(); expect(clear).toHaveBeenCalled();
});
