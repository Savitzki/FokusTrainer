import { ArrowRightLeft, Check, Clock3, Flame, Moon } from "lucide-react";
import ArenaAvatar from "./ArenaAvatar";
import Mascot from "./Mascot";
import type { SocialState } from "./social";

type Group = SocialState["groups"][number];

function memberState(member: Group["members"][number], pending: boolean) {
  if (!member.accepted) return { text: "Convidado", Icon: Clock3 };
  if (pending) return { text: "Convite aceito", Icon: Check };
  if (member.rescheduledTo)
    return { text: "Treino reagendado", Icon: ArrowRightLeft };
  if (member.resting) return { text: "Descanso protegido", Icon: Moon };
  if (member.trained) return { text: "Treino confirmado", Icon: Check };
  if (member.needsPlan) return { text: "Sem plano", Icon: Clock3 };
  return { text: "Treino pendente", Icon: Clock3 };
}

/** Presentation of the server's collective streak; no local streak calculation. */
export default function ArenaGroupBanner({ group }: { group: Group }) {
  return (
    <section className="arena-group-banner" aria-label="Resumo do seu grupo">
      <div className="arena-banner-copy">
        <h2>Seu grupo</h2>
        <p className="arena-banner-streak">
          <Flame size={26} aria-hidden="true" />
          <strong>{group.streak.toLocaleString("pt-BR")}</strong>
          <span>{group.streak === 1 ? "dia juntos" : "dias juntos"}</span>
        </p>
        <div
          className="arena-banner-members"
          aria-label="Situação dos integrantes"
        >
          {group.members.map((member) => {
            const { text, Icon } = memberState(
              member,
              group.status === "pending",
            );
            return (
              <span
                className="arena-banner-member"
                key={member.id}
                role="img"
                aria-label={`${member.nickname}: ${text}`}
                title={`${member.nickname}: ${text}`}
              >
                <span aria-hidden="true">
                  <ArenaAvatar
                    name={member.nickname}
                    avatar={member.avatar}
                    frame={member.frame}
                  />
                  <span className="arena-member-state">
                    <Icon size={11} />
                  </span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="arena-banner-mascot" aria-hidden="true">
        <Mascot
          pose={
            group.resting ? "resting" : group.completed ? "happy" : "training"
          }
          size={112}
        />
      </div>
    </section>
  );
}
