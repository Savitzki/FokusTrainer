import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SyncFeedback from "./SyncFeedback";
const state = vi.hoisted(() => ({
  states: [] as {
    error: string;
    errorKind: string | null;
    refreshing: boolean;
  }[],
}));
vi.mock("./sync", () => ({
  subscribeSync: () => () => {},
  syncVersion: () => 0,
  syncStates: () => state.states,
  retrySync: vi.fn(),
}));
it("não desenha indicador nem espaço vazio durante atualizações silenciosas", () => {
  state.states = [{ error: "", errorKind: null, refreshing: true }];
  const view = render(<SyncFeedback userId="me" onLogin={vi.fn()} />);
  expect(view.container).toBeEmptyDOMElement();
  expect(
    screen.queryByLabelText("Atualizando informações em segundo plano"),
  ).not.toBeInTheDocument();
});
it("não mostra falhas temporárias de rede", () => {
  state.states = [
    { error: "Rede indisponível", errorKind: "network", refreshing: false },
  ];
  render(<SyncFeedback userId="me" onLogin={vi.fn()} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sincronizar" })).not.toBeInTheDocument();
});
