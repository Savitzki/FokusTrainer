import { describe, expect, it } from "vitest";
import {
  avatarSource,
  normalizeNickname,
  preparePhoto,
  validateProfile,
  type Profile,
} from "./profile";
import { freshData, parseData } from "./model";

const profile: Profile = {
  nickname: "júlia.treina",
  color: "orange",
  style: "initials",
  photo: null,
};
describe("perfil e compatibilidade", () => {
  it("abre dados antigos sem apagar treinos e adiciona o perfil opcional", () => {
    const { profile: ignored, ...legacy } = freshData();
    legacy.workouts.push({
      id: "old",
      date: "2026-10-16",
      activity: "Corrida",
      minutes: 30,
    });
    const loaded = parseData(JSON.stringify(legacy));
    expect(loaded.workouts).toEqual(legacy.workouts);
    expect(loaded.profile).toBeNull();
    expect(parseData(JSON.stringify({ ...loaded, profile })).profile).toEqual(
      profile,
    );
  });
  it("normaliza o nick e rejeita estilos, cores e fotos fora do formato permitido", () => {
    expect(normalizeNickname(" @Dani.treina ")).toBe("Dani.treina");
    expect(validateProfile(profile)).toEqual(profile);
    for (const invalid of [
      { nickname: "ab" },
      { nickname: "com espaço" },
      { style: "toString" },
      { color: "__proto__" },
      { photo: "data:image/svg+xml;base64,PHN2Zz4=" },
    ])
      expect(() => validateProfile({ ...profile, ...invalid })).toThrow();
  });
  it("não injeta marcação no SVG das iniciais", () => {
    const source = decodeURIComponent(
      avatarSource({ ...profile, nickname: "<x" }).split(",")[1],
    );
    expect(source).toContain("&lt;X");
    expect(source).not.toContain("<x");
  });
  it("rejeita fotos incompatíveis antes de tentar processá-las", async () => {
    await expect(
      preparePhoto(new File(["x"], "avatar.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow(/JPG, PNG ou WebP/);
  });
});
