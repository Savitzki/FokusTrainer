import { validDate } from "./model";

export type CoinMovement = {
  id: string;
  kind: "workout" | "weight" | "kit-purchase";
  description: string;
  amount: number;
  balanceAfter: number;
  day: string;
  createdAt: string;
  requestId?: string | null;
};
export type CoinHistory = { entries: CoinMovement[]; hasMore: boolean };
export type EconomyState = {
  revision: number;
  balance: number;
  kits: number;
  today: string;
  timezone: string;
  kitsUsedThisWeek: number;
  protections: { id: string; day: string; usedAt: string }[];
  rules: {
    workoutReward: number;
    weightReward: number;
    kitPrice: number;
    weeklyKitLimit: number;
  };
  history: CoinHistory;
};
const natural = (n: unknown): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0;
const timestamp = (s: unknown) =>
  typeof s === "string" && Number.isFinite(Date.parse(s));
export function readCoinHistory(raw: unknown): CoinHistory {
  const h = raw as CoinHistory;
  if (
    !h ||
    typeof h.hasMore !== "boolean" ||
    !Array.isArray(h.entries) ||
    !h.entries.every(
      (e) =>
        typeof e.id === "string" &&
        /^[1-9]\d*$/.test(e.id) &&
        ["workout", "weight", "kit-purchase"].includes(e.kind) &&
        typeof e.description === "string" &&
        Number.isSafeInteger(e.amount) &&
        e.amount !== 0 &&
        (e.kind === "kit-purchase" ? e.amount < 0 : e.amount > 0) &&
        natural(e.balanceAfter) &&
        validDate(e.day) &&
        timestamp(e.createdAt),
    )
  )
    throw new Error("Não foi possível consultar suas movimentações");
  return h;
}
export function readEconomyState(raw: unknown): EconomyState {
  const s = raw as EconomyState;
  if (
    !s ||
    !natural(s.revision) ||
    !natural(s.balance) ||
    !natural(s.kits) ||
    !natural(s.kitsUsedThisWeek) ||
    !validDate(s.today) ||
    typeof s.timezone !== "string" ||
    !s.rules ||
    !natural(s.rules.workoutReward) ||
    !natural(s.rules.weightReward) ||
    !natural(s.rules.kitPrice) ||
    s.rules.kitPrice === 0 ||
    !natural(s.rules.weeklyKitLimit) ||
    !Array.isArray(s.protections) ||
    !s.protections.every(
      (p) =>
        typeof p.id === "string" && validDate(p.day) && timestamp(p.usedAt),
    )
  )
    throw new Error("Não foi possível consultar suas moedas");
  new Intl.DateTimeFormat("pt-BR", { timeZone: s.timezone });
  readCoinHistory(s.history);
  return s;
}
