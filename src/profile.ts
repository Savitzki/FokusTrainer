export const AVATAR_COLORS = {
  orange: { label: "Laranja", background: "#d64b13", foreground: "#fff5ed" },
  charcoal: { label: "Carvão", background: "#29211c", foreground: "#ffb383" },
  clay: { label: "Terracota", background: "#a4543a", foreground: "#fff7ed" },
  forest: { label: "Verde", background: "#356254", foreground: "#effaf2" },
  blue: { label: "Azul", background: "#365d7d", foreground: "#f0f7ff" },
  wine: { label: "Vinho", background: "#7a4051", foreground: "#fff2f5" },
} as const;
export const AVATAR_STYLES = {
  initials: "Iniciais",
  flame: "Chama",
  mountain: "Montanha",
  bolt: "Raio",
  runner: "Movimento",
} as const;
export type Profile = {
  nickname: string;
  color: keyof typeof AVATAR_COLORS;
  style: keyof typeof AVATAR_STYLES;
  photo: string | null;
};
export const blankProfile = (): Profile => ({
  nickname: "",
  color: "orange",
  style: "initials",
  photo: null,
});
export function normalizeNickname(value: string) {
  return value.normalize("NFKC").trim().replace(/^@/, "");
}
export function validateProfile(value: unknown): Profile {
  const profile = value as Profile;
  if (
    !profile ||
    typeof profile.nickname !== "string" ||
    !/^[\p{L}\p{N}_.-]{3,24}$/u.test(profile.nickname) ||
    !Object.hasOwn(AVATAR_COLORS, profile.color) ||
    !Object.hasOwn(AVATAR_STYLES, profile.style) ||
    (profile.photo !== null &&
      (typeof profile.photo !== "string" ||
        profile.photo.length > 180000 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(
          profile.photo,
        )))
  )
    throw new Error(
      "Use um nick de 3 a 24 letras, números, ponto, hífen ou sublinhado e escolha um avatar válido.",
    );
  return {
    nickname: profile.nickname,
    color: profile.color,
    style: profile.style,
    photo: profile.photo,
  };
}
const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
export function avatarSource(profile: Profile | null): string {
  if (profile?.photo) return profile.photo;
  const color = AVATAR_COLORS[profile?.color ?? "charcoal"];
  const paths = {
    flame:
      '<path d="M53 14c15 20 4 29 17 38 3-5 4-9 3-15 15 18 20 36 10 50-7 10-19 15-32 15-21 0-35-13-35-31 0-27 29-37 37-57Z" transform="translate(4 -7) scale(.95)"/>',
    mountain:
      '<path d="m15 77 25-39 15 23 11-17 22 33H15Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m32 51 8 5 7-5" fill="none" stroke="currentColor" stroke-width="4"/>',
    bolt: '<path d="m57 16-30 40h23l-7 29 31-42H52l5-27Z"/>',
    runner:
      '<circle cx="59" cy="26" r="8"/><path d="m33 43 16-6 14 16 16 1M52 40 43 61 65 76M43 61 27 81" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    initials: `<text x="50" y="53" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="35" font-weight="700">${escapeXml(profile ? [...profile.nickname].slice(0, 2).join("").toUpperCase() : "CA")}</text>`,
  };
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${color.background}"/><g color="${color.foreground}" fill="currentColor">${paths[profile?.style ?? "initials"]}</g></svg>`)}`;
}

export async function preparePhoto(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
  const objectURL = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectURL;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Não foi possível preparar a foto neste navegador.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    const photo = canvas.toDataURL("image/webp", 0.85);
    if (photo.length > 180000)
      throw new Error("A foto ficou muito grande. Tente outra imagem.");
    return photo;
  } catch (error) {
    if (error instanceof Error && /foto|navegador/.test(error.message))
      throw error;
    throw new Error("Não foi possível abrir essa foto. Tente outro arquivo.");
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}
