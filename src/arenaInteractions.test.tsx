import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FriendOptions from "./FriendOptions";
import arenaSql from "../supabase/migrations/202610200034_arena_interactions.sql?raw";
import { readArenaInbox, ARENA_TAUNTS } from "./arenaTaunts";
import { challengeResultTitle } from "./ChallengeResult";
import type { Challenge } from "./gamification";
it("envia somente frase selecionada depois da confirmação explícita", async () => {
  const user = userEvent.setup(),
    act = vi.fn().mockResolvedValue(true),
    challenge = vi.fn();
  render(
    <FriendOptions
      friend={{ id: "bia", nickname: "Bia" }}
      busy={false}
      act={act}
      onChallenge={challenge}
      interactions
    />,
  );
  await user.click(screen.getByLabelText("Opções de Bia"));
  await user.click(screen.getByRole("button", { name: "Provocar" }));
  await user.click(screen.getByRole("button", { name: "Quero só ver..." }));
  expect(act).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Enviar provocação" }));
  expect(act).toHaveBeenCalledWith("send_arena_taunt", {
    p_user: "bia",
    p_message: "watching",
    p_request: expect.any(String),
  });
  expect(challenge).not.toHaveBeenCalled();
});
it("desafio rápido abre o fluxo existente sem disparar provocação", async () => {
  const user = userEvent.setup(),
    act = vi.fn(),
    challenge = vi.fn();
  render(
    <FriendOptions
      friend={{ id: "bia", nickname: "Bia" }}
      busy={false}
      act={act}
      onChallenge={challenge}
      interactions
    />,
  );
  await user.click(screen.getByLabelText("Opções de Bia"));
  await user.click(screen.getByRole("button", { name: "Desafiar" }));
  expect(challenge).toHaveBeenCalledOnce();
  expect(act).not.toHaveBeenCalled();
});
it("catálogo social é fechado e não inventa atividade ou posição", () => {
  expect(ARENA_TAUNTS).toHaveLength(3);
  const insert =
    arenaSql.match(/insert into arena_taunt_catalog values([^;]+);/s)?.[1] ??
    "";
  const serverCatalog = [
    ...insert.matchAll(/\('([^']+)','([^']+)','([^']+)'\)/g),
  ].map(([, id, text, pose]) => ({ id, text, pose }));
  expect(serverCatalog).toEqual(ARENA_TAUNTS);
  expect(new Set(ARENA_TAUNTS.map((t) => t.id)).size).toBe(3);
  expect(readArenaInbox({ muted: false, push: false, messages: [] })).toEqual({
    muted: false,
    push: false,
    messages: [],
  });
  expect(() =>
    readArenaInbox({
      muted: false,
      push: false,
      messages: [{ id: "1", messageId: "free", text: "livre" }],
    }),
  ).toThrow();
});
it("resultados cancelados não têm vencedor e empates vêm das posições do servidor", () => {
  const c = {
    closed: true,
    cancelled: false,
    kind: "frequency",
    board: [
      { id: "a", nickname: "A", place: 1 },
      { id: "b", nickname: "B", place: 1 },
    ],
  } as Challenge;
  expect(challengeResultTitle(c)).toBe("Empate");
  expect(challengeResultTitle({ ...c, cancelled: true })).toBe(
    "Desafio cancelado",
  );
  expect(challengeResultTitle({ ...c, board: [] })).toBe("Sem pontuação final");
});
