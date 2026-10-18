import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import GroupReactions, {
  readGroupReactions,
  type GroupReaction,
} from "./GroupReactions";
import type { SocialState } from "./social";
import type { Cosmetic } from "./gamification";
const resource = vi.hoisted(() => ({
  state: [] as GroupReaction[],
  busy: false,
  error: "",
  act: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./useGamification", () => ({ useGameResource: () => resource }));
const group: SocialState["groups"][number] = {
  id: "g",
  name: "Duo",
  status: "active",
  timezone: "UTC",
  today: "2026-10-18",
  streak: 1,
  best: 1,
  completed: false,
  invited: false,
  members: [
    { id: "bia", nickname: "Bia", accepted: true, trained: true },
    { id: "dani", nickname: "Dani", accepted: true, trained: false },
  ],
};
const item: Cosmetic = {
  id: "emoji-fire",
  name: "Chama",
  category: "emoji",
  owned: true,
  equipped: true,
  locked: false,
  price: 30,
  rarity: "common",
  badgeKey: null,
};
beforeEach(() => {
  resource.state = [];
  resource.busy = false;
  resource.error = "";
  resource.act.mockReset().mockResolvedValue(true);
  resource.refresh.mockReset();
});
it("oferece reações apenas aos participantes com treino confirmado", async () => {
  const user = userEvent.setup();
  render(<GroupReactions userId="me" group={group} items={[item]} />);
  await user.click(screen.getByText("Reações aos treinos"));
  expect(
    screen.getByRole("button", { name: "Reagir ao treino de Bia" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reagir ao treino de Dani" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Reagir ao treino de Bia" }),
  );
  await user.click(screen.getByRole("button", { name: "Reagir com Chama" }));
  expect(resource.act).toHaveBeenCalledExactlyOnceWith("set_group_reaction", {
    p_group: "g",
    p_target: "bia",
    p_item: "emoji-fire",
  });
});
it("não oferece emojis não adquiridos e direciona para a Loja", async () => {
  const user = userEvent.setup();
  render(
    <GroupReactions
      userId="me"
      group={group}
      items={[{ ...item, owned: false }]}
    />,
  );
  await user.click(screen.getByText("Reações aos treinos"));
  await user.click(
    screen.getByRole("button", { name: "Reagir ao treino de Bia" }),
  );
  expect(
    screen.getByRole("link", { name: "Escolher emojis na Loja" }),
  ).toHaveAttribute("href", "#/loja");
  expect(
    screen.queryByRole("button", { name: "Reagir com Chama" }),
  ).not.toBeInTheDocument();
});
it("mostra contagens persistidas e permite remover somente a própria reação", async () => {
  resource.state = [
    { target: "bia", itemId: "emoji-fire", count: 2, mine: true },
  ];
  const user = userEvent.setup();
  render(<GroupReactions userId="me" group={group} items={[item]} />);
  await user.click(screen.getByText("Reações aos treinos"));
  await user.click(
    screen.getByRole("button", { name: /remover minha reação/ }),
  );
  expect(resource.act).toHaveBeenCalledWith("set_group_reaction", {
    p_group: "g",
    p_target: "bia",
    p_item: null,
  });
});
it("mostra falhas sem perder a contagem e desabilita ações em andamento", async () => {
  resource.error = "Não foi possível atualizar";
  resource.state = [
    { target: "bia", itemId: "emoji-fire", count: 1, mine: false },
  ];
  const user = userEvent.setup();
  const view = render(
    <GroupReactions userId="me" group={group} items={[item]} />,
  );
  await user.click(screen.getByText("Reações aos treinos"));
  expect(screen.getByRole("alert")).toHaveTextContent(resource.error);
  await user.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(resource.refresh).toHaveBeenCalledOnce();
  resource.busy = true;
  view.rerender(<GroupReactions userId="me" group={group} items={[item]} />);
  expect(
    screen.getByRole("button", { name: "Reagir ao treino de Bia" }),
  ).toBeDisabled();
});
it("valida o contrato e recusa emojis arbitrários ou contagens inválidas", () => {
  expect(
    readGroupReactions([
      { target: "bia", itemId: "emoji-fire", count: 1, mine: false },
    ]),
  ).toHaveLength(1);
  for (const itemId of ["texto ofensivo", "emoji-unknown"]) {
    expect(() =>
      readGroupReactions([{ target: "bia", itemId, count: 1, mine: false }]),
    ).toThrow();
  }
  expect(() =>
    readGroupReactions([
      { target: "bia", itemId: "emoji-fire", count: 0, mine: false },
    ]),
  ).toThrow();
});
