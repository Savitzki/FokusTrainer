import type { PhrasePreferences } from "./phrasePreferences";

export const MOTIVATIONAL_PHRASES = [
  "Vai cumprir ou vai sumir?",
  "Cadê a atitude agora?",
  "Vai amarelar, meu consagrado?",
  "Você prometeu ou eu inventei?",
  "Vai desistir logo hoje?",
  "Chega de dizer que vai",
  "Tá esperando quem por você?",
  "Quer mesmo ou só fala?",
  "O dia acaba com ou sem treino",
  "Assume o que você prometeu",
  "Teu compromisso dura quanto?",
  "Bora cumprir essa promessa",
  "Hoje também vai ficar devendo?",
  "Prova que não era só papo",
  "Cadê a vontade de ontem?",
  "Amanhã de novo? Sério?",
  "Vai largar tudo por hoje?",
  "Teu resultado precisa de atitude",
  "Já deu de negociar contigo",
  "O combinado foi treinar",
  "Cadê aquela coragem toda?",
  "Hoje você vai ou desiste?",
  "Não some na hora de fazer",
  "Decide antes que o dia acabe",
  "É compromisso ou conversa?",
  "Quer mudar? Então aparece",
  "Quanto tempo mais de desculpa?",
  "Hoje eu quero ver atitude",
  "Treina antes de se arrepender",
  "Você vai cumprir dessa vez?",
  "Tá difícil? Faz o possível",
  "Teu esforço ficou pra quando?",
  "Mais um dia sem cumprir?",
  "A tua promessa tá valendo?",
  "Ninguém vai fazer por você",
  "Não abandona o que começou",
  "Cê falou que ia levar a sério",
  "Sem treino e com desculpa?",
  "Bora, chega de adiar 🔥",
  "Você sabe o que precisa fazer",
  "E aí, vai honrar tua palavra?",
  "Hoje não dá pra só prometer",
  "Tá com medo de se superar?",
  "Levanta e resolve isso hoje",
  "Vai encarar ou deixar passar?",
  "A vontade sumiu tão rápido?",
  "O treino de hoje tá esperando",
  "Mostra que você tá falando sério",
  "Já desistiu ou ainda vai?",
  "Faz por você, mas faz hoje",
] as const;
export const COMPLETED_PHRASES = [
  "Fez e calou a dúvida 🔥",
  "Agora pode falar que fez",
  "Cumpriu sem precisar de plateia",
  "Foi difícil e você foi mesmo",
  "Hoje tua atitude falou alto",
  "Tá pago, agora respira",
  "Você fez o que prometeu",
  "Hoje você não se abandonou",
  "Aí sim, honrou tua palavra",
  "Sem papo, treino confirmado",
  "Agora sim, pode se orgulhar",
  "Quem duvidou ficou sem assunto",
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
    if ([...name].length > 8) return done ? `Fez, ${name} 🔥` : `Vai, ${name}`;
    const named = done
      ? [`Tá pago, ${name} 🔥`, `${name}, honrou`, `${name}, fez e calou`]
      : [
          `${name}, vai desistir?`,
          `${name}, cadê a atitude?`,
          `${name}, prometeu à toa?`,
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
