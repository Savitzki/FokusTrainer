import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Pause, ShieldOff } from "lucide-react";
import CapiboraMessage from "./CapiboraMessage";
import { capiboraMessage } from "./capiboraVoice";
import MedicalKitIcon from "./MedicalKitIcon";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import RescheduleTraining from "./RescheduleTraining";
import { kitUsesRemaining } from "./economy";
import {
  extraRestsRemaining,
  rescheduleFor,
  rescheduleTargets,
  reschedulesRemaining,
  trainingDayKind,
} from "./training";
import type { EconomyController } from "./useEconomy";
import type { TrainingController } from "./useTrainingPlan";
import type { Workout } from "./model";
import "./missedWorkout.css";

type Step = "options" | "kit" | "accept" | "kit-saved" | "rescheduled";

/** A presentation of existing operations, never a workout/absence/protection queue. */
export default function MissedWorkout(props: {
  day: string;
  eligible: boolean;
  training: TrainingController;
  economy: EconomyController;
  workouts: Workout[];
  onRefresh: () => Promise<boolean>;
  onUseKit: () => Promise<boolean>;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onShop: () => void;
  onTraining: () => void;
  onAcknowledge: () => void;
}) {
  const { day, eligible, training, economy, workouts } = props;
  const [step, setStep] = useState<Step>("options");
  const [checked, setChecked] = useState(false),
    [reading, setReading] = useState(true);
  const [working, setWorking] = useState(false),
    [failure, setFailure] = useState("");
  const latest = useRef(props),
    epoch = useRef(0),
    sending = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  latest.current = props;

  const refresh = useCallback(async () => {
    const token = ++epoch.current;
    setReading(true);
    setChecked(false);
    setFailure("");
    try {
      const ok =
        navigator.onLine !== false && (await latest.current.onRefresh());
      if (token !== epoch.current) return;
      setChecked(ok);
      if (!ok)
        setFailure(
          "Conecte-se e atualize os dados para consultar as opções de hoje",
        );
    } catch {
      if (token === epoch.current)
        setFailure(
          "Não foi possível consultar suas opções. Tente atualizar novamente",
        );
    } finally {
      if (token === epoch.current) setReading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      epoch.current++;
    };
  }, [refresh]);
  useEffect(() => {
    props.onBusyChange(working);
  }, [working, props.onBusyChange]);
  useEffect(() => () => latest.current.onBusyChange(false), []);
  useEffect(() => {
    // Let Modal capture the original trigger before focusing subsequent steps.
    if (previousStep.current === step) return;
    previousStep.current = step;
    const heading = root.current?.querySelector<HTMLElement>("h3");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [step]);

  const busy = working || training.busy || economy.busy;
  const kitState = economy.state;
  const canUseKit = Boolean(
    checked &&
      eligible &&
      kitState &&
      kitState.today === day &&
      kitState.kits > 0 &&
      kitUsesRemaining(kitState) !== 0,
  );
  const state = training.state;
  const targets = state ? rescheduleTargets(state, day, workouts) : [];
  const rescheduleReason = !state?.reschedules
    ? "Reagendamento indisponível. Atualize sua programação"
    : trainingDayKind(state, day) === "compensatory" ||
        rescheduleFor(state, day)
      ? "Este dia já participa de um reagendamento"
      : !reschedulesRemaining(state, day)
        ? "Você já usou as trocas desta semana"
        : !targets.length
          ? "Não há descanso posterior disponível nesta semana"
          : "";

  async function useKit() {
    if (sending.current || !latest.current.eligible || !canUseKit) return false;
    const token = epoch.current;
    sending.current = true;
    setWorking(true);
    try {
      const saved = await latest.current.onUseKit();
      if (saved && token === epoch.current) setStep("kit-saved");
      return saved;
    } finally {
      sending.current = false;
      if (token === epoch.current) setWorking(false);
    }
  }

  if (step === "kit-saved" || step === "rescheduled")
    return (
      <div className="missed-workout missed-result" ref={root}>
        <CapiboraMessage
          message={capiboraMessage(
            step === "kit-saved" ? "missed-kit-saved" : "missed-rescheduled",
          )}
          variant="centered"
          size={150}
        />
        <p role="status">
          <Check size={18} aria-hidden="true" />
          {step === "kit-saved"
            ? "Kit Médico utilizado. Sua ofensiva está protegida hoje, sem somar pontos"
            : "Troca confirmada. Confira a nova data na aba Treinos"}
        </p>
        <button className="primary-button" onClick={props.onClose}>
          Continuar
        </button>
      </div>
    );

  return (
    <div className="missed-workout" ref={root}>
      {step === "kit" && checked && (eligible || working) && kitState ? (
        <MedicalKitConfirmation
          state={kitState}
          today={day}
          canProtect={eligible}
          busy={busy}
          error={economy.error}
          onConfirm={useKit}
          onCancel={() =>
            setStep((current) => (current === "kit" ? "options" : current))
          }
        />
      ) : step === "accept" && eligible ? (
        <div className="missed-accept">
          <CapiboraMessage
            message={capiboraMessage("missed-accept")}
            variant="centered"
            size={130}
          />
          <p>
            Sem treino ou proteção válida, a falta pode interromper sua ofensiva
            após o fechamento do dia, às <strong>00:00</strong>
          </p>
          <p>
            Se houver Kit Médico elegível, o uso automático continua ativo. Esta
            escolha não desativa seus kits
          </p>
          <p className="field-hint">
            Vamos apenas fechar esta tela. Nenhum treino ou falta será
            registrado agora, e sua ofensiva não será alterada por esta escolha
          </p>
          <div className="form-actions">
            <button
              className="outline-button"
              onClick={() => setStep("options")}
            >
              <ArrowLeft size={17} /> Voltar
            </button>
            <button className="primary-button" onClick={props.onAcknowledge}>
              Confirmar e fechar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="missed-workout-intro">
            <CapiboraMessage
              message={capiboraMessage("missed-workout")}
              variant="centered"
              size={160}
            />
          </div>
          {reading ? (
            <p role="status">Consultando as opções de hoje…</p>
          ) : !checked ? (
            <div className="missed-refresh">
              <p role="alert">{failure}</p>
              <button className="outline-button" onClick={() => void refresh()}>
                Atualizar opções
              </button>
            </div>
          ) : !eligible && !working ? (
            <p role="status">
              O dia mudou ou este treino não está mais pendente. Feche a tela
              para consultar o estado atualizado
            </p>
          ) : (
            <div className="missed-options">
              <section className="missed-option">
                {canUseKit ? (
                  <button
                    className="missed-option-button"
                    disabled={busy}
                    onClick={() => setStep("kit")}
                  >
                    <MedicalKitIcon size={29} />
                    <span className="missed-choice-copy">
                      <strong>Usar Kit Médico</strong>
                      <small>
                        Protege sua ofensiva usando um kit disponível
                      </small>
                      <small>
                        {kitState!.kits}{" "}
                        {kitState!.kits === 1
                          ? "kit disponível"
                          : "kits disponíveis"}{" "}
                        · Consome 1 kit
                      </small>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="missed-unavailable">
                    <MedicalKitIcon size={26} />
                    <div>
                      <h3>Kit Médico</h3>
                      <p>
                        {kitState?.kits === 0
                          ? "Nenhum kit disponível"
                          : "Não há uso de kit disponível para este dia"}
                      </p>
                      {kitState?.kits === 0 && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={props.onShop}
                        >
                          Ver kits na Loja <ArrowRight size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
              <section className="missed-option missed-reschedule">
                {rescheduleReason && !working ? (
                  <>
                    <h3>Reagendar treino</h3>
                    <p>{rescheduleReason}</p>
                  </>
                ) : (
                  <RescheduleTraining
                    day={day}
                    workouts={workouts}
                    training={training}
                    description="Não conseguiu hoje? Veja se ainda dá pra mudar o dia"
                    disabled={!eligible || busy}
                    onBusyChange={setWorking}
                    onSaved={() => setStep("rescheduled")}
                  />
                )}
              </section>
              <aside className="missed-pause-note">
                <h3>
                  <Pause size={16} aria-hidden="true" /> Preciso de uma pausa
                </h3>
                <p>
                  Viagem, doença ou algum imprevisto? A pausa prolongada ainda
                  está em planejamento e não pode ser ativada aqui
                </p>
                {state && extraRestsRemaining(state, day) > 0 && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={props.onTraining}
                  >
                    Ver descansos extras em Treinos{" "}
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
              </aside>
              <button
                className="text-button missed-accept-button"
                disabled={busy}
                onClick={() => setStep("accept")}
              >
                <ShieldOff size={17} aria-hidden="true" /> Aceitar a falta de
                hoje
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
