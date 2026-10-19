import { useState } from "react";
import { Smile, Plus } from "lucide-react";
import { EMOJIS } from "./cosmetics";
import type { Cosmetic } from "./gamification";
import type { SocialState } from "./social";
import { useGameResource } from "./useGamification";
export type GroupReaction = {
  target: string;
  itemId: string;
  count: number;
  mine: boolean;
};
export function readGroupReactions(value: unknown): GroupReaction[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (r) =>
        r &&
        typeof r.target === "string" &&
        typeof r.itemId === "string" &&
        Boolean(EMOJIS[r.itemId]) &&
        Number.isInteger(r.count) &&
        r.count > 0 &&
        typeof r.mine === "boolean",
    )
  )
    throw new Error("Não foi possível atualizar as reações");
  return value;
}
export default function GroupReactions({
  userId,
  group,
  items,
}: {
  userId: string;
  group: SocialState["groups"][number];
  items: Cosmetic[];
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState<string | null>(null);
  const resource = useGameResource(
    userId,
    "get_group_reactions",
    { p_group: group.id },
    readGroupReactions,
    open,
  );
  const owned = items
    .filter((i) => i.category === "emoji" && i.owned && EMOJIS[i.id])
    .sort((a, b) => Number(b.equipped) - Number(a.equipped));
  const members = group.members.filter((m) => m.accepted && m.trained);
  async function react(person: string, itemId: string | null) {
    if (
      await resource.act("set_group_reaction", {
        p_group: group.id,
        p_target: person,
        p_item: itemId,
      })
    )
      setTarget(null);
  }
  return (
    <details
      className="group-reactions"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <Smile size={17} /> Reações aos treinos
      </summary>
      {resource.error && (
        <p role="alert" className="form-error">
          {resource.error}
          <button
            className="text-button"
            disabled={resource.busy}
            onClick={() => void resource.refresh()}
          >
            Atualizar
          </button>
        </p>
      )}
      {!resource.state && resource.busy && (
        <p role="status">Buscando reações…</p>
      )}
      {members.map((member) => (
        <div key={member.id} className="group-reaction-row">
          <strong>{member.nickname}</strong>
          <div className="reaction-counts">
            {resource.state
              ?.filter((r) => r.target === member.id)
              .map((r) => (
                <button
                  key={r.itemId}
                  aria-label={`${EMOJIS[r.itemId]} · ${r.count} reações a ${member.nickname}${r.mine ? ", remover minha reação" : ""}`}
                  aria-pressed={r.mine}
                  disabled={
                    resource.busy ||
                    (!r.mine && !owned.some((i) => i.id === r.itemId))
                  }
                  onClick={() =>
                    void react(member.id, r.mine ? null : r.itemId)
                  }
                >
                  {EMOJIS[r.itemId]} <small>{r.count}</small>
                </button>
              ))}
            {owned.length > 0 && (
              <button
                className="icon-button"
                aria-label={`Reagir ao treino de ${member.nickname}`}
                aria-expanded={target === member.id}
                disabled={resource.busy}
                onClick={() =>
                  setTarget(target === member.id ? null : member.id)
                }
              >
                <Smile size={18} />
                <Plus size={12} />
              </button>
            )}
          </div>
          {target === member.id && (
            <div
              className="reaction-picker"
              role="group"
              aria-label={`Escolher reação para ${member.nickname}`}
            >
              {owned.map((item) => (
                <button
                  key={item.id}
                  aria-label={`Reagir com ${item.name}`}
                  disabled={resource.busy}
                  onClick={() => void react(member.id, item.id)}
                >
                  {EMOJIS[item.id]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </details>
  );
}
