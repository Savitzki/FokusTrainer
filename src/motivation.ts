import { readHomeState, type HomeState } from "./homeState";
import type { PhrasePreferences } from "./phrasePreferences";

export const MOTIVATIONAL_PHRASES = [
  "Vai treinar ou meter o louco?",
  "O sofá já te botou na lista",
  "Cadê o treino, meu consagrado?",
  "Mete o treino, não o caô",
  "Sumiu por quê, celebridade?",
  "A desculpa veio pronta de novo?",
  "Bora ou vai ficar no migué?",
  "Seu tênis virou enfeite?",
  "A chama viu teu story 👀",
  "Cê prometeu, eu anotei",
  "Treino ou mais um amanhã?",
  "Bora, que o sofá tá se achando",
  "Falar bora também não conta",
  "Muito papo, pouca chama",
  "A preguiça já te deu bom dia?",
  "Tá devendo um treino, hein",
  "Hoje tem treino ou fanfic?",
  "Eu vi esse amanhã ontem",
  "O migué tá perdendo a graça",
  "Bora honrar esse tênis",
  "Cadê aquela marra toda?",
  "A chama cansou do sumiço 🔥",
  "O grupo quer ver o recibo",
  "Promessa não acende chama",
  "Já enrolou o suficiente, né?",
  "O treino não vai se fazer só",
  "Bora antes de inventar moda",
  "Teu sofá tá íntimo demais",
  "Hoje cê vai ou vai de caô?",
  "A desculpa tá sem criatividade",
  "Manda um treino, não um áudio",
  "O tênis não se comprou à toa",
  "Vai deixar a chama no vácuo?",
  "O próximo vídeo pode esperar",
  "Só falta combinar com o corpo",
  "A fofoca é que hoje tu treina",
  "Bora sair do modo promessa",
  "Já deu de negociar com o sofá",
  "O grupo não vive de promessa",
  "A chama tá cobrando presença",
  "Teu amanhã pediu demissão",
  "Hoje tu rende ou se rende?",
  "A marra tá boa, falta o treino",
  "Bora fazer e contar vantagem",
  "A preguiça tá muito folgada",
  "Treina e depois faz o drama",
  "Cadê você no rolê do treino?",
  "O sofá não precisa de reforço",
  "De papo a chama não vive",
  "Tá online, dá sinal no treino",
] as const;
export const COMPLETED_PHRASES = [
  "Agora sim, pode meter marra 🔥",
  "Tá pago, pode tirar onda",
  "Hoje o migué perdeu feio",
  "Treinou e ainda rendeu fofoca",
  "O grupo que lute pra alcançar",
  "Fez o teu, agora respira",
  "Aí sim, veio com o recibo",
  "Teu sofá vai ter que superar",
  "Falou e fez, gostei de ver",
  "A chama parou de te cobrar",
  "Agora conta vantagem com razão",
  "Tá vendo? Tu desenrola",
] as const;

// Expressions are a light regional inspiration, never a claim that everyone
// in a state speaks alike. The user can switch states or choose general copy.
export const REGIONAL_PHRASES: Record<
  HomeState,
  { before: string[]; after: string[] }
> = {
  AC: {
    before: [
      "Bora, que o migué já deu",
      "Tu vai ou vai só prometer?",
      "Te orienta, bora treinar",
    ],
    after: ["Aí sim, tu desenrolou", "Tá pago, pode tirar onda"],
  },
  AL: {
    before: [
      "Oxe, cadê teu treino?",
      "Bora, deixa de arrodeio",
      "Tu vai ou é só conversa?",
    ],
    after: ["Oxe, hoje tu tirou onda", "Tá pago, foi massa demais"],
  },
  AP: {
    before: [
      "Bora, mana, cadê o treino?",
      "Te orienta, a chama tá vendo",
      "Tu vai ou é só promessa?",
    ],
    after: ["Égua, tu mandou bem", "Tá pago, foi só o começo"],
  },
  AM: {
    before: [
      "Bora, mano, cadê o treino?",
      "Leso é o sofá, te mexe",
      "Tu vai ou vai meter migué?",
    ],
    after: ["É doido, mandou bem", "Tá pago, tu desenrolou"],
  },
  BA: {
    before: [
      "Ô, meu rei, cadê o treino?",
      "Bora, que o caô já deu",
      "Tá só no amanhã, é?",
    ],
    after: ["Aí sim, foi barril 🔥", "Tá pago, pode tirar onda"],
  },
  CE: {
    before: [
      "Ei, mah, bora treinar?",
      "Deixa de arrudeio, bora",
      "A chama tá só te manjando",
    ],
    after: ["Aí sim, mah, tá pago", "Hoje tu foi arretado"],
  },
  DF: {
    before: [
      "Véi, cadê esse treino?",
      "Tá só no balão, é?",
      "Bora, véi, sem enrolar",
    ],
    after: ["Aí sim, véi, tá pago", "Mandou bem, pode botar fé"],
  },
  ES: {
    before: [
      "Pô, cadê teu treino?",
      "Tá pocando só no migué?",
      "Bora pocar nesse treino",
    ],
    after: ["Pocou no treino, hein", "Tá pago, mandou bem demais"],
  },
  GO: {
    before: [
      "Uai, cadê esse treino?",
      "Bora, deixa de trem ruim",
      "Tá bão de sair do sofá, né?",
    ],
    after: ["Aí sim, trem bão demais", "Tá pago, agora proseia"],
  },
  MA: {
    before: [
      "Égua, cadê esse treino?",
      "Tu vai ou tá só no migué?",
      "Bora, deixa de arrudeio",
    ],
    after: ["Égua, tu mandou bem", "Tá pago, pode tirar onda"],
  },
  MT: {
    before: [
      "Bora, deixa de conversa",
      "Tá só no amanhã, né?",
      "Teu sofá tá se achando, hein",
    ],
    after: ["Aí sim, ficou bão demais", "Tá pago, agora pode prosear"],
  },
  MS: {
    before: [
      "Bora, larga de enrolação",
      "Tá bão de sair do sofá, né?",
      "Tu vai ou só vai falar?",
    ],
    after: ["Aí sim, tá bão demais", "Tá pago, pode contar prosa"],
  },
  MG: {
    before: [
      "Uai, vai ficar só no trem?",
      "Sô, cadê esse treino?",
      "Bora, que o sofá tá bão demais",
    ],
    after: ["Ô trem bão, tá pago 🔥", "Aí sim, sô, fez bonito"],
  },
  PA: {
    before: [
      "Égua, tu vai treinar ou não?",
      "Te orienta, cadê a chama?",
      "Bora, pai d'égua é treinar",
    ],
    after: ["Pai d'égua, tá pago", "Égua, hoje tu fez bonito"],
  },
  PB: {
    before: [
      "Oxe, vai só prometer?",
      "Bora, deixa de arrodeio",
      "Visse que a chama tá vendo?",
    ],
    after: ["Arretou, visse? Tá pago", "Aí sim, foi massa demais"],
  },
  PR: {
    before: [
      "Piá, cadê esse treino?",
      "Bora ou vai só dar balão?",
      "Tá só enrolando, né, piá?",
    ],
    after: ["Aí sim, piá, tá pago", "Hoje tu caprichou, né"],
  },
  PE: {
    before: [
      "Visse? Teu treino tá devendo",
      "Bora, deixa de arrodeio",
      "Oxe, vai ficar só no caô?",
    ],
    after: ["Foi arretado, visse?", "Tá pago, pode tirar onda"],
  },
  PI: {
    before: [
      "Bora, deixa de arrudeio",
      "Oxe, cadê esse treino?",
      "Tu vai ou é só conversa?",
    ],
    after: ["Aí sim, tu se garantiu", "Tá pago, foi massa demais"],
  },
  RJ: {
    before: [
      "Qual foi, vai meter caô?",
      "Mete o treino, sem caô",
      "Tá de marola com a chama?",
    ],
    after: ["Aí sim, mandou a braba 🔥", "Tá pago, pode tirar onda"],
  },
  RN: {
    before: [
      "Oxe, cadê teu treino?",
      "Bora, deixa de arrodeio",
      "Tá só no amanhã, visse?",
    ],
    after: ["Aí sim, tu se garantiu", "Tá pago, arretou demais"],
  },
  RS: {
    before: [
      "Bah, cadê esse treino?",
      "Te mexe, tchê, bora",
      "Vai ficar só na conversa?",
    ],
    after: ["Bah, aí sim, tá pago", "Tri bem, mandou no treino"],
  },
  RO: {
    before: [
      "Bora, que esse migué já deu",
      "Tu vai ou tá só no papo?",
      "Te mexe, a chama tá vendo",
    ],
    after: ["Aí sim, tu se garantiu", "Tá pago, pode tirar onda"],
  },
  RR: {
    before: [
      "Bora, mano, cadê o treino?",
      "Tu vai ou vai só prometer?",
      "Te orienta, a chama tá vendo",
    ],
    after: ["Aí sim, mandou bem demais", "Tá pago, tu desenrolou"],
  },
  SC: {
    before: [
      "Ô, istepô, bora reagir",
      "Bora, não te faz de louco",
      "Tá só na conversa, é?",
    ],
    after: ["Aí sim, hoje tu caprichou", "Tá pago, coisa boa demais"],
  },
  SP: {
    before: [
      "Mano, vai dar esse perdido?",
      "Tá suave demais pro meu gosto",
      "Bora, mano, sem meter o louco",
    ],
    after: ["Aí sim, mandou bem, mano", "Tá pago, sem caô 🔥"],
  },
  SE: {
    before: [
      "Oxe, cadê esse treino?",
      "Bora, deixa de arrodeio",
      "Tá só de conversa, é?",
    ],
    after: ["Aí sim, foi massa demais", "Tá pago, tu se garantiu"],
  },
  TO: {
    before: [
      "Bora, deixa de enrolação",
      "Tu vai ou é só resenha?",
      "Tá bão de sair do sofá, né?",
    ],
    after: ["Aí sim, ficou bão demais", "Tá pago, pode tirar onda"],
  },
};

export function motivationFor(
  state: unknown,
  done: boolean,
  index: number,
  preferences?: PhrasePreferences & { fallbackName?: string },
) {
  const uf = readHomeState(state);
  const general = done ? COMPLETED_PHRASES : MOTIVATIONAL_PHRASES;
  const regional = uf ? REGIONAL_PHRASES[uf][done ? "after" : "before"] : null;
  const name = (preferences?.displayName || preferences?.fallbackName || "")
    .trim()
    .split(/[\s._-]+/)[0];
  if (
    preferences &&
    name &&
    [...name].length <= 12 &&
    /^[\p{L}\p{M}'-]+$/u.test(name) &&
    index % 5 === 0
  ) {
    if ([...name].length > 8) return done ? `Boa, ${name} 🔥` : `Bora, ${name}`;
    const named = done
      ? [`Tá pago, ${name} 🔥`, `Aí sim, ${name}`, `${name}, fez e calou`]
      : [
          `${name}, cadê o treino?`,
          `Bora, ${name}, sem caô`,
          `${name}, só no migué?`,
        ];
    return named[Math.floor(index / 5) % named.length];
  }
  let phrase: string =
    regional && index % 2 === 0
      ? regional[Math.floor(index / 2) % regional.length]
      : general[index % general.length];
  if (!preferences) return phrase;
  const t = preferences.treatment;
  const replacements: [RegExp, string][] = [
    [
      /meu consagrado/gi,
      t === "feminine"
        ? "consagrada"
        : t === "masculine"
          ? "meu consagrado"
          : "parça",
    ],
    [
      /meu rei/gi,
      t === "feminine"
        ? "minha rainha"
        : t === "masculine"
          ? "meu rei"
          : "parça",
    ],
    [
      /\b(mano|mana)\b/gi,
      t === "feminine" ? "mana" : t === "masculine" ? "mano" : "parça",
    ],
    [
      /(?<![\p{L}\p{M}])piá(?![\p{L}\p{M}])/giu,
      t === "feminine" ? "guria" : t === "masculine" ? "piá" : "ei",
    ],
    [
      /Hoje tu foi arretado/g,
      t === "feminine"
        ? "Hoje tu foi arretada"
        : t === "masculine"
          ? "Hoje tu foi arretado"
          : "Hoje tu se garantiu",
    ],
  ];
  for (const [pattern, replacement] of replacements)
    phrase = phrase.replace(pattern, (match) =>
      match[0] === match[0].toLocaleUpperCase("pt-BR")
        ? replacement[0].toLocaleUpperCase("pt-BR") + replacement.slice(1)
        : replacement,
    );
  return phrase;
}
