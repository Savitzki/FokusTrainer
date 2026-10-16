import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, localDate, STORAGE_KEY } from "./model";

const account = vi.hoisted(() => ({
  user: null as null | { id: string },
  initializing: false,
  profile: null,
  profileLoading: false,
}));
vi.mock("./account", () => ({ useAccount: () => account }));

describe("registros locais separados por conta", () => {
  it("não mistura os treinos de usuários diferentes e preserva o perfil sem login", () => {
    const local = freshData();
    local.workouts.push({
      id: "guest",
      date: localDate(),
      activity: "Corrida",
      minutes: 30,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    const view = render(<App />);
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
    account.user = { id: "user-a" };
    view.rerender(<App />);
    expect(
      screen.getByRole("button", { name: "Registrar treino" }),
    ).toBeEnabled();
    expect(
      JSON.parse(localStorage.getItem(`${STORAGE_KEY}:account:user-a`)!)
        .workouts,
    ).toHaveLength(0);
    account.user = { id: "user-b" };
    view.rerender(<App />);
    expect(
      screen.getByRole("button", { name: "Registrar treino" }),
    ).toBeEnabled();
    account.user = null;
    view.rerender(<App />);
    expect(
      screen.getByRole("button", { name: "Treino de hoje concluído" }),
    ).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts).toEqual(
      local.workouts,
    );
  });
});
