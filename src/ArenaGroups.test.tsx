import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ArenaGroups, ArenaGroupPanel, type ArenaGroup } from "./ArenaGroups";
const group: ArenaGroup = {
  id: "a",
  name: "Equipe A",
  adminId: "me",
  timezone: "UTC",
  status: "active",
  invited: false,
  today: "2026-10-20",
  streak: 7,
  best: 9,
  completed: false,
  members: [
    { id: "me", nickname: "Dani", accepted: true, trained: false },
    { id: "bia", nickname: "Bia", accepted: true, trained: true },
  ],
  goals: [
    {
      weekStart: "2026-10-19",
      startsOn: "2026-10-19",
      timezone: "UTC",
      target: 8,
      completed: 3,
      closed: false,
    },
  ],
};
it("destaca uma equipe, separa outras e convites usando somente dados do estado", async () => {
  const open = vi.fn(),
    act = vi.fn(),
    user = userEvent.setup();
  render(
    <ArenaGroups
      groups={[
        group,
        { ...group, id: "b", name: "Equipe B", streak: 4 },
        { ...group, id: "invite", name: "Convite", invited: true },
      ]}
      featuredId="b"
      onOpen={open}
      onCreate={vi.fn()}
      busy={false}
      act={act}
    />,
  );
  const featured = screen.getByRole("article", { name: "Grupo Equipe B" });
  expect(within(featured).getByText("4", { exact: true })).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "3");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "8");
  await user.click(
    screen.getByRole("button", { name: "Detalhes de Equipe A" }),
  );
  expect(open).toHaveBeenCalledWith("a");
  await user.click(
    screen.getByRole("button", { name: "Aceitar convite para Convite" }),
  );
  expect(act).toHaveBeenCalledWith("reply_group_invite", {
    p_id: "invite",
    p_accept: true,
  });
});
it("usa alternativa disponível quando a equipe destacada saiu e não destaca convites", () => {
  render(
    <ArenaGroups
      groups={[
        group,
        { ...group, id: "i", name: "Só convite", invited: true, streak: 100 },
      ]}
      featuredId="removed"
      onOpen={vi.fn()}
      onCreate={vi.fn()}
      busy={false}
      act={vi.fn()}
    />,
  );
  expect(screen.getByRole("article", { name: "Grupo Equipe A" })).toBeVisible();
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
});
it("recupera meta, histórico, papéis, regras e gerenciamento em painel com Voltar", async () => {
  const back = vi.fn(),
    user = userEvent.setup();
  render(
    <ArenaGroupPanel
      group={group}
      userId="me"
      friends={[]}
      busy={false}
      act={vi.fn()}
      onBack={back}
    />,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Recorde 9")).toBeVisible();
  expect(screen.getByText("5 restantes")).toBeVisible();
  expect(
    within(
      screen.getByRole("region", { name: "Integrantes do grupo" }),
    ).getByText("Administrador"),
  ).toBeVisible();
  expect(screen.queryByText("Gerenciar grupo")).not.toBeInTheDocument();
  expect(screen.queryByText("Dia da equipe e regras")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name:"Sair do grupo"}));
  expect(
    screen.getByRole("button", { name: "Transferir administração" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  await user.click(screen.getByRole("button", { name: "Voltar para equipes" }));
  expect(back).toHaveBeenCalledOnce();
});
