import { useState, useRef, type ReactNode } from "react";
import { RefreshCw, CircleHelp } from "lucide-react";
import { formatDay } from "./model";
import type { EconomyController } from "./useEconomy";
import { OperationSpinner } from "./SyncFeedback";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import CapiWheyAmount from "./CapiWheyAmount";
import MedicalKitIcon from "./MedicalKitIcon";
import Modal from "./Modal";
import { kitUsesRemaining } from "./economy";

export default function EconomyPanel({
  economy,
  canProtect,
  onProtect,
  children,
}: {
  economy: EconomyController;
  canProtect: boolean;
  onProtect: () => Promise<boolean>;
  children?: ReactNode;
}) {
  const { state, busy } = economy;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirmUse, setConfirmUse] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const purchasePending = useRef(false);
  const [buying, setBuying] = useState(false);
  if (!state)
    return (
      <div className="economy-panel">
        <p>
          {busy
            ? "Abrindo sua carteira…"
            : "Conecte-se para consultar seu saldo"}
        </p>
        {economy.error && (
          <p className="form-error" role="alert">
            {economy.error}
          </p>
        )}
        <button
          className="outline-button"
          disabled={busy}
          onClick={() => void economy.refresh()}
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>
    );
  const remaining = kitUsesRemaining(state);
  return (
    <div className="economy-panel">
      {children}

      {economy.notice && (
        <p className="economy-feedback" role="status">
          {economy.noticeReward !== undefined ? (
            <CapiWheyAmount amount={economy.noticeReward} signed />
          ) : (
            <MedicalKitIcon size={22} />
          )}
          {economy.notice}
        </p>
      )}
      {economy.error && (
        <p className="form-error" role="alert">
          {economy.error}
        </p>
      )}
      <section className="kit-shop" aria-labelledby="kit-title">
        <div className="kit-shop-heading">
          <span className="kit-product-icon">
            <MedicalKitIcon size={34} />
          </span>
          <div>
            <h3 id="kit-title">Kit Médico</h3>
            <small>
              {state.kits} disponíveis
              {state.monthlyKits
                ? ` · ${state.monthlyKits.freeAvailable} grátis`
                : ""}
            </small>
          </div>
          <span className="kit-price">
            <CapiWheyAmount amount={state.rules.kitPrice} />
          </span>
          <button
            className="icon-button kit-help"
            aria-label="Como funciona o Kit Médico"
            onClick={() => setRulesOpen(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
        <div className="kit-shop-actions">
          <button
            className="primary-button"
            aria-label={`Comprar Kit Médico por ${state.rules.kitPrice} CapiWhey`}
            disabled={busy || state.balance < state.rules.kitPrice}
            onClick={() => setConfirmBuy(true)}
          >
            <OperationSpinner active={busy} /> Comprar
          </button>
          <button
            className="outline-button"
            aria-label="Proteger hoje"
            disabled={busy || !canProtect || !state.kits || remaining === 0}
            onClick={() => setConfirmUse(true)}
          >
            <MedicalKitIcon /> Usar
          </button>
        </div>
        {state.monthlyKits && (
          <small className="kit-renewal">
            Grátis renovam em{" "}
            {formatDay(state.monthlyKits.renewsOn, {
              day: "numeric",
              month: "short",
            })}
          </small>
        )}
        {confirmBuy && (
          <Modal
            title="Comprar Kit Médico?"
            compactHeader
            onClose={() => {
              if (!purchasePending.current && !busy) setConfirmBuy(false);
            }}
          >
            <p className="product-detail-price">
              <MedicalKitIcon size={32} />
              <CapiWheyAmount amount={state.rules.kitPrice} />
            </p>
            <p>O kit comprado fica na sua conta até ser usado.</p>
            {economy.error && (
              <p role="alert" className="form-error">
                {economy.error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="outline-button"
                disabled={busy || buying}
                onClick={() => setConfirmBuy(false)}
              >
                Agora não
              </button>
              <button
                className="primary-button"
                disabled={
                  busy || buying || state.balance < state.rules.kitPrice
                }
                onClick={async () => {
                  if (purchasePending.current) return;
                  purchasePending.current = true;
                  setBuying(true);
                  try {
                    if (await economy.buy()) setConfirmBuy(false);
                  } finally {
                    purchasePending.current = false;
                    setBuying(false);
                  }
                }}
              >
                <OperationSpinner active={busy} />
                Confirmar compra
              </button>
            </div>
          </Modal>
        )}
        {rulesOpen && (
          <Modal
            title="Kit Médico"
            compactHeader
            onClose={() => setRulesOpen(false)}
          >
            <p>
              Treino{" "}
              <CapiWheyAmount amount={state.rules.workoutReward} signed /> ·
              Primeiro peso do dia{" "}
              <CapiWheyAmount amount={state.rules.weightReward} signed />
            </p>
            {state.monthlyKits && (
              <p>
                {state.monthlyKits.allowance} kits gratuitos por mês. Gratuitos
                não acumulam · {state.monthlyKits.purchasedAvailable}{" "}
                {state.monthlyKits.purchasedAvailable === 1
                  ? "comprado sem validade"
                  : "comprados sem validade"}
              </p>
            )}
            <p>
              {remaining === null
                ? "Use enquanto tiver kits · Uma proteção por dia"
                : `${remaining}/${state.rules.weeklyKitLimit} usos disponíveis nesta semana`}
            </p>
            <p>Kits protegem apenas o dia atual. Não aumentam a ofensiva.</p>
          </Modal>
        )}
        {confirmUse && (
          <MedicalKitConfirmation
            state={state}
            today={state.today}
            canProtect={canProtect}
            busy={busy}
            onConfirm={onProtect}
            onCancel={() => setConfirmUse(false)}
          />
        )}
      </section>
    </div>
  );
}
