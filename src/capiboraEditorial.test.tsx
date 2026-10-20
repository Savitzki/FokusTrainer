import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import * as shared from "../supabase/functions/_shared/capibora";
import editorial from "./capiboraEditorial.json";
import {
  CAPIBORA_PHRASES,
  CAPIBORA_NOTIFICATIONS,
  capiboraMessage,
  composeCapiboraMessage,
  selectCapiboraPhrase,
  selectCapiboraNotification,
  type VoiceFacts,
} from "./capiboraVoice";
import { MASCOT_ASSETS } from "./mascotAssets";
import { personalizeCapiboraMessage } from "./motivation";
import CapiboraMessage from "./CapiboraMessage";
import { MANUAL_FINAL_QUESTION, MANUAL_QUESTIONS } from "./manualConfirmation";
import { homeDayPresentation } from "./homeDayPresentation";

it("adapta todas as 70 falas sem trocar IDs, contratos legados, condições ou ordem", () => {
  expect(CAPIBORA_PHRASES).toHaveLength(70);
  expect(CAPIBORA_PHRASES.map((p) => p.id)).toEqual(
    shared.CAPIBORA_PHRASES.map((p) => p.id),
  );
  for (const [index, p] of CAPIBORA_PHRASES.entries()) {
    const base = shared.CAPIBORA_PHRASES[index];
    expect(p.text).toBe(base.text);
    expect(p.context).toBe(base.context);
    expect(p.conditions).toEqual(base.conditions);
    expect(p.intensity).toBe(base.intensity);
    expect(p.position).toBe(base.position);
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.body.length).toBeGreaterThan(0);
    expect(p.title.split(/\s+/).length).toBeLessThanOrEqual(5);
    expect(p.title.length).toBeLessThanOrEqual(25);
    expect(MASCOT_ASSETS[p.expression]).toBeDefined();
    expect(p.title.replaceAll("...", "")).not.toContain(".");
    expect(p.body.replaceAll("...", "")).not.toContain(".");
  }
  expect(Object.keys(editorial)).toHaveLength(80);
  for (const message of Object.values(editorial)) {
    expect(message.title.trim()).not.toBe("");
    expect(message.body.trim()).not.toBe("");
    expect(message.title.replaceAll("...", "")).not.toContain(".");
    expect(message.body.replaceAll("...", "")).not.toContain(".");
    expect(Object.keys(MASCOT_ASSETS)).toContain(message.pose);
  }
});
it("usa a mesma seleção, elegibilidade e não repetição do servidor, inclusive seeds negativos", () => {
  for (const context of new Set(
    shared.CAPIBORA_PHRASES.map((p) => p.context),
  )) {
    const sample = shared.CAPIBORA_PHRASES.find((p) => p.context === context)!;
    const facts = Object.fromEntries(
      sample.conditions.all.map((f) => [f, true]),
    ) as VoiceFacts;
    for (const seed of [-3, -0.2, 0, 1, 7, 100]) {
      const original = shared.selectCapiboraPhrase(context, seed, facts);
      expect(selectCapiboraPhrase(context, seed, facts)?.id).toBe(original?.id);
      expect(selectCapiboraPhrase(context, seed, facts, original?.id)?.id).toBe(
        shared.selectCapiboraPhrase(context, seed, facts, original?.id)?.id,
      );
    }
  }
});
it("preserva os 34 títulos/corpos de push e a seleção por período sem mudar payloads", () => {
  expect(CAPIBORA_NOTIFICATIONS).toBe(shared.CAPIBORA_NOTIFICATIONS);
  expect(CAPIBORA_NOTIFICATIONS).toHaveLength(34);
  for (const hour of [9, 17, 20, 23])
    for (const facts of [
      { pending: true },
      { pending: true, rest: true },
      { pending: true, completed: true },
      { pending: true, active: true },
    ]) {
      const input = {
        category: "workout_reminder" as const,
        day: "2026-10-20",
        hour,
        selectionKey: "synthetic",
        tone: "dramatic" as const,
        facts,
      };
      expect(selectCapiboraNotification(input)).toEqual(
        shared.selectCapiboraNotification(input),
      );
    }
});
it("personaliza o complemento, protege o título de nomes compridos e compõe canais de uma string", () => {
  const message = capiboraMessage("pending-what");
  const personal = personalizeCapiboraMessage(message, 0, {
    displayName: "Ana Clara",
    treatment: "feminine",
  });
  expect(personal.title).toBe(message.title);
  expect(personal.body).toBe("Ana, o treino tá no plano, criatura...");
  expect(composeCapiboraMessage(personal)).toBe(
    `${personal.title} ${personal.body}`,
  );
  expect(
    personalizeCapiboraMessage(message, 1, {
      displayName: "Ana",
      treatment: "neutral",
    }),
  ).toEqual(message);
  expect(
    personalizeCapiboraMessage(message, 0, {
      displayName: "<script>name</script>",
      treatment: "neutral",
    }),
  ).toEqual(message);
});
it("perguntas manuais conservam IDs, pergunta funcional e mínimo de 35 minutos", () => {
  expect(capiboraMessage("manual-final").body).toBe(MANUAL_FINAL_QUESTION);
  for (const q of MANUAL_QUESTIONS)
    expect(capiboraMessage(`manual-question-${q.id}`).body).toBe(q.text);
});
it("usa assets reais, caminhos relativos à PWA e somente cópias leves; sem imagens improvisadas", () => {
  const delivered = import.meta.glob("/public/mascot/web/*.webp", {
    eager: true,
    query: "?url",
    import: "default",
  });
  for (const asset of Object.values(MASCOT_ASSETS)) {
    const relative = asset.src.replace(/^\/capibora\//, "").replace(/^\//, "");
    expect(Object.keys(delivered)).toContain(`/public/${relative}`);
  }
  expect(MASCOT_ASSETS.running).toBeUndefined();
  expect(MASCOT_ASSETS.tired).toBeUndefined();
});
it("título, complemento e ilustração são separados e decorativos, com fallback sem arte", () => {
  const view = render(
    <CapiboraMessage
      message={capiboraMessage("pending-what")}
      variant="hero"
      heading="h1"
      titleId="page-title"
    />,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Tá esperando?",
  );
  expect(screen.getByText("O treino tá no plano, criatura...")).toHaveClass(
    "capibora-message-body",
  );
  expect(view.container.querySelector("img")).toHaveAttribute("alt", "");
  view.rerender(
    <CapiboraMessage
      message={{
        title: "Sem pressa",
        body: "A mensagem continua legível",
        expression: "running",
      }}
    />,
  );
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("A mensagem continua legível")).toBeVisible();
});
it("descanso, proteção, voluntário, reagendamento, retorno e primeiro plano não viram cobrança", () => {
  for (const kind of [
    "scheduled-rest",
    "medical-kit",
    "extra-rest",
    "rescheduled-rest",
  ] as const) {
    const day = homeDayPresentation(kind, false, "fallback");
    expect(day.context).not.toBe("pending");
    expect(day.body).toBeTruthy();
  }
  expect(homeDayPresentation("scheduled-rest", true, "fallback").context).toBe(
    "voluntary",
  );
  expect(
    homeDayPresentation("training", false, "fallback", { returning: true })
      .context,
  ).toBe("returning");
  expect(
    homeDayPresentation("training", false, "fallback", { needsPlan: true })
      .title,
  ).toBe("Quase lá!");
});
