import { BRAND_ASSETS } from "./brandAssets";
import { CAPIBORA } from "./brand";
import { CAPIBORA_PHRASES } from "./capiboraVoice";
import { avatarSource, type Profile } from "./profile";
import { SHARE_STYLES, frameImage } from "./cosmetics";
import { formatDay } from "./model";

export type ShareFormat = "story" | "square";
export const SHARE_MESSAGES = CAPIBORA_PHRASES.filter(
  (p) => p.context === "share",
).map((p) => p.text);

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
  styleId,
  frameId,
  preview = false,
  previewSize,
}: {
  profile: Profile | null;
  days: number;
  message: string;
  format: ShareFormat;
  date: string;
  styleId?: string;
  frameId?: string;
  preview?: boolean;
  previewSize?: number;
}): Promise<File> {
  if (
    !Number.isInteger(days) ||
    days < (preview ? 0 : 1) ||
    message.trim().length === 0 ||
    message.length > 160
  )
    throw new Error(
      "Confirme um treino e escreva uma mensagem de até 160 caracteres.",
    );
  const canvas = document.createElement("canvas");
  const logicalHeight = format === "story" ? 1920 : 1080;
  canvas.width = previewSize ?? 1080;
  canvas.height = Math.round((logicalHeight * canvas.width) / 1080);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu gerar o card.");
  if (previewSize) context.scale(canvas.width / 1080, canvas.width / 1080);
  const height = logicalHeight,
    story = format === "story";
  const palette = SHARE_STYLES[styleId ?? "classic"] ?? SHARE_STYLES.classic;
  context.fillStyle = palette.background;
  context.fillRect(0, 0, 1080, height);
  context.save();
  context.fillStyle = palette.accent;
  context.globalAlpha = 0.12;
  if (palette.pattern === "diagonal" || palette.pattern === "stripes") {
    for (
      let x = -height;
      x < 1080;
      x += palette.pattern === "stripes" ? 190 : 460
    ) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + height, height);
      context.lineTo(x + height + 65, height);
      context.lineTo(x + 65, 0);
      context.fill();
    }
  } else if (palette.pattern === "horizon") {
    context.fillRect(0, height * 0.66, 1080, height * 0.34);
  } else if (palette.pattern === "stars") {
    for (let i = 0; i < 24; i++) {
      context.beginPath();
      context.arc(
        (i * 173) % 1080,
        (i * 307) % height,
        3 + (i % 3),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.restore();
  context.fillStyle = palette.accent;
  context.fillRect(0, 0, 1080, 16);
  context.textAlign = "left";
  context.font = "700 31px Arial, sans-serif";
  context.fillStyle = palette.accent;
  let branded = false;
  if (BRAND_ASSETS.logo) {
    try {
      const logo = new Image();
      logo.src = new URL(BRAND_ASSETS.logo, document.baseURI).href;
      await logo.decode();
      const logoY = story ? 66 : 40;
      context.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-backplate")
          .trim() || "#241e1a";
      context.fillRect(72, logoY, 226, 68);
      const logoHeight = (210 * logo.naturalHeight) / logo.naturalWidth;
      context.drawImage(
        logo,
        80,
        logoY + (68 - logoHeight) / 2,
        210,
        logoHeight,
      );
      branded = true;
    } catch {
      /* The real text mark still works if the official image is unavailable offline. */
    }
  }
  if (!branded)
    context.fillText(CAPIBORA.name.toUpperCase(), 80, story ? 118 : 92);
  context.textAlign = "right";
  context.font = "24px Arial, sans-serif";
  context.fillStyle = palette.muted;
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
  const frameArt = frameId ? frameImage(frameId) : null;
  if (frameArt) {
    const overlay = new Image();
    overlay.src = frameArt;
    try {
      await overlay.decode();
    } catch {
      /* Missing official art uses default avatar. */
    }
    if (overlay.naturalWidth) {
      const overlaySize = avatarSize * 1.5;
      context.drawImage(
        overlay,
        540 - overlaySize / 2,
        avatarY + avatarSize / 2 - overlaySize / 2,
        overlaySize,
        overlaySize,
      );
    }
  }
  if (palette.pattern === "border") {
    context.strokeStyle = palette.accent;
    context.lineWidth = 4;
    context.strokeRect(35, 35, 1010, height - 70);
  }
  context.textAlign = "center";
  context.fillStyle = palette.ink;
  context.font = `600 ${story ? 39 : 28}px Arial, sans-serif`;
  context.fillText(
    profile ? `@${profile.nickname}` : "Meu progresso",
    540,
    avatarY + avatarSize + (story ? 65 : 43),
    900,
  );
  context.fillStyle = palette.accent;
  context.font = `600 ${story ? 31 : 25}px Arial, sans-serif`;
  context.fillText("MINHA OFENSIVA", 540, story ? 660 : 355);
  const digits = String(days);
  context.fillStyle = palette.ink;
  context.font = `700 ${Math.min(story ? 340 : 230, 850 / (digits.length * 0.62))}px Arial, sans-serif`;
  context.fillText(digits, 540, story ? 990 : 600);
  context.fillStyle = palette.accent;
  context.font = `600 ${story ? 50 : 37}px Arial, sans-serif`;
  context.fillText(
    days === 1 ? "dia de constância" : "dias de constância",
    540,
    story ? 1080 : 670,
  );
  context.fillStyle = palette.accent;
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
  context.fillStyle = palette.muted;
  lines.forEach((line, index) =>
    context.fillText(line, 540, messageY + index * Math.ceil(size * 1.35)),
  );
  context.fillStyle = palette.muted;
  context.font = "24px Arial, sans-serif";
  context.fillText("BORA SE MEXER.", 540, height - 80);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível gerar a imagem.")),
      "image/png",
    ),
  );
  return new File([blob], `capibora-${days}-dias-${format}.png`, {
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
