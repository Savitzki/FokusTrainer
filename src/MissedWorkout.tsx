import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Pause,
  ShieldOff,
} from "lucide-react";
import Mascot from "./Mascot";
import CapiboraMessage from "./CapiboraMessage";
import { capiboraMessage } from "./capiboraVoice";
import MedicalKitIcon from "./MedicalKitIcon";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import RescheduleTraining from "./RescheduleTraining";
import { kitUsesRemaining } from "./economy";
import {
  rescheduleFor,
  rescheduleTargets,
  reschedulesRemaining,
  trainingDayKind,
} from "./training";
import type { EconomyController } from "./useEconomy";
import type { TrainingController } from "./useTrainingPlan";
import type { Workout } from "./model";
import "./missedWorkout.css";

type Step =
  | "intro"
  | "options"
  | "kit"
  | "reschedule"
  | "pause"
  | "accept"
  | "kit-saved"
  | "rescheduled";
const STEP_TITLES: Record<Step, string> = {
  intro: "Não treinei hoje",
  options: "Suas opções",
  kit: "Usar Kit Médico",
  reschedule: "Reagendar o treino",
  pause: "Dar uma pausa",
  accept: "Aceitar a derrota",
  "kit-saved": "Kit Médico utilizado",
  rescheduled: "Treino reagendado",
};

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
  onTitleChange: (title: string) => void;
  onAcknowledge: () => void;
}) {
  const { day, eligible, training, economy, workouts } = props;
  const [step, setStep] = useState<Step>("intro");
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
  useLayoutEffect(() => {
    props.onTitleChange(STEP_TITLES[step]);
  }, [step, props.onTitleChange]);
  useEffect(() => {
    props.onBusyChange(working);
  }, [working, props.onBusyChange]);
  useEffect(() => () => latest.current.onBusyChange(false), []);
  useEffect(() => {
    // Let Modal capture the original trigger before focusing subsequent steps.
    if (previousStep.current === step) return;
    previousStep.current = step;
    const heading =
      root.current?.querySelector<HTMLElement>("h3") ??
      root.current?.closest("dialog")?.querySelector<HTMLElement>("h2");
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
    kitState.kitEligibility?.allowed !== false &&
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

  if (step === "intro")
    return (
      <div className="missed-workout" ref={root}>
        <div className="missed-workout-intro">
          <CapiboraMessage
            message={capiboraMessage("missed-workout")}
            variant="centered"
            size={160}
          />
        </div>
        <button
          className="primary-button missed-options-trigger"
          onClick={() => setStep("options")}
        >
          Ver minhas opções
        </button>
      </div>
    );

  return (
    <div className="missed-workout" ref={root}>
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
          O dia mudou ou este treino não está mais pendente. Feche a tela para
          consultar o estado atualizado
        </p>
      ) : step === "kit" ? (
        (canUseKit || working) && kitState ? (
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
        ) : (
          <div className="missed-confirmation">
            <p>
              {kitState?.kitEligibility?.reason ??
                (kitState?.kits === 0
                  ? "Nenhum kit disponível"
                  : "Não há uso de kit disponível para este dia")}
            </p>
            <p>
              Um kit disponível seria consumido para proteger a ofensiva, sem
              somar pontos.
            </p>
            {kitState?.kits === 0 && (
              <button
                className="outline-button"
                disabled={busy}
                onClick={props.onShop}
              >
                Ver kits na Loja <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )
      ) : step === "reschedule" ? (
        <div className="missed-reschedule missed-confirmation">
          <p>
            Transfira o treino para um descanso permitido nesta semana,
            respeitando o limite de trocas do seu plano.
          </p>
          {rescheduleReason && !working ? (
            <p role="status">{rescheduleReason}</p>
          ) : (
            <RescheduleTraining
              initiallyOpen
              onCancel={() => setStep("options")}
              day={day}
              workouts={workouts}
              training={training}
              disabled={!eligible || busy}
              onBusyChange={setWorking}
              onSaved={() => setStep("rescheduled")}
            />
          )}
        </div>
      ) : step === "pause" ? (
        <div className="missed-confirmation">
          <p>
            A pausa prolongada ainda está em planejamento e não pode ser ativada
            aqui.
          </p>
          <p>Esta tela não pausa seu plano nem protege sua ofensiva.</p>
        </div>
      ) : step === "accept" ? (
        <div className="missed-confirmation">
          <Mascot pose="sad" size={160} />
          <p>É uma pena perder essa ofensiva depois de tanto esforço</p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={props.onAcknowledge}
          >
            Confirmar e fechar
          </button>
        </div>
      ) : (
        <div className="missed-options">
          {(
            [
              {
                step: "kit",
                title: "Usar Kit Médico",
                icon: <MedicalKitIcon size={29} />,
                description: "Protege sua ofensiva usando um kit disponível",
              },
              {
                step: "reschedule",
                title: "Reagendar o treino",
                icon: <ArrowRightLeft size={29} aria-hidden="true" />,
                description: "Transfere o treino para outra data permitida",
              },
              {
                step: "pause",
                title: "Dar uma pausa",
                icon: <Pause size={29} aria-hidden="true" />,
                description: "Pausa de rotina indisponível no momento",
              },
              {
                step: "accept",
                title: "Aceitar a derrota",
                icon: <ShieldOff size={29} aria-hidden="true" />,
                description:
                  "Sem treino ou proteção válida, você perderá a ofensiva no fechamento do dia",
              },
            ] as const
          ).map((option) => (
            <section className="missed-option" key={option.step}>
              <button
                className="missed-option-button"
                disabled={busy}
                onClick={() => setStep(option.step)}
              >
                {option.icon}
                <span className="missed-choice-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
