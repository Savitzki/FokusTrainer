import { useState, useRef, type ReactNode } from "react";
import { BriefcaseMedical, ShieldCheck, RefreshCw, Gift } from "lucide-react";
import { formatDay } from "./model";
import type { EconomyController } from "./useEconomy";
import { OperationSpinner } from "./SyncFeedback";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import ProteinToken from "./ProteinToken";
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
  const { state, busy, history } = economy;
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
      <div className="wallet-summary" aria-label="Resumo da carteira">
        <span>
          <ProteinToken size={19} />
          <strong>{state.balance.toLocaleString("pt-BR")}</strong>
          <small>potes</small>
        </span>
        <span>
          <BriefcaseMedical size={18} />
          <strong>{state.kits}</strong>
          <small>kits</small>
        </span>
        {state.monthlyKits && (
          <span>
            <Gift size={18} />
            <strong>{state.monthlyKits.freeAvailable}</strong>
            <small>grátis</small>
          </span>
        )}
      </div>
      {economy.notice && (
        <p className="economy-feedback" role="status">
          <ShieldCheck size={17} />
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
            <BriefcaseMedical size={30} />
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
            <ProteinToken size={16} />
            {state.rules.kitPrice}
          </span>
        </div>
        <div className="kit-shop-actions">
          <button
            className="primary-button"
            aria-label={`Comprar ${state.rules.kitPrice}`}
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
            <ShieldCheck size={17} /> Usar
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
              <ProteinToken size={21} />
              {state.rules.kitPrice} potes
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
        <details className="context-details">
          <summary>Regras e recompensas</summary>
          <p>
            Treino +{state.rules.workoutReward} · Primeiro peso do dia +
            {state.rules.weightReward}
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
        </details>
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
      {children}
      <details className="wallet-history">
        <summary>Histórico</summary>
        {history.entries.length ? (
          <ol>
            {history.entries.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{e.description}</strong>
                  <time dateTime={e.createdAt}>
                    {new Date(e.createdAt).toLocaleString("pt-BR", {
                      timeZone: state.timezone,
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <div className={e.amount > 0 ? "coin-gain" : "coin-spend"}>
                  <strong>
                    {e.amount > 0 ? "+" : "−"}
                    {Math.abs(e.amount)}
                  </strong>
                  <small>Saldo {e.balanceAfter}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="field-hint">Suas próximas conquistas aparecem aqui</p>
        )}
        {history.hasMore && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void economy.loadMore()}
          >
            Ver mais
          </button>
        )}
      </details>
      {!!state.protections.length && (
        <details className="wallet-history">
          <summary>Kits utilizados</summary>
          <ul>
            {state.protections.map((p) => (
              <li key={p.id}>
                <span>
                  <ShieldCheck size={16} /> {formatDay(p.day)}
                </span>
                <time dateTime={p.usedAt}>
                  {new Date(p.usedAt).toLocaleTimeString("pt-BR", {
                    timeZone: state.timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
