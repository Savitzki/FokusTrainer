import { expect, it } from "vitest";
import {
  kitUsesRemaining,
  readEconomyState,
  type EconomyState,
} from "./economy";

const wallet: EconomyState = {
  revision: 1,
  balance: 500,
  kits: 3,
  today: "2026-12-31",
  timezone: "America/Sao_Paulo",
  kitsUsedThisWeek: 3,
  protections: [],
  rules: {
    workoutReward: 10,
    weightReward: 2,
    kitPrice: 250,
    weeklyKitLimit: 7,
    kitUsageLimit: "inventory",
  },
  monthlyKits: {
    month: "2026-12-01",
    renewsOn: "2027-01-01",
    allowance: 2,
    freeAvailable: 2,
    purchasedAvailable: 1,
  },
  history: { entries: [], hasMore: false },
};
it("lê a renovação na virada do ano e mantém o saldo e os kits confirmados pelo servidor", () => {
  expect(readEconomyState(wallet)).toEqual(wallet);
  expect(kitUsesRemaining(wallet)).toBeNull();
});
it.each([
  { month: "2026-11-01" },
  { renewsOn: "2026-12-31" },
  { renewsOn: "2027-02-01" },
  { freeAvailable: 3 },
  { purchasedAvailable: -1 },
  { allowance: 1.5 },
])("recusa inventário mensal incoerente: %j", (overrides) => {
  expect(() =>
    readEconomyState({
      ...wallet,
      monthlyKits: { ...wallet.monthlyKits, ...overrides },
    }),
  ).toThrow();
});
it("preserva compatibilidade com o banco anterior sem inventar benefícios mensais", () => {
  const { monthlyKits, ...legacy } = wallet;
  const { kitUsageLimit, ...rules } = legacy.rules;
  const state = readEconomyState({
    ...legacy,
    rules: { ...rules, weeklyKitLimit: 2 },
    kitsUsedThisWeek: 1,
  });
  expect(state.monthlyKits).toBeUndefined();
  expect(kitUsesRemaining(state)).toBe(1);
  expect(() =>
    readEconomyState({ ...wallet, monthlyKits: undefined }),
  ).toThrow();
});

const protection = { id: "automatic-kit", day: "2026-12-30", usedAt: "2026-12-31T03:00:01Z" };
it("só aceita avisos automáticos de dias encerrados que constam nas proteções confirmadas", () => {
  const state = { ...wallet, protections: [protection], automaticNotices: [protection] };
  expect(readEconomyState(state).automaticNotices).toEqual([protection]);
  expect(() => readEconomyState({ ...state, protections: [] })).toThrow();
  expect(() => readEconomyState({ ...state, automaticNotices: [protection, protection] })).toThrow();
  expect(() => readEconomyState({ ...state, automaticNotices: [{ ...protection, day: wallet.today }] })).toThrow();
  expect(() => readEconomyState({ ...state, automaticNotices: [null] })).toThrow("proteções automáticas");
});
