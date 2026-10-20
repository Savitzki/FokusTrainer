import {
  useEffect,
  type FormEvent,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowRight, CalendarCheck, Dumbbell, Users } from "lucide-react";
import ArenaAvatar from "./ArenaAvatar";
import type { Challenge } from "./gamification";
import type { SocialState } from "./social";
export type ChallengeDraft = {
  name: string;
  kind: string;
  duration: number;
  target: number;
  recordingPolicy: string;
  selected: string[];
};
type Controls = {
  [K in keyof ChallengeDraft]: Dispatch<SetStateAction<ChallengeDraft[K]>>;
};
export default function ArenaChallengeWizard({
  draft,
  controls,
  step,
  setStep,
  formRef,
  onSubmit,
  challenges,
  friends,
  arenaVersion,
  fixedOpponent,
  rematch,
}: {
  draft: ChallengeDraft;
  controls: Controls;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  challenges: { busy: boolean };
  friends: SocialState["friends"];
  arenaVersion: number;
  fixedOpponent?: string;
  rematch: Challenge | null;
}) {
  const { name, kind, duration, target, recordingPolicy, selected } = draft;
  const {
    name: setName,
    kind: setKind,
    duration: setDuration,
    target: setTarget,
    recordingPolicy: setRecordingPolicy,
    selected: setSelected,
  } = controls;
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>(
        "fieldset.arena-wizard-page:not([hidden]) input,fieldset.arena-wizard-page:not([hidden]) select",
      )
      ?.focus({ preventScroll: true });
  }, [step, formRef]);
  return (
    <form
      className="challenge-form"
      ref={formRef}
      tabIndex={-1}
      aria-label="Configurar desafio"
      id="new-challenge-form"
      onSubmit={onSubmit}
    >
      <div className="arena-wizard-heading">
        <span className="arena-kicker">NOVO CONFRONTO</span>
        <h3>
          {step === 0
            ? "Escolha sua disputa"
            : step === 1
              ? "Defina as regras"
              : "Monte a disputa"}
        </h3>
      </div>
      <ol className="arena-wizard-steps" aria-label="Etapas do desafio">
        {["Modalidade", "Regras", "Participantes"].map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <fieldset className="arena-wizard-page" hidden={step !== 0}>
        <legend className="sr-only">Modalidade</legend>
        <label className="form-label">
          Nome do desafio
          <input
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="arena-mode-picker">
          <legend>Objetivo</legend>
          {[
            {
              value: "consistency",
              label: "Consistência",
              detail: "Cumpra seu cronograma",
              Icon: CalendarCheck,
            },
            {
              value: "frequency",
              label: "Quantidade de treinos",
              detail:
                arenaVersion >= 2
                  ? "Uma confirmação válida por dia"
                  : "Só treinos obrigatórios",
              Icon: Dumbbell,
            },
            {
              value: "collective",
              label: "Coletivo",
              detail: "Uma meta para a equipe",
              Icon: Users,
            },
          ].map((mode) => (
            <label
              key={mode.value}
              className={kind === mode.value ? "is-selected" : ""}
            >
              <input
                type="radio"
                name="challenge-kind"
                value={mode.value}
                checked={kind === mode.value}
                onChange={() => setKind(mode.value)}
              />
              <mode.Icon size={22} />
              <span>
                <strong>{mode.label}</strong>
                <small>{mode.detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </fieldset>
      <fieldset className="arena-wizard-page" hidden={step !== 1}>
        <legend className="sr-only">Regras</legend>
        <label className="form-label">
          Duração
          <select
            aria-label="Duração"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={7}>7 dias</option>
            {arenaVersion >= 2 ? (
              <>
                <option value={14}>14 dias</option>
                <option value={28}>28 dias</option>
              </>
            ) : (
              <option value={30}>30 dias</option>
            )}
          </select>
        </label>
        {kind === "collective" && (
          <label className="form-label">
            Meta conjunta
            <input
              type="number"
              required
              min={1}
              max={210}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
        )}
        <label className="form-label">
          Métodos aceitos
          <select
            aria-label="Métodos aceitos"
            value={recordingPolicy}
            onChange={(e) => setRecordingPolicy(e.target.value)}
          >
            <option value="any">Qualquer treino válido</option>
            <option value="timed">Somente treinos cronometrados</option>
          </select>
        </label>
      </fieldset>
      <fieldset className="arena-wizard-page" hidden={step !== 2}>
        <legend className="sr-only">Participantes e revisão</legend>
        <fieldset className="challenge-friends">
          <legend>
            {fixedOpponent ? "Participantes" : "Convide até 7 amigos"}
          </legend>
          {friends
            .filter((f) => !fixedOpponent || f.id === fixedOpponent)
            .map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  aria-label={`@${f.nickname}`}
                  checked={selected.includes(f.id)}
                  disabled={
                    Boolean(fixedOpponent) ||
                    (!selected.includes(f.id) && selected.length >= 7)
                  }
                  onChange={() =>
                    setSelected((p) =>
                      p.includes(f.id)
                        ? p.filter((id) => id !== f.id)
                        : [...p, f.id],
                    )
                  }
                />
                <ArenaAvatar
                  name={f.nickname}
                  avatar={f.avatar}
                  frame={f.frame}
                />
                <span>@{f.nickname}</span>
              </label>
            ))}
        </fieldset>
        {!friends.length && (
          <p className="field-hint">Adicione um amigo para começar</p>
        )}
        <details className="context-details">
          <summary>Regras do desafio</summary>
          <p>
            Começa em data futura · convites precisam de aceite antes do início
            · uma confirmação por dia · empates compartilham a posição
            {arenaVersion >= 2
              ? " · sem recompensa financeira"
              : " · só treinos obrigatórios contam"}
          </p>
        </details>
        {rematch && (
          <p className="field-hint">
            Novo convite, sem transferir pontos
            {Math.round(
              (Date.parse(rematch.end) - Date.parse(rematch.start)) / 86400000,
            ) +
              1 ===
            30
              ? " · duração anterior de 30 dias adaptada para 28; revise antes de enviar"
              : ""}
          </p>
        )}
        <div className="arena-wizard-review">
          <strong>{name || "Novo desafio"}</strong>
          <span>
            {kind === "collective"
              ? `Coletivo · ${target} treinos`
              : kind === "consistency"
                ? "Consistência"
                : "Quantidade de treinos"}{" "}
            · {duration} dias
          </span>
          <small>
            {recordingPolicy === "timed"
              ? "Somente cronometrados"
              : "Qualquer treino válido"}
          </small>
        </div>
      </fieldset>
      <div className="form-actions">
        {step > 0 && (
          <button
            type="button"
            className="outline-button"
            disabled={challenges.busy}
            onClick={() => setStep((p) => p - 1)}
          >
            Voltar
          </button>
        )}
        {step < 2 ? (
          <button
            key="continue"
            type="button"
            className="primary-button"
            disabled={challenges.busy}
            onClick={(event) => {
              event.preventDefault();
              const fields = formRef.current?.querySelectorAll<
                HTMLInputElement | HTMLSelectElement
              >(
                "fieldset.arena-wizard-page:not([hidden]) input,fieldset.arena-wizard-page:not([hidden]) select",
              );
              if (
                fields &&
                [...fields].some((field) => !field.reportValidity())
              )
                return;
              setStep((p) => p + 1);
            }}
          >
            Continuar <ArrowRight size={16} />
          </button>
        ) : (
          <button
            key="confirm"
            type="submit"
            className="primary-button"
            disabled={challenges.busy || !selected.length}
          >
            Enviar convites
          </button>
        )}
      </div>
    </form>
  );
}
