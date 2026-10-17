import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ProfilePanel from "./ProfilePanel";
import { NicknameConflictError } from "./nickname";
import type { Account } from "./account";
import type { Profile } from "./profile";
const profile: Profile = {
  nickname: "Dani",
  color: "orange",
  style: "initials",
  photo: null,
};
function account(): Account {
  return {
    configured: true,
    initializing: false,
    user: { id: "user", email: "me@example.invalid" } as Account["user"],
    phrasePreferences: { displayName: "Dani", treatment: "neutral" },
    profile: null,
    profileLoading: false,
    profileChecked: true,
    profileError: "",
    error: "",
    authNotice: "",
    dismissAuthNotice: vi.fn(),
    retry: vi.fn(),
    checkEmail: vi.fn(),
    checkNickname: vi
      .fn()
      .mockResolvedValue({ valid: true, available: true, suggestions: [] }),
    signUp: vi.fn(),
    resendConfirmation: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    saveProfile: vi.fn().mockResolvedValue(undefined),
  };
}
it("bloqueia o nick salvo, mas permite mudar avatar e nome das frases", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.profile = profile;
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Seu nick")).toHaveAttribute("readonly");
  await user.type(screen.getByLabelText("Seu nick"), "alterado");
  expect(screen.getByLabelText("Seu nick")).toHaveValue("Dani");
  await user.clear(screen.getByLabelText("Seu nome"));
  await user.type(screen.getByLabelText("Seu nome"), "Daniela");
  await user.click(screen.getByRole("radio", { name: "Azul" }));
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(auth.saveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ nickname: "Dani", color: "blue" }),
    expect.objectContaining({ displayName: "Daniela" }),
  );
  expect(auth.checkNickname).not.toHaveBeenCalled();
});
it("mostra sugestões livres para nick ocupado e salva a escolhida", async () => {
  const auth = account(),
    user = userEvent.setup(),
    onSaved = vi.fn();
  vi.mocked(auth.checkNickname).mockImplementation(async (n) => ({
    valid: true,
    available: n !== "Dani",
    suggestions: n === "Dani" ? ["Dani_1", "Dani_2", "Dani_3"] : [],
  }));
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await user.type(screen.getByLabelText("Seu nick"), "Dani");
  await screen.findByText("Esse nick já está em uso");
  expect(screen.getByRole("button", { name: "Salvar perfil" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "@Dani_2" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Salvar perfil" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  expect(auth.saveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ nickname: "Dani_2" }),
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
it("um conflito entre a consulta e o salvamento oferece outras sugestões e não anuncia sucesso", async () => {
  const auth = account(),
    user = userEvent.setup(),
    onSaved = vi.fn();
  vi.mocked(auth.saveProfile).mockRejectedValue(
    new NicknameConflictError(["Dani_8"]),
  );
  render(
    <ProfilePanel
      profile={null}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await user.type(screen.getByLabelText("Seu nick"), "Dani");
  await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
  await screen.findByRole("button", { name: "@Dani_8" });
  expect(onSaved).not.toHaveBeenCalled();
});

it("o perfil reúne os dados e o botão de sair, sem abas de conta ou configurações", async () => {
  const auth = account(),
    user = userEvent.setup();
  auth.profile = profile;
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(screen.getByText("me@example.invalid")).toBeInTheDocument();
  expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
  expect(screen.getByLabelText("Sexo")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Minha conta" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Configurações" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(auth.signOut).toHaveBeenCalledOnce();
});
it("uma falha ao sair mantém o perfil e explica o motivo", async () => {
  const auth = account(),
    user = userEvent.setup();
  vi.mocked(auth.signOut).mockRejectedValue(
    new Error("Aguarde os pesos sincronizarem"),
  );
  render(
    <ProfilePanel
      profile={profile}
      account={auth}
      onSaveLocal={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Aguarde os pesos sincronizarem",
  );
  expect(screen.getByLabelText("Seu nick")).toHaveValue("Dani");
});
