import { useRef, useState } from "react";
import { Check, Settings, Shield } from "lucide-react";
import Modal from "./Modal";
import type { GroupGoal, SocialState, useSocial } from "./social";
import { formatDay } from "./model";
type Group = SocialState["groups"][number];
export function GroupWeeklyGoal({ goals }: { goals: GroupGoal[] }) {
  const [current, ...history] = goals;
  if (!current) return null;
  const label = (g: GroupGoal) =>
    g.target === 0
      ? "Sem meta elegível"
      : g.completed >= g.target
        ? "Concluída"
        : g.closed
          ? "Encerrada sem conclusão"
          : "Em andamento";
  return (
    <section className="arena-weekly-goal" aria-label="Meta coletiva semanal">
      <div className="arena-section-heading">
        <h4>Meta da semana</h4>
        <small>{label(current)}</small>
      </div>
      {current.target > 0 && (
        <>
          <strong>
            {current.completed}/{current.target} treinos
          </strong>
          <progress
            aria-label="Progresso da meta coletiva"
            value={Math.min(current.completed, current.target)}
            max={current.target}
          />
          <small>
            {Math.max(0, current.target - current.completed)} restantes
          </small>
          {current.completed >= current.target && (
            <p>
              <Check size={15} /> Tá pago, time
            </p>
          )}
        </>
      )}
      {history.length > 0 && (
        <details>
          <summary>Semanas anteriores</summary>
          {history.map((g) => (
            <p key={g.weekStart}>
              {formatDay(g.weekStart)} · {g.completed}/{g.target} · {label(g)}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
export default function ArenaGroupTools({
  group,
  userId,
  friends,
  busy,
  act,
  error,
}: {
  group: Group;
  userId: string;
  friends: SocialState["friends"];
  busy: boolean;
  error?: string;
  act: ReturnType<typeof useSocial>["act"];
}) {
  const [action, setAction] = useState<string | null>(null),
    [target, setTarget] = useState(""),
    [name, setName] = useState(group.name);
  const request = useRef(""),
    pending = useRef(false);
  const admin = group.adminId === userId;
  const members = group.members.filter((m) => m.accepted && m.id !== userId);
  const options =
    action === "invite"
      ? friends.filter((f) => !group.members.some((m) => m.id === f.id))
      : action === "remove"
        ? group.members.filter((m) => m.id !== userId)
        : members;
  const labels: Record<string, string> = {
    rename: "Alterar nome",
    invite: "Convidar amigo",
    remove: "Remover integrante",
    transfer: "Transferir administração",
    leave: "Sair do grupo",
    close: "Encerrar grupo",
  };
  const open = (value: string) => {
    setAction(value);
    setTarget("");
    request.current = crypto.randomUUID();
  };
  return (
    <>
      <details className="arena-group-tools">
        <summary>
          <Settings size={16} /> Gerenciar grupo
        </summary>
        <p>
          <Shield size={14} /> {admin ? "Administrador" : "Integrante"}
        </p>
        <div className="arena-action-list">
          <button className="text-button" onClick={() => open("invite")}>
            Convidar amigo
          </button>
          {admin &&
            ["rename", "remove", "transfer"].map((a) => (
              <button className="text-button" key={a} onClick={() => open(a)}>
                {labels[a]}
              </button>
            ))}
          <button className="text-button" onClick={() => open("leave")}>
            Sair do grupo
          </button>
          {admin && (
            <button
              className="text-button danger-action"
              onClick={() => open("close")}
            >
              Encerrar grupo
            </button>
          )}
        </div>
      </details>
      {action && (
        <Modal
          centered
          compactHeader
          title={labels[action]}
          onClose={() => {
            if (!busy) setAction(null);
          }}
          closeDisabled={busy}
        >
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <form
            className="social-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pending.current) return;
              pending.current = true;
              try {
                if (
                  await act("arena_group_command", {
                    p_id: group.id,
                    p_action: action,
                    p_target: target || null,
                    p_name: action === "rename" ? name : null,
                    p_request: request.current,
                  })
                )
                  setAction(null);
              } finally {
                pending.current = false;
              }
            }}
          >
            {action === "rename" && (
              <label className="form-label">
                Nome do grupo
                <input
                  required
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            {["invite", "remove", "transfer"].includes(action) && (
              <label className="form-label">
                {action === "invite" ? "Amigo" : "Integrante"}
                <select
                  aria-label={action === "invite" ? "Amigo" : "Integrante"}
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      @{m.nickname}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p>
              {action === "close"
                ? `Encerrar ${group.name} para todos? O histórico será preservado.`
                : action === "leave"
                  ? admin && members.length
                    ? "Transfira a administração antes de sair."
                    : admin
                      ? "Você é o administrador. Use Encerrar grupo para encerrar o último vínculo."
                      : `Sair de ${group.name}? Os demais continuam no grupo.`
                  : action === "remove"
                    ? `Remover ${options.find((m) => m.id === target)?.nickname ?? "o integrante selecionado"} do grupo?`
                    : action === "transfer"
                      ? "O integrante escolhido será o único administrador."
                      : "Confirme a alteração."}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="outline-button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={busy || (action === "leave" && admin)}
              >
                Confirmar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
