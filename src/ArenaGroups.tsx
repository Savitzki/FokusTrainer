import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flame,
  Shield,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import ArenaAvatar from "./ArenaAvatar";
import ArenaGroupBanner from "./ArenaGroupBanner";
import ArenaGroupTools, { GroupWeeklyGoal } from "./ArenaGroupTools";
import GroupReactions from "./GroupReactions";
import type { Cosmetic } from "./gamification";
import type { PhraseTreatment } from "./phrasePreferences";
import {
  GROUP_MEMBER_LIMIT,
  rankGroupMembers,
  type SocialState,
  type useSocial,
} from "./social";
export type ArenaGroup = SocialState["groups"][number];
export function groupStatus(g: ArenaGroup) {
  return g.invited
    ? "Convite recebido"
    : g.status === "pending"
      ? "Formando equipe"
      : g.resting
        ? "Descanso coletivo"
        : g.completed
          ? "Dia concluído"
          : "Treinos pendentes";
}
function TeamAvatars({ group }: { group: ArenaGroup }) {
  return (
    <span
      className="arena-team-avatars"
      aria-label={`${group.members.filter((m) => m.accepted).length} integrantes aceitos`}
    >
      {group.members.slice(0, 5).map((m) => (
        <ArenaAvatar
          key={m.id}
          name={m.nickname}
          avatar={m.avatar}
          frame={m.frame}
        />
      ))}
    </span>
  );
}
export function ArenaGroups({
  groups,
  featuredId,
  onOpen,
  onCreate,
  treatment,
  busy,
  act,
}: {
  groups: ArenaGroup[];
  featuredId: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  treatment?: PhraseTreatment;
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
}) {
  const joined = groups.filter((g) => !g.invited),
    invitations = groups.filter((g) => g.invited);
  const featured =
    joined.find((g) => g.id === featuredId) ??
    joined.find((g) => g.status === "active") ??
    joined[0];
  const goal = featured?.goals?.[0];
  return (
    <div className="arena-teams">
      {featured ? (
        <>
          <div className="arena-section-heading">
            <div>
              <span className="arena-kicker">COOPERAÇÃO</span>
              <h2>Minhas equipes</h2>
            </div>
            <button
              className="outline-button"
              aria-label="Novo grupo"
              onClick={onCreate}
            >
              <UserPlus size={17} /> Criar
            </button>
          </div>
          <article
            className="arena-featured-team"
            aria-label={`Grupo ${featured.name}`}
          >
            <header>
              <span className="arena-team-emblem">
                <Shield size={23} />
              </span>
              <div>
                <span className="arena-kicker">SUA EQUIPE</span>
                <h3>{featured.name}</h3>
              </div>
              <span className="arena-team-streak">
                <Flame size={21} />
                <strong>{featured.streak}</strong>
                <small>dias</small>
              </span>
            </header>
            <div className="arena-team-state">
              <span className="arena-state-dot" />
              <span>{groupStatus(featured)}</span>
            </div>
            <TeamAvatars group={featured} />
            {goal && (
              <div className="arena-team-goal">
                <span>Meta da semana</span>
                <strong>
                  {goal.completed}/{goal.target} treinos
                </strong>
                {goal.target > 0 ? (
                  <progress
                    aria-label={`Meta semanal de ${featured.name}`}
                    value={Math.min(goal.completed, goal.target)}
                    max={goal.target}
                  />
                ) : (
                  <small>Sem meta elegível</small>
                )}
              </div>
            )}
            <button
              className="primary-button"
              id={`group-open-${featured.id}`}
              aria-label={`Detalhes de ${featured.name}`}
              onClick={() => onOpen(featured.id)}
            >
              Abrir equipe <ArrowRight size={17} />
            </button>
          </article>
          {joined.length > 1 && (
            <section className="arena-other-teams" aria-label="Outras equipes">
              <h3>Outras equipes</h3>
              {joined
                .filter((g) => g.id !== featured.id)
                .map((g) => (
                  <button
                    key={g.id}
                    id={`group-open-${g.id}`}
                    className="arena-team-row"
                    aria-label={`Detalhes de ${g.name}`}
                    onClick={() => onOpen(g.id)}
                  >
                    <span className="arena-row-emblem">
                      <Users size={20} />
                    </span>
                    <span>
                      <strong>{g.name}</strong>
                      <small>
                        {g.members.filter((m) => m.accepted).length} integrantes
                        · {groupStatus(g)}
                      </small>
                    </span>
                    <span className="arena-row-streak">
                      <Flame size={16} />
                      {g.streak}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
            </section>
          )}
        </>
      ) : (
        <ArenaGroupBanner treatment={treatment} onCreate={onCreate} />
      )}
      {invitations.length > 0 && (
        <section
          className="arena-group-invitations"
          aria-label="Convites de grupo"
        >
          <h3>
            Convites <span>{invitations.length}</span>
          </h3>
          {invitations.map((g) => (
            <article className="arena-invite-row" key={g.id}>
              <Users size={22} />
              <div>
                <button
                  className="friend-profile-link"
                  aria-label={`Detalhes de ${g.name}`}
                  onClick={() => onOpen(g.id)}
                >
                  {g.name}
                </button>
                <small>{g.members.length} participantes e convites</small>
              </div>
              <button
                className="invite-accept"
                aria-label={`Aceitar convite para ${g.name}`}
                disabled={busy}
                onClick={() =>
                  void act("reply_group_invite", { p_id: g.id, p_accept: true })
                }
              >
                <Check size={19} />
              </button>
              <button
                className="icon-button"
                aria-label={`Recusar convite para ${g.name}`}
                disabled={busy}
                onClick={() =>
                  void act("reply_group_invite", {
                    p_id: g.id,
                    p_accept: false,
                  })
                }
              >
                <X size={18} />
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
function memberStatus(m: ArenaGroup["members"][number], pending: boolean) {
  return !m.accepted
    ? "Convidado"
    : m.rescheduledTo
      ? "Treino reagendado"
      : m.resting
        ? "Descanso protegido"
        : m.needsPlan
          ? "Sem plano"
          : m.trained
            ? "Treino confirmado"
            : pending
              ? "Convite aceito"
              : "Treino pendente";
}
export function ArenaGroupPanel({
  group: g,
  userId,
  friends,
  busy,
  act,
  error,
  cosmetics,
  onBack,
}: {
  group: ArenaGroup;
  userId: string;
  friends: SocialState["friends"];
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
  error?: string;
  cosmetics?: Cosmetic[];
  onBack: () => void;
}) {
  const ranked =
    g.status === "pending"
      ? g.members.map((m) => ({ ...m, place: null }))
      : rankGroupMembers(g.members);
  return (
    <section className="arena-detail-panel" aria-label={`Equipe ${g.name}`}>
      <div className="arena-detail-heading">
        <button
          className="icon-button"
          aria-label="Voltar para equipes"
          onClick={onBack}
        >
          <ArrowLeft size={21} />
        </button>
        <div>
          <span className="arena-kicker">EQUIPE</span>
          <h2 tabIndex={-1} id="group-detail-heading">
            {g.name}
          </h2>
        </div>
      </div>
      <div className="arena-team-identity">
        <TeamAvatars group={g} />
        <span>
          {g.members.length}/{GROUP_MEMBER_LIMIT} vagas · {groupStatus(g)}
        </span>
      </div>
      {g.members.length > GROUP_MEMBER_LIMIT && (
        <p className="field-hint">
          Integrantes atuais preservados · sem novas vagas enquanto a equipe
          estiver acima do limite
        </p>
      )}
      <section className="arena-streak-panel" aria-label="Ofensiva coletiva">
        <Flame size={40} />
        <div>
          <strong>{g.streak}</strong>
          <span>dias juntos</span>
        </div>
        <span className="arena-streak-best">
          <Trophy size={16} /> Recorde {g.best}
        </span>
        <p>{groupStatus(g)}</p>
      </section>
      {g.goals && <GroupWeeklyGoal goals={g.goals} />}
      <section className="arena-roster" aria-label="Integrantes do grupo">
        <h3>
          Integrantes <span>{g.members.length}</span>
        </h3>
        <ul>
          {ranked.map((m) => (
            <li key={m.id}>
              <ArenaAvatar
                name={m.nickname}
                avatar={m.avatar}
                frame={m.frame}
                lit={m.accepted && m.trained}
              />
              <div>
                <strong>{m.nickname}</strong>
                <small>{memberStatus(m, g.status === "pending")}</small>
                {m.id === g.adminId && (
                  <small className="arena-admin-label">
                    <Shield size={11} /> Administrador
                  </small>
                )}
              </div>
              {m.place !== null && !g.resting && (
                <span
                  className="arena-member-place"
                  aria-label={`${m.place}º a confirmar o treino`}
                >
                  #{m.place}
                </span>
              )}
              {m.confirmedAt && m.accepted && m.trained && !g.resting && (
                <time dateTime={m.confirmedAt}>
                  {new Date(m.confirmedAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: g.timezone,
                  })}
                </time>
              )}
            </li>
          ))}
        </ul>
      </section>
      {g.invited ? (
        <div className="form-actions">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", { p_id: g.id, p_accept: true })
            }
          >
            Entrar no grupo
          </button>
          <button
            className="text-button"
            aria-label={`Recusar convite para ${g.name}`}
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", { p_id: g.id, p_accept: false })
            }
          >
            Recusar convite
          </button>
        </div>
      ) : (
        g.adminId && (
          <ArenaGroupTools
            group={g}
            userId={userId}
            friends={friends}
            busy={busy}
            act={act}
            error={error}
          />
        )
      )}
      {g.status === "active" &&
        !g.invited &&
        g.members.some((m) => m.accepted && m.trained) && (
          <GroupReactions userId={userId} group={g} items={cosmetics ?? []} />
        )}
      <details className="arena-rules">
        <summary>Dia da equipe e regras</summary>
        <h3>
          {g.resting
            ? "Descanso coletivo"
            : g.status === "pending"
              ? "Formando equipe"
              : g.completed
                ? "Dia concluído"
                : "Corrida em andamento"}
        </h3>
        <p>
          {g.resting
            ? "Todos estão descansando hoje. A ofensiva permanece protegida."
            : "Treinos programados precisam ser confirmados no dia do grupo. Descansos válidos protegem sem acrescentar pontos."}
        </p>
        <p>Fuso: {g.timezone}</p>
        {g.completedAt && !g.resting && (
          <p>
            Dia concluído às{" "}
            {new Date(g.completedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: g.timezone,
            })}
          </p>
        )}
        {g.members.some((m) => m.rescheduledTo || m.rescheduledFrom) && (
          <ul>
            {g.members
              .filter((m) => m.rescheduledTo || m.rescheduledFrom)
              .map((m) => (
                <li key={m.id}>
                  @{m.nickname}:{" "}
                  {m.rescheduledTo
                    ? `Transferido para ${m.rescheduledTo}`
                    : `Compensação de ${m.rescheduledFrom}`}
                </li>
              ))}
          </ul>
        )}
      </details>
    </section>
  );
}
