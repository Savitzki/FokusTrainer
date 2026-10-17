import { useEffect, useState, type ReactNode } from "react";
import { BriefcaseMedical, ShieldCheck, RefreshCw, Gift } from "lucide-react";
import { formatDay } from "./model";
import type { EconomyController } from "./useEconomy";
import MedicalKitConfirmation from "./MedicalKitConfirmation";
import ProteinToken from "./ProteinToken";
import { currencyAmount } from "./currency";
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
  useEffect(() => {
    void economy.refresh();
  }, [economy.refresh]);
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
      <div className="wallet-summary">
        <div>
          <ProteinToken size={26} />
          <strong>{state.balance.toLocaleString("pt-BR")}</strong>
          <span>potes de proteína</span>
        </div>
        <div>
          <BriefcaseMedical size={23} />
          <strong>{state.kits}</strong>
          <span>{state.kits === 1 ? "kit" : "kits"}</span>
        </div>
      </div>
      <p className="field-hint">
        Treino +{state.rules.workoutReward} · Primeiro peso do dia +
        {state.rules.weightReward}
      </p>
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
        <h3 id="kit-title">
          <BriefcaseMedical size={20} /> Kit Médico
        </h3>
        <p>Salva sua chama hoje, sem somar um dia</p>
        {state.monthlyKits && (
          <div className="monthly-kits" role="status">
            <strong>
              <Gift size={17} /> {state.monthlyKits.freeAvailable}{" "}
              {state.monthlyKits.freeAvailable === 1
                ? "gratuito disponível"
                : "gratuitos disponíveis"}
            </strong>
            <small>
              {state.monthlyKits.allowance} por mês · Renovam em{" "}
              {formatDay(state.monthlyKits.renewsOn, {
                day: "numeric",
                month: "short",
              })}
            </small>
            <small>
              Gratuitos não acumulam · {state.monthlyKits.purchasedAvailable}{" "}
              {state.monthlyKits.purchasedAvailable === 1
                ? "comprado sem validade"
                : "comprados sem validade"}
            </small>
          </div>
        )}
        <button
          className="primary-button"
          disabled={busy || state.balance < state.rules.kitPrice}
          onClick={() => void economy.buy()}
        >
          Comprar <ProteinToken size={18} /> {state.rules.kitPrice}
        </button>
        {state.balance < state.rules.kitPrice && (
          <small>
            {state.rules.kitPrice - state.balance === 1 ? "Falta " : "Faltam "}
            {currencyAmount(state.rules.kitPrice - state.balance)}
          </small>
        )}
        <button
          className="outline-button"
          disabled={busy || !canProtect || !state.kits || remaining === 0}
          onClick={() => setConfirmUse(true)}
        >
          <ShieldCheck size={17} /> Proteger hoje
        </button>
        <small>
          {remaining === null
            ? "Use enquanto tiver kits · Uma proteção por dia"
            : `${remaining}/${state.rules.weeklyKitLimit} usos disponíveis nesta semana`}
        </small>
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
      <details className="wallet-history" open>
        <summary>Movimentações</summary>
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
      <p className="field-hint">
        Kits protegem apenas hoje · Horários: {state.timezone}
      </p>
    </div>
  );
}
