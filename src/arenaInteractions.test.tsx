import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ArenaTauntButton from "./ArenaTauntButton";
import dailySql from "../supabase/migrations/202610200039_random_daily_taunts.sql?raw";
import FriendOptions from "./FriendOptions";
import arenaSql from "../supabase/migrations/202610200034_arena_interactions.sql?raw";
import replySql from "../supabase/migrations/202610200037_arena_taunt_replies.sql?raw";
import { readArenaInbox, ARENA_TAUNTS, ARENA_MESSAGES } from "./arenaTaunts";
import { challengeResultTitle } from "./ChallengeResult";
import type { Challenge } from "./gamification";
it("envia somente após confirmar e deixa a escolha da frase para o servidor", async () => {
  const user = userEvent.setup(),
    act = vi.fn().mockResolvedValue(true),
    challenge = vi.fn();
  render(
    <ArenaTauntButton
      friend={{ id: "bia", nickname: "Bia" }}
      busy={false}
      act={act}
      allowance={{
        day: "2026-10-20",
        checkedAt: "2026-10-20T12:00:00Z",
        resetsAt: "2026-10-21T00:00:00Z",
        sentTo: [],
      }}
    />,
  );
  await user.click(screen.getByLabelText("Provocar Bia"));
  expect(
    screen.queryByRole("group", { name: "Escolher provocação" }),
  ).not.toBeInTheDocument();
  expect(act).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Provocar" }),
  );
  expect(act).toHaveBeenCalledWith("send_arena_taunt", {
    p_user: "bia",
    p_message: null,
    p_request: expect.any(String),
  });
  expect(screen.getByLabelText("Já provocou hoje: @Bia")).toBeDisabled();
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
    />,
  );
  await user.click(screen.getByRole("button", { name: "Desafiar" }));
  expect(challenge).toHaveBeenCalledOnce();
  expect(act).not.toHaveBeenCalled();
});
it("catálogo social é fechado e não inventa atividade ou posição", () => {
  expect(ARENA_TAUNTS).toHaveLength(5);
  const insert =
    arenaSql.match(/insert into arena_taunt_catalog values([^;]+);/s)?.[1] ??
    "";
  const serverCatalog = [
    ...insert.matchAll(/\('([^']+)','([^']+)','([^']+)'\)/g),
  ].map(([, id, text, pose]) => ({ id, text, pose }));
  const additions = [
    ...replySql.matchAll(/\('([^']+)','([^']+)','([^']+)',(true|false)\)/g),
  ].map(([, id, text, pose, reply]) => ({
    id,
    text,
    pose,
    ...(reply === "true" ? { replyOnly: true } : {}),
  }));
  expect(
    [
      ...serverCatalog,
      ...additions,
      ...[...dailySql.matchAll(/\('([^']+)','([^']+)','([^']+)',true\)/g)].map(
        ([, id, text, pose]) => ({ id, text, pose }),
      ),
    ].sort((a, b) => a.id.localeCompare(b.id)),
  ).toEqual(
    ARENA_MESSAGES.map(({ originalEligible: _, ...message }) => message).sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
  );
  expect(new Set(ARENA_TAUNTS.map((t) => t.id)).size).toBe(5);
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
  expect(
    challengeResultTitle({
      ...c,
      cancelled: true,
      cancelReason: "participation-ended",
    }),
  ).toBe("Participação encerrada");
  expect(challengeResultTitle({ ...c, cancelled: true })).toBe(
    "Desafio cancelado",
  );
  expect(challengeResultTitle({ ...c, board: [] })).toBe("Sem pontuação final");
});
it("preserva exatamente as cinco mensagens aprovadas sem sortear IDs históricos ou revides", () => {
  expect(ARENA_TAUNTS.map((m) => m.text)).toEqual([
    "Eu tentei te defender, mas teu amigo perguntou quando foi a última vez que vc treinou...",
    "não quero me envolver, mas tão falando que vc só vai pra academia pra tirar foto",
    "EU NÃO TENHO NADA A VER COM ISSO, MAAAAS teu amigo disse que sua ofensiva é igual relacionamento ruim: nunca dura!",
    "Tão falando que vc só faz levantamento de garfo",
    "Ó, não fui eu que falei tá? Mas tem alguém aí dizendo que vc só vai pra academia pra beber água",
  ]);
  expect(ARENA_TAUNTS.every((m) => !m.replyOnly && m.originalEligible)).toBe(
    true,
  );
  const old = ARENA_MESSAGES.find((m) => m.id === "online")!;
  expect(
    readArenaInbox({
      version: 3,
      muted: false,
      push: false,
      messages: [
        {
          id: "old",
          sender: "bia",
          nickname: "Bia",
          messageId: old.id,
          text: old.text,
          pose: old.pose,
          createdAt: "2026-10-20T12:00:00Z",
          seen: false,
          replyTo: null,
          canReply: true,
        },
      ],
    }).messages[0].text,
  ).toBe("Vai treinar ou só ficar online?");
});
