import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { freshData, localDate, STORAGE_KEY } from "./model";
import type { Profile } from "./profile";

const account = vi.hoisted(() => ({
  user: null as null | { id: string },
  initializing: false,
  profile: null as Profile | null,
  profileLoading: false,
  profileChecked: false,
  profileError: "",
}));
vi.mock("./account", () => ({ useAccount: () => account }));
beforeEach(() =>
  Object.assign(account, {
    user: null,
    profile: null,
    profileLoading: false,
    profileChecked: false,
    profileError: "",
  }),
);

describe("registros locais separados por conta", () => {
  it("só pede nick e avatar depois de confirmar que o perfil não existe", () => {
    account.user = { id: "user-a" };
    account.profileLoading = true;
    const view = render(<App />);
    expect(
      screen.queryByRole("button", { name: /Complete seu nick/ }),
    ).not.toBeInTheDocument();
    account.profileLoading = false;
    account.profileError = "Falha na consulta";
    view.rerender(<App />);
    expect(
      screen.queryByRole("button", { name: /Complete seu nick/ }),
    ).not.toBeInTheDocument();
    account.profileError = "";
    account.profileChecked = true;
    view.rerender(<App />);
    expect(
      screen.getByRole("button", { name: /Complete seu nick/ }),
    ).toBeInTheDocument();
    account.profile = {
      nickname: "dani.treina",
      style: "initials",
      color: "orange",
      photo: null,
    };
    view.rerender(<App />);
    expect(
      screen.queryByRole("button", { name: /Complete seu nick/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar perfil de dani.treina" }),
    ).toBeInTheDocument();
  });
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
      screen.getByRole("button", { name: "Registrar treino" }),
    ).toBeEnabled();
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
      screen.getByRole("button", { name: "Registrar treino" }),
    ).toBeEnabled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).workouts).toEqual(
      local.workouts,
    );
  });
});
