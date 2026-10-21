import { afterEach, expect, it, vi } from "vitest";
import { canOpenMissedWorkout } from "./homeDayPresentation";
import type { TrainingState } from "./training";
import type { RecordingState } from "./workoutRecording";
const day = "2026-10-20";
const training: TrainingState = {
  today: day,
  timezone: "America/Sao_Paulo",
  revision: 1,
  startedOn: "2026-10-12",
  planRequired: false,
  legacyScheduleBefore: null,
  weeklyExtraLimit: 2,
  weeklyRescheduleLimit: 2,
  plans: [
    { revision: 1, effectiveFrom: "2026-10-12", trainingDays: [1, 2, 3, 4, 5] },
  ],
  extraRests: [],
  medicalRests: [],
  reschedules: [],
};
const recording: RecordingState = {
  today: day,
  timezone: training.timezone,
  serverNow: "2026-10-21T02:59:59Z",
  session: null,
  minimumMinutes: 35,
  maximumMinutes: 240,
};
const base = { authenticated: true, training, recording, trained: false };
afterEach(() => vi.useRealTimers());
it("usa o dia e o relógio do servidor e fecha a elegibilidade na meia-noite do fuso da conta", () => {
  expect(canOpenMissedWorkout({ ...base, elapsedMs: 999 })).toBe(true);
  expect(canOpenMissedWorkout({ ...base, elapsedMs: 1000 })).toBe(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2040-01-01"));
  expect(canOpenMissedWorkout({ ...base, elapsedMs: 500 })).toBe(true);
});
it.each([
  ["visitante", { authenticated: false }],
  ["sem estado", { training: null }],
  ["recuperando sessão", { recording: null }],
  ["sem plano", { training: { ...training, plans: [], planRequired: true } }],
  [
    "plano apenas futuro",
    {
      training: {
        ...training,
        plans: [
          { revision: 1, effectiveFrom: "2026-10-26", trainingDays: [1] },
        ],
      },
    },
  ],
  ["treino concluído", { trained: true }],
  ["registro offline ainda sem confirmação", { pendingWorkout: true }],
  ["proteção no inventário", { protectedDay: true }],
  [
    "descanso programado",
    {
      training: {
        ...training,
        plans: [{ ...training.plans[0], trainingDays: [1, 3, 5] }],
      },
    },
  ],
  ["descanso extra", { training: { ...training, extraRests: [day] } }],
  ["kit usado", { training: { ...training, medicalRests: [day] } }],
  [
    "reagendado",
    {
      training: {
        ...training,
        reschedules: [
          {
            id: "move",
            originalDay: day,
            targetDay: "2026-10-24",
            weekStart: "2026-10-19",
            createdAt: "2026-10-20T12:00Z",
            revision: 2,
          },
        ],
      },
    },
  ],
  [
    "dia antigo no cache",
    { recording: { ...recording, serverNow: "2026-10-21T03:00:00Z" } },
  ],
  ["sessão de outro dia", { recording: { ...recording, today: "2026-10-21" } }],
  [
    "fuso ainda não sincronizado",
    { recording: { ...recording, timezone: "UTC" } },
  ],
  ["relógio inválido", { recording: { ...recording, serverNow: "invalid" } }],
] as const)("não oferece reconhecimento de falta em %s", (_name, patch) => {
  expect(
    canOpenMissedWorkout({ ...base, ...patch } as Parameters<
      typeof canOpenMissedWorkout
    >[0]),
  ).toBe(false);
});
it("respeita sessão ativa e confirmação já reconhecida pelo controlador, antes da atualização social", () => {
  const session = {
    id: "session",
    activity: "Corrida",
    status: "active" as const,
    startedAt: "2026-10-20T15:00Z",
    endedAt: null,
    validatedSeconds: null,
    minimumSeconds: 2100,
    maximumSeconds: 14400,
    workout: null,
  };
  expect(
    canOpenMissedWorkout({ ...base, recording: { ...recording, session } }),
  ).toBe(false);
  expect(
    canOpenMissedWorkout({
      ...base,
      recording: {
        ...recording,
        session: {
          ...session,
          status: "completed",
          workout: {
            id: "workout",
            date: day,
            activity: "Corrida",
            minutes: 35,
            confirmedAt: "2026-10-20T16:00Z",
          },
        },
      },
    }),
  ).toBe(false);
});
it("um treino compensatório realmente pendente continua obrigatório, sem criar outra classificação", () => {
  const moved = {
    ...training,
    reschedules: [
      {
        id: "move",
        originalDay: "2026-10-19",
        targetDay: day,
        weekStart: "2026-10-19",
        createdAt: "2026-10-19T15:00Z",
        revision: 2,
      },
    ],
  };
  expect(canOpenMissedWorkout({ ...base, training: moved })).toBe(true);
});
