import { avatarSource, type Profile } from "./profile";
import { formatDay } from "./model";

export type ShareFormat = "story" | "square";
export const SHARE_MESSAGES = [
  "Nem todo dia é fácil, mas tô fazendo isso por mim. Um dia de cada vez.",
  "Hoje eu tirei um tempo pra cuidar de mim. Pequenos passos também são progresso.",
  "Sem perfeição, só constância. Feliz por não ter desistido de mim hoje.",
];

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of [...text.trim().replace(/\s+/g, " ")]) {
    if (context.measureText(line + char).width > maxWidth && line) {
      const space = line.lastIndexOf(" ");
      if (space > 0) {
        lines.push(line.slice(0, space));
        line = line.slice(space + 1) + char;
      } else {
        lines.push(line);
        line = char;
      }
    } else line += char;
  }
  if (line) lines.push(line.trim());
  return lines;
}

export async function createShareImage({
  profile,
  days,
  message,
  format,
  date,
}: {
  profile: Profile | null;
  days: number;
  message: string;
  format: ShareFormat;
  date: string;
}): Promise<File> {
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    message.trim().length === 0 ||
    message.length > 160
  )
    throw new Error(
      "Confirme um treino e escreva uma mensagem de até 160 caracteres.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = format === "story" ? 1920 : 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu gerar o card.");
  const height = canvas.height,
    story = format === "story";
  context.fillStyle = "#211b18";
  context.fillRect(0, 0, 1080, height);
  context.fillStyle = "#ef6422";
  context.fillRect(0, 0, 1080, 16);
  context.textAlign = "left";
  context.font = "700 31px Arial, sans-serif";
  context.fillStyle = "#ff8a4c";
  context.fillText("FOKUSTRAINER", 80, story ? 118 : 92);
  context.textAlign = "right";
  context.font = "24px Arial, sans-serif";
  context.fillStyle = "#bca89a";
  context.fillText(
    formatDay(date, { day: "2-digit", month: "short", year: "numeric" }),
    1000,
    story ? 118 : 92,
  );
  const avatar = new Image();
  avatar.src = avatarSource(profile);
  await avatar.decode();
  const avatarY = story ? 300 : 145,
    avatarSize = story ? 130 : 88;
  context.save();
  context.beginPath();
  context.arc(540, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    avatar,
    540 - avatarSize / 2,
    avatarY,
    avatarSize,
    avatarSize,
  );
  context.restore();
  context.textAlign = "center";
  context.fillStyle = "#f8efe9";
  context.font = `600 ${story ? 39 : 28}px Arial, sans-serif`;
  context.fillText(
    profile ? `@${profile.nickname}` : "Meu progresso",
    540,
    avatarY + avatarSize + (story ? 65 : 43),
    900,
  );
  context.fillStyle = "#e6773c";
  context.font = `600 ${story ? 31 : 25}px Arial, sans-serif`;
  context.fillText("MINHA OFENSIVA", 540, story ? 660 : 355);
  const digits = String(days);
  context.fillStyle = "#fff7ef";
  context.font = `700 ${Math.min(story ? 340 : 230, 850 / (digits.length * 0.62))}px Arial, sans-serif`;
  context.fillText(digits, 540, story ? 990 : 600);
  context.fillStyle = "#ff8a4c";
  context.font = `600 ${story ? 50 : 37}px Arial, sans-serif`;
  context.fillText(
    days === 1 ? "dia de constância" : "dias de constância",
    540,
    story ? 1080 : 670,
  );
  context.fillStyle = "#ef6422";
  context.fillRect(485, story ? 1190 : 727, 110, 5);
  const messageY = story ? 1345 : 794;
  let size = story ? 49 : 35;
  context.font = `${size}px Arial, sans-serif`;
  let lines = wrapText(context, message, 860);
  while (
    size > 20 &&
    lines.length * Math.ceil(size * 1.35) > height - messageY - 145
  ) {
    size--;
    context.font = `${size}px Arial, sans-serif`;
    lines = wrapText(context, message, 860);
  }
  context.fillStyle = "#e3cec0";
  lines.forEach((line, index) =>
    context.fillText(line, 540, messageY + index * Math.ceil(size * 1.35)),
  );
  context.fillStyle = "#9f8370";
  context.font = "24px Arial, sans-serif";
  context.fillText("SEU RITMO. SUA JORNADA.", 540, height - 80);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível gerar a imagem.")),
      "image/png",
    ),
  );
  return new File([blob], `fokustrainer-${days}-dias-${format}.png`, {
    type: "image/png",
  });
}

export function downloadShareImage(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
