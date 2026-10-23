/** Public identity and short copy shared by the app and Web Push. No persistence IDs. */
export const CAPIBORA = {
  name: "Capibora",
  tagline: "Bora se mexer",
  description:
    "Treinos, amigos e pequenas vitórias. Sua rotina de movimento, do seu jeito.",
} as const;
export type MascotPose =
  | "neutral"
  | "judging"
  | "suspicious"
  | "happy"
  | "resting"
  | "tired"
  | "celebrating"
  | "impatient"
  | "running"
  | "training";
export type MascotPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export type VoiceContext =
  | "pending"
  | "completed"
  | "rest"
  | "protected"
  | "returning"
  | "unplanned"
  | "active"
  | "voluntary"
  | "rescheduled"
  | "signup"
  | "notification-opt-in"
  | "manual-question"
  | "registration"
  | "manual-duration"
  | "manual-aside"
  | "manual-ack"
  | "manual-declined"
  | "share"
  | "shop-purchased"
  | "arena-behind"
  | "push-gentle"
  | "push-dramatic"
  | "weight-logged"
  | "achievement-unlocked"
  | "reward-unlocked";
export type VoiceFact =
  | "pending"
  | "completed"
  | "rest"
  | "protected"
  | "returning"
  | "unplanned"
  | "active"
  | "voluntary"
  | "rescheduled"
  | "purchaseConfirmed"
  | "acceptedChallenge"
  | "behind"
  | "weightLogged"
  | "achievementConfirmed"
  | "rewardConfirmed"
  | "weightPending"
  | "socialEvent";
export type VoiceFacts = Partial<Record<VoiceFact, boolean>>;
const CONDITIONS: Record<
  VoiceContext,
  { all: VoiceFact[]; none: VoiceFact[] }
> = {
  pending: {
    all: ["pending"],
    none: [
      "completed",
      "rest",
      "protected",
      "returning",
      "unplanned",
      "active",
      "rescheduled",
      "voluntary",
    ],
  },
  completed: { all: ["completed"], none: [] },
  rest: { all: ["rest"], none: ["completed"] },
  protected: { all: ["protected"], none: ["completed"] },
  returning: {
    all: ["returning"],
    none: ["completed", "rest", "protected", "active", "unplanned"],
  },
  unplanned: { all: ["unplanned"], none: ["completed", "active"] },
  active: { all: ["active"], none: ["completed"] },
  voluntary: { all: ["voluntary", "completed"], none: [] },
  rescheduled: { all: ["rescheduled"], none: ["completed"] },
  signup: { all: [], none: [] },
  "notification-opt-in": { all: [], none: [] },
  "manual-question": { all: [], none: [] },
  registration: { all: [], none: [] },
  "manual-duration": { all: [], none: [] },
  "manual-aside": { all: [], none: [] },
  "manual-ack": { all: [], none: [] },
  "manual-declined": { all: [], none: [] },
  share: { all: [], none: [] },
  "shop-purchased": { all: ["purchaseConfirmed"], none: [] },
  "arena-behind": {
    all: ["acceptedChallenge", "behind"],
    none: ["rest", "protected"],
  },
  "weight-logged": { all: ["weightLogged"], none: [] },
  "achievement-unlocked": { all: ["achievementConfirmed"], none: [] },
  "reward-unlocked": { all: ["rewardConfirmed"], none: [] },
  "push-gentle": {
    all: ["pending"],
    none: [
      "rest",
      "protected",
      "completed",
      "rescheduled",
      "unplanned",
      "active",
    ],
  },
  "push-dramatic": {
    all: ["pending"],
    none: [
      "rest",
      "protected",
      "completed",
      "rescheduled",
      "unplanned",
      "active",
    ],
  },
};
export type MessageCategory =
  | "workout_reminder"
  | "workout_completed"
  | "rest_day"
  | "weight_reminder"
  | "weight_logged"
  | "achievement_unlocked"
  | "social_activity"
  | "challenge_progress"
  | "reward_unlocked"
  | "workout_return"
  | "onboarding"
  | "manual_confirmation"
  | "sharing"
  | "workout_active"
  | "workout_registration";
export type HumorIntensity = "light" | "teasing" | "exaggerated";
export type DayPeriod = "morning" | "afternoon" | "evening";
function phraseCategory(context: VoiceContext): MessageCategory {
  if (context === "registration") return "workout_registration";
  if (context.startsWith("manual-")) return "manual_confirmation";
  if (
    context === "signup" ||
    context === "notification-opt-in" ||
    context === "unplanned"
  )
    return "onboarding";
  if (["rest", "protected", "rescheduled"].includes(context)) return "rest_day";
  if (context === "completed" || context === "voluntary")
    return "workout_completed";
  if (context === "returning") return "workout_return";
  if (context === "active") return "workout_active";
  if (context === "share") return "sharing";
  if (context === "shop-purchased" || context === "reward-unlocked")
    return "reward_unlocked";
  if (context === "arena-behind") return "challenge_progress";
  if (context === "weight-logged") return "weight_logged";
  if (context === "achievement-unlocked") return "achievement_unlocked";
  return "workout_reminder";
}
function line(
  id: string,
  context: VoiceContext,
  text: string,
  expression: MascotPose,
) {
  const corners: MascotPosition[] = [
    "top-right",
    "bottom-left",
    "top-left",
    "bottom-right",
  ];
  const position =
    context === "active"
      ? "top-right"
      : corners[
          [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) %
            corners.length
        ];
  return {
    id,
    context,
    conditions: CONDITIONS[context],
    expression,
    position,
    text,
    title: text,
    body: "",
    category: phraseCategory(context),
    period: null,
    intensity: (id === "achievement-more"
      ? "exaggerated"
      : [
            "pending-even-me",
            "pending-sloth",
            "done-miracle",
            "done-minimum",
            "arena-behind",
            "push-dramatic",
          ].includes(id)
        ? "teasing"
        : "light") as HumorIntensity,
  };
}
export const CAPIBORA_PHRASES = [
  line("pending-what", "pending", "Tá esperando o quê?", "impatient"),
  line("pending-today", "pending", "Vai treinar ou não?", "judging"),
  line(
    "pending-sloth",
    "pending",
    "Vai treinar, bicho preguiça...",
    "impatient",
  ),
  line("pending-doubt", "pending", "Duvidoooooo...", "suspicious"),
  line("pending-see", "pending", "Quero só ver...", "suspicious"),
  line("pending-not-going", "pending", "Vai treinar não????", "judging"),
  line("pending-go", "pending", "ANDA CRIATURAAAA, bora treinar", "training"),
  line("pending-invitation", "pending", "Tá esperando um convite?", "judging"),
  line("done-paid", "completed", "Tá pago", "happy"),
  line("done-miracle", "completed", "Ki Milagre... treinou", "celebrating"),
  line("done-minimum", "completed", "Fez o mínimo, né?", "judging"),
  line("done-late", "completed", "Demorou", "happy"),
  line("done-noted", "completed", "Olha só quem treinou", "happy"),
  line("done-respect", "completed", "Aí eu respeito", "celebrating"),
  line("done-today", "completed", "Hoje foi", "happy"),
  line("done-finally", "completed", "Até que enfim", "happy"),
  line("done-good", "completed", "Boa", "celebrating"),
  line("done-thought", "completed", "Achei que nunca mais ia", "judging"),
  line("rest-allowed", "rest", "Hoje pode", "resting"),
  line("rest-rest", "rest", "Descanse", "resting"),
  line("rest-free", "rest", "Tá liberado", "resting"),
  line("protected-rest", "protected", "Hoje é pausa", "resting"),
  line("return-hello", "returning", "Olha só quem apareceu", "neutral"),
  line("return-back", "returning", "Bora de novo", "happy"),
  line("unplanned-first", "unplanned", "Primeiro, seu plano", "neutral"),
  line("active-keep", "active", "Já começou, boa", "training"),
  line("voluntary-done", "voluntary", "Treino extra, tá pago", "happy"),
  line("rescheduled-pause", "rescheduled", "Hoje ficou livre", "resting"),
  line(
    "notification-invite",
    "notification-opt-in",
    "Deixa que eu te lembro",
    "judging",
  ),
  line("signup-email", "signup", "Olha quem apareceu", "neutral"),
  line("signup-password", "signup", "Guarda essa senha, hein", "suspicious"),
  line("signup-name", "signup", "Como eu te chamo?", "neutral"),
  line("signup-ready", "signup", "Quase, sem sumir agora", "impatient"),
  line(
    "manual-question-real",
    "manual-question",
    "Esse treino aconteceu mesmo?",
    "suspicious",
  ),
  line(
    "manual-question-happened",
    "manual-question",
    "Treinou fora da sua imaginação?",
    "suspicious",
  ),
  line(
    "manual-question-earned",
    "manual-question",
    "Esse tempo foi de treino mesmo?",
    "judging",
  ),
  line(
    "manual-question-honest",
    "manual-question",
    "Tá falando a verdade sobre o treino?",
    "suspicious",
  ),
  line(
    "manual-question-witness",
    "manual-question",
    "Quem viu confirmaria esse treino?",
    "judging",
  ),
  line(
    "manual-question-truth",
    "manual-question",
    "Confirma esse treino sem inventar?",
    "suspicious",
  ),
  line(
    "manual-question-effort",
    "manual-question",
    "Você dedicou esse tempo a treinar?",
    "judging",
  ),
  line(
    "manual-question-not-invented",
    "manual-question",
    "Você garante que o treino foi real?",
    "suspicious",
  ),
  line(
    "manual-question-outside-head",
    "manual-question",
    "Esse treino existiu de verdade?",
    "judging",
  ),
  line(
    "manual-question-flame",
    "manual-question",
    "Você confirma que esse treino aconteceu?",
    "suspicious",
  ),
  line(
    "registration-greeting",
    "registration",
    "Acho bom mesmo... Na próxima, não demore tanto",
    "judging",
  ),
  line(
    "manual-duration-short",
    "manual-duration",
    "Cê tá de sacanagem, né?",
    "judging",
  ),
  line("manual-think", "manual-aside", "Pensa bem", "suspicious"),
  line("manual-know", "manual-aside", "Só você sabe", "judging"),
  line("manual-sure", "manual-aside", "Tá certo disso?", "suspicious"),
  line("manual-believe", "manual-ack", "Tá, vou acreditar", "suspicious"),
  line("manual-i-see", "manual-ack", "Sei...", "judging"),
  line("manual-okay", "manual-ack", "Aham", "suspicious"),
  line("manual-honest", "manual-declined", "Honestidade, gostei", "neutral"),
  line("share-paid", "share", "Tá pago, sem discurso", "happy"),
  line("share-moved", "share", "Me mexi, e você?", "judging"),
  line("share-again", "share", "Mais um treino na conta", "happy"),
  line("shop-bought", "shop-purchased", "Bom gosto, anotado", "happy"),
  line("arena-behind", "arena-behind", "Tá ficando pra trás", "judging"),
  line(
    "push-gentle",
    "push-gentle",
    "Seu treino de hoje está no plano",
    "neutral",
  ),
  line("push-dramatic", "push-dramatic", "Vai hoje ou não?", "impatient"),
  line("weight-noted", "weight-logged", "Anotado", "happy"),
  line("weight-saved", "weight-logged", "Tá registrado", "happy"),
  line("weight-another", "weight-logged", "Mais um registro", "neutral"),
  line("weight-ready", "weight-logged", "Pronto", "neutral"),
  line("weight-remembered", "weight-logged", "Até que você lembra", "judging"),
  line(
    "achievement-got",
    "achievement-unlocked",
    "Tá podendo, hein",
    "celebrating",
  ),
  line(
    "achievement-more",
    "achievement-unlocked",
    "MAIS UMAAAAA",
    "celebrating",
  ),
  line("reward-new", "reward-unlocked", "EITA!", "happy"),
  line("rest-finally", "rest", "Finalmenteeeee", "resting"),
  line("rest-us", "rest", "Hoje é nosso dia", "resting"),
  line("rest-neither", "rest", "Hoje nós dois não vamos", "resting"),
] as const;
export function selectCapiboraPhrase(
  context: VoiceContext,
  seed = 0,
  facts: VoiceFacts = {},
  previousId?: string,
) {
  const eligible = CAPIBORA_PHRASES.filter(
    (p) =>
      p.context === context &&
      p.conditions.all.every((f) => facts[f] === true) &&
      p.conditions.none.every((f) => facts[f] !== true),
  );
  const fresh = eligible.filter((p) => p.id !== previousId);
  const pool = fresh.length ? fresh : eligible;
  return pool.length
    ? pool[((Math.trunc(seed) % pool.length) + pool.length) % pool.length]
    : undefined;
}
export const phraseText = (
  context: VoiceContext,
  seed = 0,
  facts: VoiceFacts = {},
) => selectCapiboraPhrase(context, seed, facts)?.text ?? "";

/** Notification copy only. This catalog never schedules or authorizes an event. */
function message(
  id: string,
  category: MessageCategory,
  period: DayPeriod | null,
  intensity: HumorIntensity,
  title: string,
  body: string,
  expression: MascotPose,
) {
  const conditions =
    category === "workout_reminder"
      ? CONDITIONS["push-gentle"]
      : category === "weight_reminder"
        ? { all: ["weightPending"] as VoiceFact[], none: [] as VoiceFact[] }
        : category === "social_activity"
          ? { all: ["socialEvent"] as VoiceFact[], none: [] as VoiceFact[] }
          : category === "challenge_progress"
            ? CONDITIONS["arena-behind"]
            : category === "achievement_unlocked"
              ? CONDITIONS["achievement-unlocked"]
              : category === "reward_unlocked"
                ? CONDITIONS["reward-unlocked"]
                : CONDITIONS.completed;
  return {
    id,
    category,
    context: category,
    period,
    intensity,
    title,
    body,
    conditions,
    expression,
  };
}
export const CAPIBORA_NOTIFICATIONS = [
  message(
    "morning-sloth",
    "workout_reminder",
    "morning",
    "teasing",
    "Bom dia, bicho preguiça",
    "Hoje tem treino, viu?",
    "judging",
  ),
  message(
    "morning-athlete",
    "workout_reminder",
    "morning",
    "teasing",
    "Bom dia, atleta",
    "Atleta é modo de dizer, né?",
    "judging",
  ),
  message(
    "morning-today",
    "workout_reminder",
    "morning",
    "light",
    "Já acordou pra vida?",
    "Porque o treino não vai se fazer sozinho",
    "neutral",
  ),
  message(
    "morning-move",
    "workout_reminder",
    "morning",
    "light",
    "Vai ficar na cama até quando?",
    "Bora levantar que hoje tem treino",
    "neutral",
  ),
  message(
    "morning-wake",
    "workout_reminder",
    "morning",
    "exaggerated",
    "ACORDAAAAA",
    "Tem treino te esperando hoje",
    "impatient",
  ),
  message(
    "morning-good",
    "workout_reminder",
    "morning",
    "exaggerated",
    "BOM DIAAAAA, PREGUIÇA",
    "Já acordou pensando em fugir do treino?",
    "judging",
  ),
  message(
    "afternoon-wait",
    "workout_reminder",
    "afternoon",
    "light",
    "Tá esperando um convite?",
    "Pois considere-se convidado",
    "judging",
  ),
  message(
    "afternoon-today",
    "workout_reminder",
    "afternoon",
    "light",
    "Não se faça de doido",
    "Você sabe que tem treino hoje",
    "neutral",
  ),
  message(
    "afternoon-where",
    "workout_reminder",
    "afternoon",
    "teasing",
    "Vai treinar não????",
    "Já passou da hora de sair da enrolação",
    "impatient",
  ),
  message(
    "afternoon-capy",
    "workout_reminder",
    "afternoon",
    "teasing",
    "O SOFÁ TE SEQUESTROU?",
    "Pisca duas vezes se precisar de ajuda",
    "judging",
  ),
  message(
    "afternoon-count",
    "workout_reminder",
    "afternoon",
    "teasing",
    "Eu vou contar até três",
    "UM... DOIS...",
    "impatient",
  ),
  message(
    "afternoon-bora",
    "workout_reminder",
    "afternoon",
    "exaggerated",
    "BOOOOOORA TREINAAAAAAR",
    "Tá esperando o quê????",
    "training",
  ),
  message(
    "afternoon-go",
    "workout_reminder",
    "afternoon",
    "exaggerated",
    "VAI LOGOOOO",
    "Eu tô esperando esse treino",
    "judging",
  ),
  message(
    "evening-pending",
    "workout_reminder",
    "evening",
    "light",
    "E O TREINO, HEIN????",
    "Vai deixar pra última hora de novo?",
    "judging",
  ),
  message(
    "evening-wait",
    "workout_reminder",
    "evening",
    "light",
    "TIC TAC TIC TAC",
    "O dia tá acabando, hein",
    "neutral",
  ),
  message(
    "evening-gone",
    "workout_reminder",
    "evening",
    "teasing",
    "A GENTE VAI FINGIR QUE NÃO VIU?",
    "Esse treino ainda tá pendente",
    "judging",
  ),
  message(
    "evening-give-up",
    "workout_reminder",
    "evening",
    "teasing",
    "Eu desisto",
    "Mentira, ainda dá tempo",
    "impatient",
  ),
  message(
    "evening-last",
    "workout_reminder",
    "evening",
    "teasing",
    "Ainda dá tempo?",
    "Dá sim, mas não enrola",
    "judging",
  ),
  message(
    "evening-impossible",
    "workout_reminder",
    "evening",
    "exaggerated",
    "NÃO É POSSÍVEEEEEL",
    "Ainda não treinou????",
    "impatient",
  ),
  message(
    "evening-sloth",
    "workout_reminder",
    "evening",
    "exaggerated",
    "BICHO PREGUIÇAAAAA",
    "Vai hoje ou não????",
    "judging",
  ),
  message(
    "evening-amada",
    "workout_reminder",
    "evening",
    "teasing",
    "Amada????",
    "Cadê esse treino, criatura?",
    "judging",
  ),
  message(
    "weight-scale",
    "weight_reminder",
    null,
    "light",
    "ALÔ, BALANÇA",
    "Hoje é dia de registrar o peso",
    "neutral",
  ),
  message(
    "weight-remember",
    "weight_reminder",
    null,
    "light",
    "Lembrou da balança?",
    "Seu registro tá pendente",
    "neutral",
  ),
  message(
    "weight-write",
    "weight_reminder",
    null,
    "light",
    "Só falta anotar",
    "Hoje tem registro de peso",
    "neutral",
  ),
  message(
    "weight-psst",
    "weight_reminder",
    null,
    "light",
    "Psiu",
    "Lembrete de registrar o peso",
    "neutral",
  ),
  message(
    "weight-update",
    "weight_reminder",
    null,
    "light",
    "Bora atualizar isso aí",
    "Dia de acompanhar seu peso",
    "neutral",
  ),
  message(
    "social-look",
    "social_activity",
    null,
    "light",
    "IH, OLHA LÁ 👀",
    "Tem treino registrado no seu grupo",
    "happy",
  ),
  message(
    "social-resolved",
    "social_activity",
    null,
    "teasing",
    "Olha quem resolveu treinar",
    "Tem gente treinando no seu grupo",
    "judging",
  ),
  message(
    "social-quiet",
    "social_activity",
    null,
    "teasing",
    "EU NÃO QUERIA FALAR NADA...",
    "Mas tem gente treinando no seu grupo",
    "judging",
  ),
  message(
    "challenge-passed",
    "challenge_progress",
    null,
    "teasing",
    "Tá ficando pra trás",
    "Te passaram no desafio",
    "judging",
  ),
  message(
    "achievement-medal",
    "achievement_unlocked",
    null,
    "light",
    "Tá podendo, hein",
    "Você conquistou uma medalha",
    "celebrating",
  ),
  message(
    "achievement-again",
    "achievement_unlocked",
    null,
    "teasing",
    "Tá se achando, né?",
    "Você desbloqueou uma conquista",
    "celebrating",
  ),
  message(
    "reward-pots",
    "reward_unlocked",
    null,
    "teasing",
    "Tá rico, é?",
    "Você ganhou potes de proteína",
    "happy",
  ),
  message(
    "reward-inventory",
    "reward_unlocked",
    null,
    "light",
    "Olha só",
    "Tem novidade no seu inventário",
    "happy",
  ),
] as const;
export const CAPIBORA_MESSAGES = [
  ...CAPIBORA_PHRASES,
  ...CAPIBORA_NOTIFICATIONS,
];
export type NotificationSelection = {
  category: MessageCategory;
  day: string;
  hour: number;
  minute?: number;
  selectionKey: string;
  tone: "gentle" | "dramatic";
  facts: VoiceFacts;
  recentIds?: string[];
  lastExaggeratedDay?: string | null;
  existingId?: string | null;
  minimumMinutes?: number;
};
export function dayPeriod(hour: number): DayPeriod {
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
function voiceHash(key: string) {
  return [...key].reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
}
/** Stable retries; recent IDs and exaggerated-day history come from the server queue. */
export function selectCapiboraNotification(input: NotificationSelection) {
  const { category, day, hour, facts, tone } = input;
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  if (!Number.isFinite(ordinal) || hour < (category === "workout_reminder" ? 6 : 8) || hour >= 22) return undefined;
  if (
    category === "workout_reminder" &&
    1440 - hour * 60 - (input.minute ?? 0) < (input.minimumMinutes ?? 35)
  )
    return undefined;
  const eligible = CAPIBORA_NOTIFICATIONS.filter(
    (p) =>
      p.category === category &&
      (!p.period || p.period === dayPeriod(hour)) &&
      p.conditions.all.every((f) => facts[f] === true) &&
      p.conditions.none.every((f) => facts[f] !== true) &&
      (tone === "dramatic" || p.intensity === "light"),
  );
  // A leased retry keeps its original copy, never a new random message.
  const existing = eligible.find((p) => p.id === input.existingId);
  if (existing) return existing;
  const exaggeratedAllowed =
    tone === "dramatic" &&
    (ordinal + voiceHash(input.selectionKey)) % 5 === 0 &&
    (!input.lastExaggeratedDay ||
      Date.parse(`${input.lastExaggeratedDay}T00:00:00Z`) <
        (ordinal - 1) * 86400000);
  const normal = eligible.filter((p) => p.intensity !== "exaggerated");
  const pool = exaggeratedAllowed
    ? eligible.filter((p) => p.intensity === "exaggerated")
    : normal;
  const available = pool.length ? pool : normal;
  const fresh = available.filter((p) => !input.recentIds?.includes(p.id));
  const notLast = available.filter((p) => p.id !== input.recentIds?.[0]);
  const choices = fresh.length ? fresh : notLast.length ? notLast : available;
  return choices[
    (ordinal + voiceHash(input.selectionKey)) % Math.max(choices.length, 1)
  ];
}

/** A real, authorized group event has no day-period copy. The existing SQL queue
 * validates quiet hours/membership before this deterministic cosmetic choice. */
export function selectSocialNotification(eventKey: string) {
  const copies = CAPIBORA_NOTIFICATIONS.filter(
    (p) => p.category === "social_activity",
  );
  return copies[voiceHash(eventKey) % copies.length];
}
