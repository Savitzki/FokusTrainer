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

export function motivationFor(
  done: boolean,
  index: number,
  preferences?: PhrasePreferences & { fallbackName?: string },
) {
  const general = done ? COMPLETED_PHRASES : MOTIVATIONAL_PHRASES;
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
  const phrase: string = general[index % general.length];
  if (!preferences) return phrase;
  return phrase.replace(
    /meu consagrado/gi,
    preferences.treatment === "feminine"
      ? "consagrada"
      : preferences.treatment === "masculine"
        ? "meu consagrado"
        : "parça",
  );
}
