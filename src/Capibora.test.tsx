import { render, renderHook, act, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Brand from "./Brand";
import { CAPIBORA, cosmeticDisplayName } from "./brand";
import { STORAGE_KEY } from "./model";
import { THEME_STORAGE_KEY } from "./theme";
import { useCapiboraVoice } from "./useCapiboraVoice";
import { clearAccountStorage } from "./accountStorage";
import { homeDayPresentation } from "./homeDayPresentation";
import {
  MANUAL_QUESTIONS,
  MANUAL_FINAL_QUESTION,
  validManualConfirmation,
} from "./manualConfirmation";
import manifest from "../public/manifest.webmanifest?raw";
import lightManifest from "../public/manifest-light.webmanifest?raw";
import darkManifest from "../public/manifest-dark.webmanifest?raw";
import page from "../index.html?raw";
import worker from "../public/sw.js?raw";

it("usa a marca pública e preserva identidade, escopo e caminhos da instalação existente", () => {
  render(<Brand />);
  expect(screen.getByRole("img", { name: "Capibora" })).toHaveAttribute(
    "src",
    "brand/web/capibora-text.webp",
  );
  expect(document.querySelector("svg")).toBeNull();
  for (const source of [manifest, lightManifest, darkManifest]) {
    const data = JSON.parse(source);
    expect(data.name).toBe(CAPIBORA.name);
    expect(data.short_name).toBe("Capibora");
    expect([data.id, data.start_url, data.scope]).toEqual(["./", "./", "./"]);
    expect(data.display).toBe("standalone");
  }
  expect(page).toContain("<title>Capibora · Bora se mexer</title>");
  expect(page).toContain(
    'name="apple-mobile-web-app-title" content="Capibora"',
  );
  expect(STORAGE_KEY).toBe("fokus-trainer:v1");
  expect(THEME_STORAGE_KEY).toBe("fokus-trainer:theme");
  expect(worker).toContain("fokus-trainer:${self.registration.scope}:");
  expect(cosmeticDisplayName("Fokus")).toBe("Capibora");
  expect(cosmeticDisplayName("Chama viva")).toBe("Chama viva");
});
it("mantém estável a fala na visita, evita repeti-la ao reabrir e limpa só os dados da conta", () => {
  const key = `${STORAGE_KEY}:account:voice-a:capibora-voice`;
  const first = renderHook(() =>
    useCapiboraVoice("pending", { pending: true }, "2026-10-14", "voice-a"),
  );
  const text = first.result.current;
  first.rerender();
  expect(first.result.current).toBe(text);
  first.unmount();
  const next = renderHook(() =>
    useCapiboraVoice("pending", { pending: true }, "2026-10-14", "voice-a"),
  );
  expect(next.result.current?.id).not.toBe(text?.id);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
    pending: next.result.current?.id,
  });
  localStorage.setItem(
    `${STORAGE_KEY}:account:voice-b:capibora-voice`,
    JSON.stringify({ rest: "rest-rest" }),
  );
  clearAccountStorage("voice-a");
  expect(localStorage.getItem(key)).toBeNull();
  expect(
    localStorage.getItem(`${STORAGE_KEY}:account:voice-b:capibora-voice`),
  ).not.toBeNull();
});
it("não perde a última fala de outros contextos e funciona sem acesso ao armazenamento", () => {
  const hook = renderHook(
    ({ done }) =>
      useCapiboraVoice(
        done ? "completed" : "pending",
        done ? { completed: true } : { pending: true },
        "2026-10-14",
        "voice-c",
      ),
    { initialProps: { done: false } },
  );
  const first = hook.result.current?.id;
  hook.rerender({ done: true });
  const saved = JSON.parse(
    localStorage.getItem(`${STORAGE_KEY}:account:voice-c:capibora-voice`)!,
  );
  expect(saved.pending).toBe(first);
  expect(saved.completed).toBe(hook.result.current?.id);
  const blocked = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  const offline = renderHook(() =>
    useCapiboraVoice("rest", { rest: true }, "2026-10-17", "voice-d"),
  );
  expect(offline.result.current?.context).toBe("rest");
  blocked.mockRestore();
  write.mockRestore();
});
it("classifica a apresentação sem modificar pontos, horários ou contratos manuais", () => {
  expect(
    homeDayPresentation("training", false, "Teste", { needsPlan: true })
      .context,
  ).toBe("unplanned");
  expect(
    homeDayPresentation("training", false, "Teste", { active: true }).context,
  ).toBe("active");
  expect(
    homeDayPresentation("training", false, "Teste", { returning: true })
      .context,
  ).toBe("returning");
  expect(
    homeDayPresentation("scheduled-rest", false, "Teste", { returning: true })
      .context,
  ).toBe("rest");
  expect(homeDayPresentation("scheduled-rest", true, "Teste").context).toBe(
    "voluntary",
  );
  expect(MANUAL_QUESTIONS.map((q) => q.id)).toEqual([
    "real",
    "happened",
    "earned",
    "honest",
    "witness",
    "truth",
    "effort",
    "not-invented",
    "outside-head",
    "flame",
  ]);
  expect(MANUAL_FINAL_QUESTION).toBe(
    "Você confirma que realmente treinou por pelo menos 35 minutos?",
  );
  expect(
    validManualConfirmation({
      version: 1,
      questionIds: ["real", "flame"],
      answers: [true, true, true],
    }),
  ).toBe(true);
  expect(
    validManualConfirmation({
      version: 1,
      questionIds: ["real", "flame"],
      answers: [true, false, true],
    }),
  ).toBe(false);
});

it("usa as versões oficiais de logo por tema e preserva o nome quando a imagem falha", async () => {
  const { BRAND_ASSETS } = await import("./brandAssets");
  const originals = { ...BRAND_ASSETS };
  BRAND_ASSETS.darkLogo = "brand/official-dark-test.svg";
  BRAND_ASSETS.lightLogo = "brand/official-light-test.svg";
  const view = render(<Brand />);
  expect(screen.getByRole("img", { name: "Capibora" })).toHaveAttribute(
    "src",
    BRAND_ASSETS.darkLogo,
  );
  await act(async () => {
    document.documentElement.dataset.theme = "light";
  });
  expect(screen.getByRole("img", { name: "Capibora" })).toHaveAttribute(
    "src",
    BRAND_ASSETS.lightLogo,
  );
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.error(screen.getByRole("img", { name: "Capibora" }));
  expect(screen.getByText("Capibora")).toBeInTheDocument();
  view.unmount();
  delete BRAND_ASSETS.darkLogo;
  delete BRAND_ASSETS.lightLogo;
  Object.assign(BRAND_ASSETS, originals);
});

it("usa o texto oficial claro sem alterar o símbolo do carregamento", async () => {
  const { BRAND_ASSETS } = await import("./brandAssets");
  document.documentElement.dataset.theme = "light";
  const view = render(<Brand />);
  expect(screen.getByRole("img", { name: "Capibora" })).toHaveAttribute(
    "src",
    "brand/web/capibora-text-light.webp",
  );
  view.rerender(<Brand symbol />);
  expect(screen.getByRole("img", { name: "Capibora" })).toHaveAttribute(
    "src",
    BRAND_ASSETS.symbol,
  );
});
