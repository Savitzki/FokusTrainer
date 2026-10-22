import { validDate } from "./model";
import { shiftMonth } from "./calendar";

export type CoinMovement = {
  id: string;
  kind:
    | "workout"
    | "weight"
    | "kit-purchase"
    | "mission"
    | "weekly-bonus"
    | "challenge"
    | "cosmetic-purchase";
  description: string;
  amount: number;
  balanceAfter: number;
  day: string;
  createdAt: string;
  requestId?: string | null;
};
export type CoinHistory = { entries: CoinMovement[]; hasMore: boolean };
export type KitProtection = { id: string; day: string; usedAt: string };
export type EconomyState = {
  revision: number;
  balance: number;
  kits: number;
  today: string;
  timezone: string;
  kitsUsedThisWeek: number;
  kitEligibility?: { allowed: boolean; reason: string | null };
  monthlyKits?: {
    month: string;
    renewsOn: string;
    allowance: number;
    freeAvailable: number;
    purchasedAvailable: number;
  };
  protections: KitProtection[];
  automaticNotices?: KitProtection[];
  rules: {
    workoutReward: number;
    weightReward: number;
    kitPrice: number;
    weeklyKitLimit: number;
    kitUsageLimit?: "inventory";
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
        [
          "workout",
          "weight",
          "kit-purchase",
          "mission",
          "weekly-bonus",
          "challenge",
          "cosmetic-purchase",
        ].includes(e.kind) &&
        typeof e.description === "string" &&
        Number.isSafeInteger(e.amount) &&
        e.amount !== 0 &&
        (["kit-purchase", "cosmetic-purchase"].includes(e.kind)
          ? e.amount < 0
          : e.amount > 0) &&
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
    (s.rules.kitUsageLimit !== undefined &&
      s.rules.kitUsageLimit !== "inventory") ||
    !Array.isArray(s.protections) ||
    !s.protections.every(
      (p) =>
        typeof p.id === "string" && validDate(p.day) && timestamp(p.usedAt),
    )
  )
    throw new Error("Não foi possível consultar seu saldo");
  if (
    s.kitEligibility !== undefined &&
    (!s.kitEligibility ||
      typeof s.kitEligibility.allowed !== "boolean" ||
      !(
        s.kitEligibility.reason === null ||
        (typeof s.kitEligibility.reason === "string" &&
          s.kitEligibility.reason.length <= 200)
      ) ||
      s.kitEligibility.allowed !== (s.kitEligibility.reason === null))
  )
    throw new Error("Não foi possível conferir a proteção disponível");
  const monthly = s.monthlyKits;
  if (
    s.automaticNotices !== undefined &&
    (!Array.isArray(s.automaticNotices) ||
      s.automaticNotices.length > 100 ||
      !s.automaticNotices.every(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof p.id === "string" &&
          validDate(p.day) &&
          p.day < s.today &&
          timestamp(p.usedAt) &&
          s.protections.some(
            (saved) =>
              saved.id === p.id &&
              saved.day === p.day &&
              saved.usedAt === p.usedAt,
          ),
      ) ||
      new Set(s.automaticNotices.map((p) => p.id)).size !==
        s.automaticNotices.length)
  )
    throw new Error("Não foi possível conferir as proteções automáticas");
  if (
    (s.rules.kitUsageLimit === "inventory" && !monthly) ||
    (monthly !== undefined &&
      (!monthly ||
        !validDate(monthly.month) ||
        monthly.month !== `${s.today.slice(0, 7)}-01` ||
        monthly.renewsOn !== `${shiftMonth(s.today.slice(0, 7), 1)}-01` ||
        !natural(monthly.allowance) ||
        !natural(monthly.freeAvailable) ||
        !natural(monthly.purchasedAvailable) ||
        monthly.freeAvailable + monthly.purchasedAvailable !== s.kits))
  )
    throw new Error("Não foi possível conferir seus kits mensais");
  new Intl.DateTimeFormat("pt-BR", { timeZone: s.timezone });
  readCoinHistory(s.history);
  return s;
}

/** null means inventory is the only limit; old servers still expose a weekly cap. */
export function kitUsesRemaining(state: EconomyState): number | null {
  return state.rules.kitUsageLimit === "inventory"
    ? null
    : Math.max(0, state.rules.weeklyKitLimit - state.kitsUsedThisWeek);
}
