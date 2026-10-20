import Initials from "./ArenaAvatar";
import ArenaGroupBanner, { GroupArtwork } from "./ArenaGroupBanner";
import Modal from "./Modal";
import PageHeading from "./PageHeading";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  ClipboardPaste,
  Copy,
  Flame,
  Moon,
  Plus,
  RefreshCw,
  Share2,
  Search,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import ArenaGroupTools from "./ArenaGroupTools";
import FriendOptions from "./FriendOptions";
import type { Cosmetic } from "./gamification";
import type { Account } from "./account";
import { backendRpc } from "./backend";
import { isNickname } from "./nickname";
import { normalizeNickname } from "./profile";
import FriendProfile from "./FriendProfile";
import {
  deviceTimezone,
  GROUP_MEMBER_LIMIT,
  type SocialState,
  type useSocial,
} from "./social";

import type { ArenaTab } from "./navigation";
export type { ArenaTab } from "./navigation";
type View = ArenaTab | "add" | "code" | "create";
type Group = SocialState["groups"][number];

function friendCodeFromText(text: string) {
  return (
    text.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
    )?.[0] ?? text.trim()
  );
}

export default function SocialPanel({
  account,
  social,
  onProfile,
  challenges,
  initialTab = "groups",
  onTabChange,
  onChallenge,
}: {
  account: Account;
  social: ReturnType<typeof useSocial>;
  onProfile: () => void;
  cosmetics?: Cosmetic[];
  challenges?: ReactNode;
  initialTab?: ArenaTab;
  onTabChange?: (tab: ArenaTab) => void;
  onChallenge?: (id: string) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [view, setView] = useState<View>(initialTab);
  const currentTab = useRef(initialTab);
  useEffect(() => {
    if (initialTab === currentTab.current) return;
    currentTab.current = initialTab;
    setView(initialTab);
    setGroupId(null);
    if (initialTab === "challenges") setChallengesVisited(true);
  }, [initialTab]);
  const [challengesVisited, setChallengesVisited] = useState(
    initialTab === "challenges",
  );
  const [friendId, setFriendId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const tab: ArenaTab =
    view === "add" || view === "code"
      ? "friends"
      : view === "create"
        ? "groups"
        : view;
  const tabs = [
    { id: "groups", label: "Grupos", Icon: Users },
    { id: "friends", label: "Amigos", Icon: UserPlus },
    { id: "challenges", label: "Desafios", Icon: Trophy },
  ] as const;
  const [code, setCode] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const { state, busy, error, act, refresh } = social;
  const friends = state?.friends ?? [];
  const selectedFriend = friends.find((friend) => friend.id === friendId);
  const chosen = friends.filter((friend) => selected.includes(friend.id));
  const filtered = friends.filter((friend) =>
    friend.nickname
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const incoming = state?.requests.filter((request) => request.incoming) ?? [];
  const outgoing = state?.requests.filter((request) => !request.incoming) ?? [];
  const isForm = ["add", "code", "create"].includes(view);

  const selectedGroup = state?.groups.find((group) => group.id === groupId);
  useEffect(() => {
    if (groupId && state && !selectedGroup) setGroupId(null);
  }, [groupId, state, selectedGroup]);
  const joinedGroups = state?.groups.filter((group) => !group.invited) ?? [];
  function open(next: View) {
    const nextTab =
      next === "add" || next === "code"
        ? "friends"
        : next === "create"
          ? "groups"
          : next;
    currentTab.current = nextTab;
    onTabChange?.(nextTab);
    if (next === "challenges") setChallengesVisited(true);
    setGroupId(null);
    if (next === "add") setUseCode(false);
    setView(next);
    setNotice("");
    requestAnimationFrame(() =>
      panel.current?.scrollIntoView?.({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
      }),
    );
  }
  function create(friendId?: string) {
    setSelected(friendId ? [friendId] : []);
    setSearch("");
    open("create");
  }
  async function copyCode() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.code);
      setNotice("Código copiado.");
    } catch {
      setNotice("Selecione o código abaixo para copiar.");
    }
  }

  return (
    <section ref={panel} id="social" className="panel social-panel">
      <PageHeading title="Arena" icon={Trophy}>
        <div className="social-header-actions">
          <details className="social-help">
            <summary aria-label="Como funciona a ofensiva em grupo">
              <CircleHelp size={19} />
            </summary>
            <p>
              Treinos programados precisam ser confirmados no dia do grupo.
              Descansos válidos protegem a chama sem somar pontos. Treinou
              offline? Sincronize antes da meia-noite no fuso do grupo. A
              corrida diária usa a confirmação online.
            </p>
          </details>
        </div>
      </PageHeading>
      <div className="social-tabs" role="tablist" aria-label="Seções da Arena">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`arena-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="arena-panel"
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => open(item.id)}
            onKeyDown={(event) => {
              const offset =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!offset && event.key !== "Home" && event.key !== "End")
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index + offset + tabs.length) % tabs.length;
              open(tabs[next].id);
              document.getElementById(`arena-tab-${tabs[next].id}`)?.focus();
            }}
          >
            <item.Icon size={16} aria-hidden="true" />
            {item.label}
            {item.id === "friends" && incoming.length > 0 && (
              <span
                className="has-invites"
                aria-label={`${incoming.length} pedidos pendentes`}
              >
                {incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        id="arena-panel"
        role="tabpanel"
        aria-labelledby={`arena-tab-${tab}`}
        tabIndex={0}
      >
        {account.user && account.profileLoading ? (
          <p role="status">Carregando seu perfil…</p>
        ) : account.user && account.profileError && !account.profile ? (
          <div className="form-error" role="alert">
            {account.profileError}
            <button className="text-button" onClick={account.retry}>
              Tentar novamente
            </button>
          </div>
        ) : !account.user || !account.profile ? (
          <div className="team-empty">
            <Users size={34} />
            <h3>Entre na disputa</h3>
            <p>Treinos, amigos e desafios</p>
            <button className="primary-button" onClick={onProfile}>
              {account.user ? "Completar perfil" : "Entrar na Arena"}{" "}
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            {social.pending && (
              <p className="social-sync-note" role="status">
                <RefreshCw size={14} /> Treino salvo. Sincronizando…
              </p>
            )}
            {error && (
              <div className="form-error social-error" role="alert">
                <span>{error}</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {notice && (
              <p className="social-feedback" role="status">
                {notice}
              </p>
            )}
            {!state ? (
              <p role="status">
                {busy ? "Conectando seu time…" : "Conecte para ver seu time."}
              </p>
            ) : (
              <>
                {isForm ? (
                  <div className="social-flow-heading">
                    <button
                      className="icon-button"
                      aria-label="Voltar para amigos e grupos"
                      onClick={() =>
                        open(view === "create" ? "groups" : "friends")
                      }
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h3>
                      {view === "add"
                        ? "Adicionar amigo"
                        : view === "code"
                          ? "Seu código"
                          : "Novo grupo"}
                    </h3>
                  </div>
                ) : null}

                {view === "groups" && (
                  <>
                    {joinedGroups.length === 0 ? (
                      <ArenaGroupBanner
                        treatment={account.phrasePreferences?.treatment}
                        onCreate={() => create()}
                      />
                    ) : (
                      <div className="arena-section-heading">
                        <h2>Seus grupos</h2>
                        <button
                          className="outline-button"
                          aria-label="Novo grupo"
                          onClick={() => create()}
                        >
                          <Plus size={17} /> Novo
                        </button>
                      </div>
                    )}
                    {joinedGroups.length === 0 && state.groups.length > 0 && (
                      <h2 className="group-invites-heading">Convites</h2>
                    )}
                    {state.groups.length > 0 && (
                      <div className="group-list">
                        {[...state.groups]
                          .sort((a, b) => Number(b.invited) - Number(a.invited))
                          .map((group) => (
                            <GroupSummary
                              key={group.id}
                              group={group}
                              onOpen={() => setGroupId(group.id)}
                            />
                          ))}
                      </div>
                    )}
                  </>
                )}
                {challengesVisited && (
                  <div hidden={view !== "challenges"}>
                    {challenges ?? (
                      <div className="arena-empty">
                        <p>Desafios indisponíveis no momento</p>
                      </div>
                    )}
                  </div>
                )}

                {view === "friends" && (
                  <>
                    <div className="arena-section-heading">
                      <div>
                        <h2>Seus amigos</h2>
                        <p className="arena-section-count">
                          {friends.length}{" "}
                          {friends.length === 1 ? "amigo" : "amigos"}
                        </p>
                      </div>
                      <button
                        className="outline-button"
                        aria-label="Adicionar amigo"
                        onClick={() => open("add")}
                      >
                        <Plus size={17} /> Adicionar
                      </button>
                    </div>
                    {incoming.length > 0 && (
                      <div className="friend-invites">
                        <h3>
                          Convites <span>{incoming.length}</span>
                        </h3>
                        {incoming.map((request) => (
                          <div className="friend-row" key={request.id}>
                            <Initials name={request.nickname} />
                            <strong>{request.nickname}</strong>
                            <button
                              className="invite-accept"
                              aria-label={`Aceitar amizade de ${request.nickname}`}
                              disabled={busy}
                              onClick={() =>
                                void act("reply_friend_request", {
                                  p_id: request.id,
                                  p_accept: true,
                                })
                              }
                            >
                              <Check size={19} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Recusar amizade de ${request.nickname}`}
                              disabled={busy}
                              onClick={() =>
                                void act("reply_friend_request", {
                                  p_id: request.id,
                                  p_accept: false,
                                })
                              }
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {friends.length > 0 && (
                      <div className="friend-list">
                        {friends.map((friend) => (
                          <div className="friend-row" key={friend.id}>
                            <Initials
                              name={friend.nickname}
                              frame={friend.frame}
                              avatar={friend.avatar}
                            />
                            <button
                              className="friend-profile-link"
                              aria-label={`Ver perfil de ${friend.nickname}`}
                              onClick={() => setFriendId(friend.id)}
                            >
                              {friend.nickname}
                            </button>
                            {state.arenaVersion && (
                              <FriendOptions
                                friend={friend}
                                userId={account.user?.id}
                                busy={busy}
                                act={act}
                                error={error}
                                interactions={state.arenaVersion >= 2}
                                onChallenge={
                                  state.arenaVersion >= 2 && onChallenge
                                    ? () => {
                                        onChallenge(friend.id);
                                        open("challenges");
                                      }
                                    : undefined
                                }
                              />
                            )}
                            <button
                              className="friend-group-button"
                              aria-label={`Criar grupo com ${friend.nickname}`}
                              onClick={() => create(friend.id)}
                            >
                              <Users size={17} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {!friends.length && !incoming.length && (
                      <div className="arena-empty">
                        <UserPlus size={24} />
                        <div>
                          <h3>Quem treina com você?</h3>
                          <p>Busque pelo @nick e envie um pedido</p>
                        </div>
                      </div>
                    )}
                    {outgoing.length > 0 && (
                      <details className="sent-invites">
                        <summary>Enviados · {outgoing.length}</summary>
                        {outgoing.map((request) => (
                          <div className="friend-row" key={request.id}>
                            <Initials name={request.nickname} />
                            <strong>{request.nickname}</strong>
                            <span className="request-waiting">Aguardando</span>
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}

                {view === "add" &&
                  (useCode ? (
                    <form
                      className="social-form add-friend-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (
                          await act("send_friend_request", {
                            p_code: code.trim(),
                          })
                        ) {
                          setCode("");
                          setView("friends");
                          setNotice("Convite enviado.");
                        }
                      }}
                    >
                      <div className="flow-icon">
                        <UserPlus size={30} />
                      </div>
                      <label htmlFor="friend-code">Código do amigo</label>
                      <div className="friend-code-entry">
                        <input
                          id="friend-code"
                          disabled={busy}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="Cole o código aqui"
                          value={code}
                          pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                          onChange={(event) =>
                            setCode(friendCodeFromText(event.target.value))
                          }
                        />
                        {navigator.clipboard?.readText && (
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Colar código do amigo"
                            onClick={async () => {
                              try {
                                setCode(
                                  friendCodeFromText(
                                    await navigator.clipboard.readText(),
                                  ),
                                );
                              } catch {
                                setNotice("Cole o código no campo.");
                              }
                            }}
                          >
                            <ClipboardPaste size={20} />
                          </button>
                        )}
                      </div>
                      <button
                        className="primary-button social-submit"
                        disabled={busy || !code}
                      >
                        {busy ? "Enviando…" : "Enviar convite"}
                        <ArrowRight size={17} />
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setUseCode(false)}
                      >
                        <Search size={16} /> Buscar pelo nick
                      </button>
                    </form>
                  ) : (
                    <FriendNicknameSearch
                      social={social}
                      onUseCode={() => setUseCode(true)}
                      onShareCode={() => open("code")}
                      onDone={(message) => {
                        setView("friends");
                        setNotice(message);
                      }}
                    />
                  ))}

                {view === "code" && (
                  <div className="my-friend-code">
                    <div className="flow-icon">
                      <Users size={32} />
                    </div>
                    <p>Compartilhe com quem treina com você.</p>
                    <input
                      aria-label="Seu código de amigo"
                      id="my-friend-code"
                      value={state.code}
                      readOnly
                      onFocus={(event) => event.target.select()}
                    />
                    <div className="social-toolbar">
                      <button
                        className="primary-button"
                        onClick={async () => {
                          if (!navigator.share) {
                            await copyCode();
                            return;
                          }
                          try {
                            await navigator.share({
                              title: "Treine comigo na Capibora",
                              text: `Bora treinar juntos? Meu código na Capibora: ${state.code}`,
                            });
                          } catch (error) {
                            if ((error as Error).name !== "AbortError")
                              await copyCode();
                          }
                        }}
                      >
                        <Share2 size={17} /> Compartilhar
                      </button>
                      <button
                        className="outline-button"
                        onClick={() => void copyCode()}
                      >
                        <Copy size={17} /> Copiar
                      </button>
                    </div>
                  </div>
                )}

                {view === "create" &&
                  (!friends.length ? (
                    <div className="team-empty">
                      <UserPlus size={34} />
                      <h3>Primeiro, um parceiro.</h3>
                      <button
                        className="primary-button"
                        onClick={() => open("add")}
                      >
                        Adicionar amigo <Plus size={17} />
                      </button>
                    </div>
                  ) : (
                    <form
                      className="social-form create-group-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!chosen.length) return;
                        if (
                          await act("create_streak_group", {
                            p_name: name.trim(),
                            p_friends: chosen.map((friend) => friend.id),
                            p_timezone: deviceTimezone(),
                          })
                        ) {
                          setName("");
                          setSelected([]);
                          setSearch("");
                          setView("groups");
                          setNotice("Convites enviados.");
                        }
                      }}
                    >
                      <label htmlFor="group-name">Nome do grupo</label>
                      <input
                        id="group-name"
                        disabled={busy}
                        required
                        maxLength={40}
                        value={name}
                        placeholder="Ex.: Treino das 7"
                        onChange={(event) => setName(event.target.value)}
                      />
                      <fieldset>
                        <legend>
                          Escolha seu time{" "}
                          <span aria-live="polite">
                            {chosen.length}/{GROUP_MEMBER_LIMIT - 1}
                          </span>
                        </legend>
                        {friends.length > 5 && (
                          <input
                            type="search"
                            disabled={busy}
                            className="friend-search"
                            aria-label="Buscar amigo para o grupo"
                            placeholder="Buscar amigo"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                          />
                        )}
                        <div className="friend-picker-list">
                          {filtered.map((friend) => {
                            const checked = chosen.some(
                              (person) => person.id === friend.id,
                            );
                            const disabled =
                              busy ||
                              (!checked &&
                                chosen.length >= GROUP_MEMBER_LIMIT - 1);
                            return (
                              <label
                                className={`friend-picker ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                                key={friend.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setSelected((prev) =>
                                      event.target.checked
                                        ? [...prev, friend.id]
                                        : prev.filter((id) => id !== friend.id),
                                    )
                                  }
                                />
                                <Initials
                                  name={friend.nickname}
                                  frame={friend.frame}
                                  avatar={friend.avatar}
                                />
                                <strong>{friend.nickname}</strong>
                                <span
                                  className="friend-pick-check"
                                  aria-hidden="true"
                                >
                                  {checked && <Check size={17} />}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {!filtered.length && (
                          <p className="friend-search-empty">
                            Nenhum amigo encontrado.
                          </p>
                        )}
                      </fieldset>
                      <div className="group-selection-summary">
                        <Users size={17} />
                        <span>
                          Você
                          {chosen.length
                            ? ` + ${chosen.length} ${chosen.length === 1 ? "amigo" : "amigos"}`
                            : " + seu time"}
                        </span>
                      </div>
                      <button
                        className="primary-button social-submit"
                        disabled={busy || !chosen.length || !name.trim()}
                      >
                        {busy
                          ? "Enviando…"
                          : chosen.length
                            ? `Convidar ${chosen.length} ${chosen.length === 1 ? "amigo" : "amigos"}`
                            : "Escolha seus amigos"}
                        <ArrowRight size={17} />
                      </button>
                      <small className="group-start-note">
                        Começa quando todos aceitarem.
                      </small>
                    </form>
                  ))}
              </>
            )}
          </>
        )}
      </div>
      {account.user && view === "groups" && selectedGroup && (
        <Modal
          title="Detalhes do grupo"
          centered
          compactHeader
          dismissible={false}
          closeDisabled={busy}
          onClose={() => setGroupId(null)}
        >
          <GroupDetails
            key={selectedGroup.id}
            group={selectedGroup}
            busy={busy}
            act={act}
            userId={account.user.id}
            friends={friends}
            error={error}
          />
        </Modal>
      )}
      {account.user && selectedFriend && (
        <FriendProfile
          key={`${account.user.id}:${selectedFriend.id}`}
          userId={account.user.id}
          friendId={selectedFriend.id}
          nickname={selectedFriend.nickname}
          onClose={() => setFriendId(null)}
        />
      )}
    </section>
  );
}

type FriendMatch = {
  id: string;
  nickname: string;
  relationship: "self" | "friend" | "incoming" | "outgoing" | "none";
  requestId: string | null;
};
function FriendNicknameSearch({
  social,
  onUseCode,
  onShareCode,
  onDone,
}: {
  social: ReturnType<typeof useSocial>;
  onUseCode: () => void;
  onShareCode: () => void;
  onDone: (message: string) => void;
}) {
  const [nick, setNick] = useState(""),
    [found, setFound] = useState<FriendMatch | null>(null),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  return (
    <form
      className="social-form add-friend-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!isNickname(nick) || busy) return;
        const version = ++sequence.current;
        setBusy(true);
        setError("");
        setFound(null);
        setSearched(false);
        try {
          const result = await backendRpc<FriendMatch | null>(
            "find_friend_by_nickname",
            { p_nickname: normalizeNickname(nick) },
          );
          if (version !== sequence.current) return;
          if (
            result &&
            (typeof result.id !== "string" ||
              typeof result.nickname !== "string" ||
              !["self", "friend", "incoming", "outgoing", "none"].includes(
                result.relationship,
              ))
          )
            throw new Error("Não foi possível conferir esse nick");
          setFound(result);
          setSearched(true);
        } catch (failure) {
          if (version === sequence.current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Não foi possível buscar esse nick",
            );
        } finally {
          if (version === sequence.current) setBusy(false);
        }
      }}
    >
      <div className="flow-icon">
        <UserPlus size={30} />
      </div>
      <label htmlFor="friend-nickname">Nick do amigo</label>
      <input
        id="friend-nickname"
        type="search"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={25}
        placeholder="@dani.treina"
        value={nick}
        onChange={(event) => {
          sequence.current++;
          setBusy(false);
          setNick(event.target.value);
          setFound(null);
          setSearched(false);
          setError("");
        }}
      />
      <button
        className="primary-button social-submit"
        disabled={busy || social.busy || !isNickname(nick)}
      >
        <Search size={17} />
        {busy ? "Buscando…" : "Buscar"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {searched && !found && (
        <p className="field-hint" role="status">
          Não encontrei esse nick. Confira o @ completo
        </p>
      )}
      {found && (
        <div className="friend-search-result">
          <div className="friend-row">
            <Initials name={found.nickname} />
            <strong>@{found.nickname}</strong>
          </div>
          {found.relationship === "none" ? (
            <button
              type="button"
              className="primary-button"
              disabled={social.busy}
              onClick={async () => {
                if (
                  await social.act("send_friend_request_by_nickname", {
                    p_nickname: found.nickname,
                  })
                )
                  onDone("Pedido enviado. Agora é só aguardar o aceite");
              }}
            >
              <UserPlus size={17} />
              Enviar pedido
            </button>
          ) : found.relationship === "incoming" && found.requestId ? (
            <button
              type="button"
              className="primary-button"
              disabled={social.busy}
              onClick={async () => {
                if (
                  await social.act("reply_friend_request", {
                    p_id: found.requestId,
                    p_accept: true,
                  })
                )
                  onDone("Amizade aceita. Já podem criar uma Arena");
              }}
            >
              <Check size={17} />
              Aceitar pedido
            </button>
          ) : (
            <p className="field-hint" role="status">
              {found.relationship === "self"
                ? "Esse é o seu nick"
                : found.relationship === "friend"
                  ? "Vocês já são amigos"
                  : "Pedido enviado · aguardando aceite"}
            </p>
          )}
        </div>
      )}
      <details className="context-details">
        <summary>Convites por código</summary>
        <button type="button" className="text-button" onClick={onUseCode}>
          Usar código de amigo
        </button>
        <button type="button" className="text-button" onClick={onShareCode}>
          <Share2 size={16} /> Meu código
        </button>
      </details>
    </form>
  );
}

function GroupSummary({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const accepted = group.members.filter((member) => member.accepted).length;
  return (
    <article className="group-summary" aria-label={`Grupo ${group.name}`}>
      <div className="group-summary-copy">
        <h3>{group.name}</h3>
        <p>
          {accepted} {accepted === 1 ? "integrante" : "integrantes"}
          {group.invited ? " · Convite" : ""}
        </p>
        <button
          className="outline-button"
          id={`group-open-${group.id}`}
          onClick={onOpen}
          aria-label={`Detalhes de ${group.name}`}
        >
          Ver grupo <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <GroupArtwork />
    </article>
  );
}

function GroupDetails({
  group,
  busy,
  act,
  userId,
  friends,
  error,
}: {
  group: Group;
  busy: boolean;
  act: ReturnType<typeof useSocial>["act"];
  userId: string;
  friends: SocialState["friends"];
  error?: string;
}) {
  const total = group.members.length;
  const members = (onInvite?: () => void) => (
    <section
      className="group-identity-members"
      aria-label="Integrantes do grupo"
    >
      <div className="group-members-title">
        <h4>Integrantes</h4>
        <span
          aria-label={`${total} de ${GROUP_MEMBER_LIMIT} vagas ocupadas, incluindo convites`}
        >
          {total}/{GROUP_MEMBER_LIMIT}
        </span>
      </div>
      {total > GROUP_MEMBER_LIMIT && (
        <p className="field-hint">
          Integrantes atuais preservados. Limite de {GROUP_MEMBER_LIMIT} para
          novas vagas.
        </p>
      )}
      <ul className="group-member-slots">
        {group.members.map((member) => {
          const status = !member.accepted
            ? "Convidado"
            : member.rescheduledTo
              ? "Treino reagendado"
              : member.resting
                ? "Descanso protegido"
                : member.needsPlan
                  ? "Sem plano"
                  : member.trained
                    ? "Treino confirmado"
                    : "Treino pendente";
          return (
            <li key={member.id} title={`${member.nickname}: ${status}`}>
              <Initials
                name={member.nickname}
                frame={member.frame}
                avatar={member.avatar}
                lit={member.accepted && member.trained}
              />
              <strong>{member.nickname}</strong>
              <span className="group-slot-status" aria-label={status}>
                {member.resting && member.accepted ? (
                  <Moon size={13} />
                ) : member.accepted && member.trained ? (
                  <Check size={13} />
                ) : (
                  <Clock3 size={13} />
                )}
              </span>
            </li>
          );
        })}
        {Array.from(
          { length: Math.max(0, GROUP_MEMBER_LIMIT - total) },
          (_, i) => (
            <li key={`free-${i}`} className="group-free-slot">
              <button
                className="icon-button"
                aria-label={`Convidar para a vaga ${total + i + 1} de ${group.name}`}
                title={
                  onInvite
                    ? "Convidar amigo"
                    : "Entre no grupo para convidar amigos"
                }
                disabled={busy || !onInvite}
                onClick={onInvite}
              >
                <UserPlus size={21} aria-hidden="true" />
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
  return (
    <article
      className="group-detail-card group-card"
      aria-label={`Grupo ${group.name}`}
    >
      <header className="group-detail-identity">
        <h3>{group.name}</h3>
        <div
          className="group-streak-highlight"
          aria-label={`${group.streak} ${group.streak === 1 ? "dia" : "dias"} de ofensiva coletiva`}
        >
          <Flame size={34} aria-hidden="true" />
          <strong>{group.streak}</strong>
        </div>
        <p>{group.streak === 1 ? "dia" : "dias"} de ofensiva juntos</p>
      </header>
      {group.adminId && !group.invited ? (
        <ArenaGroupTools
          compact
          group={group}
          userId={userId}
          friends={friends}
          busy={busy}
          act={act}
          error={error}
        >
          {members}
        </ArenaGroupTools>
      ) : (
        members()
      )}
      {group.invited && (
        <div className="group-invite-actions">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", { p_id: group.id, p_accept: true })
            }
          >
            <Check size={17} /> Entrar no grupo
          </button>
          <button
            className="icon-button"
            aria-label={`Recusar convite para ${group.name}`}
            disabled={busy}
            onClick={() =>
              void act("reply_group_invite", {
                p_id: group.id,
                p_accept: false,
              })
            }
          >
            <X size={18} />
          </button>
        </div>
      )}
    </article>
  );
}
