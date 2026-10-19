import { describe, expect, it } from "vitest";
import {
  CAPIBORA_MESSAGES,
  CAPIBORA_NOTIFICATIONS,
  selectCapiboraNotification,
  type NotificationSelection,
} from "./capiboraVoice";
const pending: NotificationSelection = {
  category: "workout_reminder",
  day: "2026-10-19",
  hour: 17,
  selectionKey: "account-a",
  tone: "dramatic",
  facts: { pending: true },
};
describe("catálogo contextual da Capibora", () => {
  it("usa IDs únicos, metadados e pontuação própria sem alterar textos funcionais", () => {
    expect(new Set(CAPIBORA_MESSAGES.map((m) => m.id)).size).toBe(
      CAPIBORA_MESSAGES.length,
    );
    for (const m of CAPIBORA_MESSAGES) {
      expect(m.category).toBeTruthy();
      expect(m.context).toBeTruthy();
      expect(m.conditions.all).toBeInstanceOf(Array);
      expect(["light", "teasing", "exaggerated"]).toContain(m.intensity);
      for (const copy of [m.title, m.body]) {
        expect(copy.replaceAll("...", "")).not.toMatch(/\./);
        if (
          m.id !== "morning-today" ||
          copy !== "Porque o treino não vai se fazer sozinho"
        )
          expect(copy).not.toMatch(/O treino não vai/i);
        expect(copy).not.toMatch(
          /Você consegue|jornada|vou saber|eles vão saber|Hoje eu não tenho|emagrece|engord|gord[oa]|magri/i,
        );
      }
    }
  });
  it.each([
    [
      "morning",
      [
        ["BOM DIAAAAA, PREGUIÇA", "Já acordou pensando em fugir do treino?"],
        ["ACORDAAAAA", "Tem treino te esperando hoje"],
        ["Bom dia, atleta", "Atleta é modo de dizer, né?"],
        ["Bom dia, bicho preguiça", "Hoje tem treino, viu?"],
        ["Já acordou pra vida?", "Porque o treino não vai se fazer sozinho"],
        ["Vai ficar na cama até quando?", "Bora levantar que hoje tem treino"],
      ],
    ],
    [
      "afternoon",
      [
        ["BOOOOOORA TREINAAAAAAR", "Tá esperando o quê????"],
        ["Vai treinar não????", "Já passou da hora de sair da enrolação"],
        ["O SOFÁ TE SEQUESTROU?", "Pisca duas vezes se precisar de ajuda"],
        ["VAI LOGOOOO", "Eu tô esperando esse treino"],
        ["Eu vou contar até três", "UM... DOIS..."],
        ["Não se faça de doido", "Você sabe que tem treino hoje"],
        ["Tá esperando um convite?", "Pois considere-se convidado"],
      ],
    ],
    [
      "evening",
      [
        ["E O TREINO, HEIN????", "Vai deixar pra última hora de novo?"],
        ["NÃO É POSSÍVEEEEEL", "Ainda não treinou????"],
        ["Amada????", "Cadê esse treino, criatura?"],
        ["Eu desisto", "Mentira, ainda dá tempo"],
        ["TIC TAC TIC TAC", "O dia tá acabando, hein"],
        ["A GENTE VAI FINGIR QUE NÃO VIU?", "Esse treino ainda tá pendente"],
        ["BICHO PREGUIÇAAAAA", "Vai hoje ou não????"],
        ["Ainda dá tempo?", "Dá sim, mas não enrola"],
      ],
    ],
  ] as const)(
    "mantém somente os títulos e corpos aprovados de %s",
    (period, approved) => {
      const copies = CAPIBORA_NOTIFICATIONS.filter(
        (m) => m.category === "workout_reminder" && m.period === period,
      );
      expect(copies).toHaveLength(approved.length);
      expect(copies.map((m) => [m.title, m.body])).toEqual(
        expect.arrayContaining([...approved]),
      );
    },
  );
  it.each([
    [9, "morning"],
    [17, "afternoon"],
    [21, "evening"],
  ] as const)("seleciona o período %s sem criar eventos", (hour, period) => {
    expect(selectCapiboraNotification({ ...pending, hour })?.period).toBe(
      period,
    );
    expect(
      selectCapiboraNotification({ ...pending, hour, facts: {} }),
    ).toBeUndefined();
  });
  it.each([
    "completed",
    "active",
    "rest",
    "protected",
    "rescheduled",
    "unplanned",
  ] as const)("não cobra com %s", (fact) => {
    expect(
      selectCapiboraNotification({
        ...pending,
        facts: { pending: true, [fact]: true },
      }),
    ).toBeUndefined();
  });
  it("respeita silêncio e tempo mínimo configurável", () => {
    for (const hour of [0, 7, 22, 23])
      expect(selectCapiboraNotification({ ...pending, hour })).toBeUndefined();
    expect(
      selectCapiboraNotification({
        ...pending,
        hour: 21,
        minute: 50,
        minimumMinutes: 180,
      }),
    ).toBeUndefined();
  });
  it("preserva o tom leve, mantém retries estáveis e evita IDs recentes", () => {
    for (let day = 1; day <= 28; day++) {
      const input = {
        ...pending,
        day: `2026-10-${String(day).padStart(2, "0")}`,
        tone: "gentle" as const,
      };
      const first = selectCapiboraNotification(input)!;
      expect(first.intensity).toBe("light");
      expect(
        selectCapiboraNotification({
          ...input,
          existingId: first.id,
          recentIds: [first.id],
        })?.id,
      ).toBe(first.id);
      expect(
        selectCapiboraNotification({ ...input, recentIds: [first.id] })?.id,
      ).not.toBe(first.id);
    }
  });
  it("usa exagero ocasional e não o repete no dia seguinte", () => {
    let exaggerated = 0,
      last: string | null = null;
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-10-${String(day).padStart(2, "0")}`;
      const copy = selectCapiboraNotification({
        ...pending,
        day: iso,
        lastExaggeratedDay: last,
      })!;
      if (copy.intensity === "exaggerated") {
        exaggerated++;
        if (last)
          expect(Date.parse(iso) - Date.parse(last)).toBeGreaterThan(86400000);
        last = iso;
      }
    }
    expect(exaggerated).toBeGreaterThan(0);
    expect(exaggerated).toBeLessThan(8);
  });
  it("peso é neutro e eventos sociais, conquistas e recompensas exigem fatos reais", () => {
    for (const [category, facts] of [
      ["weight_reminder", { weightPending: true }],
      ["social_activity", { socialEvent: true }],
      ["achievement_unlocked", { achievementConfirmed: true }],
      ["reward_unlocked", { rewardConfirmed: true }],
    ] as const) {
      expect(
        selectCapiboraNotification({ ...pending, category, facts }),
      ).toBeDefined();
      expect(
        selectCapiboraNotification({ ...pending, category, facts: {} }),
      ).toBeUndefined();
    }
    expect(
      selectCapiboraNotification({
        ...pending,
        category: "challenge_progress",
        facts: { acceptedChallenge: true, behind: true, rest: true },
      }),
    ).toBeUndefined();
    expect(
      CAPIBORA_NOTIFICATIONS.filter((m) => m.category === "weight_reminder"),
    ).toHaveLength(5);
  });
});
