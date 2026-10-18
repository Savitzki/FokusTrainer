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
  | "manual-question"
  | "manual-aside"
  | "manual-ack"
  | "manual-declined"
  | "share"
  | "shop-purchased"
  | "arena-behind"
  | "push-gentle"
  | "push-dramatic";
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
  | "behind";
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
  "manual-question": { all: [], none: [] },
  "manual-aside": { all: [], none: [] },
  "manual-ack": { all: [], none: [] },
  "manual-declined": { all: [], none: [] },
  share: { all: [], none: [] },
  "shop-purchased": { all: ["purchaseConfirmed"], none: [] },
  "arena-behind": {
    all: ["acceptedChallenge", "behind"],
    none: ["rest", "protected"],
  },
  "push-gentle": {
    all: ["pending"],
    none: ["rest", "protected", "completed", "rescheduled", "unplanned"],
  },
  "push-dramatic": {
    all: ["pending"],
    none: ["rest", "protected", "completed", "rescheduled", "unplanned"],
  },
};
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
  };
}
export const CAPIBORA_PHRASES = [
  line("pending-what", "pending", "Tá esperando o quê?", "impatient"),
  line("pending-today", "pending", "Vai hoje ou não?", "judging"),
  line("pending-even-me", "pending", "Até eu treino, e você?", "judging"),
  line(
    "pending-sloth",
    "pending",
    "Vai treinar, bicho preguiça...",
    "impatient",
  ),
  line("pending-doubt", "pending", "Duvido.", "suspicious"),
  line("pending-see", "pending", "Quero ver.", "suspicious"),
  line("pending-go", "pending", "Bora, sem discurso.", "training"),
  line("pending-time", "pending", "Já deu de enrolar.", "impatient"),
  line("pending-plan", "pending", "Tá no plano, hein.", "judging"),
  line("pending-ready", "pending", "E aí, bora?", "neutral"),
  line("done-paid", "completed", "Tá pago.", "happy"),
  line("done-miracle", "completed", "Milagre.", "celebrating"),
  line("done-minimum", "completed", "Fez o mínimo, né?", "judging"),
  line("done-late", "completed", "Demorou.", "happy"),
  line("done-noted", "completed", "Anotado. Sem alarde.", "happy"),
  line("done-respect", "completed", "Aí eu respeito.", "celebrating"),
  line("rest-allowed", "rest", "Hoje pode.", "resting"),
  line("rest-rest", "rest", "Descansa.", "resting"),
  line("rest-free", "rest", "Tá liberado.", "resting"),
  line("protected-rest", "protected", "Hoje é pausa.", "resting"),
  line("return-hello", "returning", "Olha quem apareceu.", "neutral"),
  line("return-back", "returning", "Bora de novo.", "happy"),
  line("unplanned-first", "unplanned", "Primeiro, seu plano.", "neutral"),
  line("active-keep", "active", "Já começou. Boa.", "training"),
  line("voluntary-done", "voluntary", "Treino extra. Tá pago.", "happy"),
  line("rescheduled-pause", "rescheduled", "Hoje ficou livre.", "resting"),
  line("signup-email", "signup", "Olha quem apareceu.", "neutral"),
  line("signup-password", "signup", "Guarda essa senha, hein.", "suspicious"),
  line("signup-name", "signup", "Como eu te chamo?", "neutral"),
  line("signup-ready", "signup", "Quase. Sem sumir agora.", "impatient"),
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
  line("manual-think", "manual-aside", "Pensa bem.", "suspicious"),
  line("manual-know", "manual-aside", "Só você sabe.", "judging"),
  line("manual-sure", "manual-aside", "Tá certo disso?", "suspicious"),
  line("manual-believe", "manual-ack", "Tá. Vou acreditar.", "suspicious"),
  line("manual-i-see", "manual-ack", "Sei...", "judging"),
  line("manual-okay", "manual-ack", "Aham.", "suspicious"),
  line("manual-honest", "manual-declined", "Honestidade. Gostei.", "neutral"),
  line("share-paid", "share", "Tá pago. Sem discurso.", "happy"),
  line("share-moved", "share", "Me mexi. E você?", "judging"),
  line("share-again", "share", "Mais um treino na conta.", "happy"),
  line("shop-bought", "shop-purchased", "Bom gosto. Anotado.", "happy"),
  line("arena-behind", "arena-behind", "Tá ficando pra trás.", "judging"),
  line(
    "push-gentle",
    "push-gentle",
    "Seu treino de hoje está no plano.",
    "neutral",
  ),
  line("push-dramatic", "push-dramatic", "Vai hoje ou não?", "impatient"),
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
