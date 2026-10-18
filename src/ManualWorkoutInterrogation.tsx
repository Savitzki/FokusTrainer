import Mascot from "./Mascot";
import { phraseText } from "./capiboraVoice";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { OperationSpinner } from "./SyncFeedback";
import {
  MANUAL_FINAL_QUESTION,
  MANUAL_ACKNOWLEDGMENTS,
  MANUAL_ASIDES,
  MANUAL_QUESTIONS,
  type ManualConfirmation,
} from "./manualConfirmation";

export default function ManualWorkoutInterrogation({
  questions,
  busy,
  error,
  onComplete,
  onReturn,
  onCancel,
}: {
  questions: ManualConfirmation["questionIds"];
  busy: boolean;
  error: string;
  onComplete: (confirmation: ManualConfirmation) => void;
  onReturn: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0),
    [answers, setAnswers] = useState<boolean[]>([]),
    [declined, setDeclined] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step, declined]);
  if (declined)
    return (
      <div className="manual-interrogation manual-declined">
        <h3 ref={heading} tabIndex={-1}>
          {phraseText("manual-declined")}
        </h3>
        <p className="field-hint">Treino não registrado</p>
        <button className="primary-button" onClick={onReturn}>
          Voltar ao formulário
        </button>
        <button className="text-button" onClick={onCancel}>
          Cancelar registro
        </button>
      </div>
    );
  const question =
    step === 2
      ? MANUAL_FINAL_QUESTION
      : MANUAL_QUESTIONS.find((q) => q.id === questions[step])!.text;
  const aside =
    step === 1 &&
    MANUAL_QUESTIONS.findIndex((q) => q.id === questions[0]) % 2 === 0
      ? MANUAL_ACKNOWLEDGMENTS[
          MANUAL_QUESTIONS.findIndex((q) => q.id === questions[1]) %
            MANUAL_ACKNOWLEDGMENTS.length
        ]
      : MANUAL_ASIDES[step];
  return (
    <div
      className="manual-interrogation"
      role="group"
      aria-label="Confirmação do treino manual"
    >
      <div className="manual-question-progress">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            if (!step) onReturn();
            else {
              setAnswers((previous) => previous.slice(0, step - 1));
              setStep(step - 1);
            }
          }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <span>{step + 1} de 3</span>
      </div>
      <div className="manual-question" key={step}>
        <Mascot pose={step === 2 ? "judging" : "suspicious"} size={48} />
        <h3 ref={heading} tabIndex={-1}>
          {question}
        </h3>
        <p className="field-hint">{aside}</p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="manual-answer-actions">
        <button
          type="button"
          className="outline-button"
          disabled={busy}
          onClick={() => {
            setAnswers([]);
            setDeclined(true);
          }}
        >
          <X size={18} /> Não
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            if (step < 2) {
              setAnswers((previous) => [...previous.slice(0, step), true]);
              setStep(step + 1);
            } else if (answers[0] === true && answers[1] === true)
              onComplete({
                version: 1,
                questionIds: questions,
                answers: [true, true, true],
              });
          }}
        >
          {busy ? (
            <>
              <OperationSpinner active /> Confirmando…
            </>
          ) : (
            <>
              <Check size={18} /> {step === 2 ? "Sim, eu confirmo." : "Sim"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
