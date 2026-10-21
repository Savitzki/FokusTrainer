import ArenaFriends from "./ArenaFriends";
import "./arena.css";
import Initials from "./ArenaAvatar";
import { ArenaGroups, ArenaGroupPanel } from "./ArenaGroups";
import Modal from "./Modal";
import PageHeading from "./PageHeading";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardPaste,
  Copy,
  Plus,
  RefreshCw,
  Share2,
  Search,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import FriendOptions from "./FriendOptions";
import type { Cosmetic } from "./gamification";
import type { Account } from "./account";
import { backendRpc } from "./backend";
import { isNickname } from "./nickname";
import { normalizeNickname } from "./profile";
import FriendProfile from "./FriendProfile";
import { deviceTimezone, GROUP_MEMBER_LIMIT, type useSocial } from "./social";

import type { ArenaTab } from "./navigation";
export type { ArenaTab } from "./navigation";
type View = ArenaTab | "add" | "code" | "create";

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
  cosmetics,
  initialGroupId,
  initialFriendId,
  onGroupOpen,
  onFriendOpen,
  onDetailBack,
  challengeInvites,
}: {
  account: Account;
  social: ReturnType<typeof useSocial>;
  onProfile: () => void;
  cosmetics?: Cosmetic[];
  challenges?: ReactNode;
  initialTab?: ArenaTab;
  onTabChange?: (tab: ArenaTab) => void;
  onChallenge?: (id: string) => void;
  initialGroupId?: string | null;
  initialFriendId?: string | null;
  onGroupOpen?: (id: string) => void;
  onFriendOpen?: (id: string) => void;
  onDetailBack?: () => void;
  challengeInvites?: number;
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
  const [friendId, setFriendId] = useState<string | null>(
    initialFriendId ?? null,
  );
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [friendConfirmation, setFriendConfirmation] = useState(false);
  useEffect(() => {
    if (initialGroupId !== undefined) setGroupId(initialGroupId);
  }, [initialGroupId]);
  useEffect(() => {
    if (initialFriendId !== undefined) setFriendId(initialFriendId);
  }, [initialFriendId]);
  useEffect(() => {
    const target = view === "groups" && groupId ? "group-detail-heading" : null;
    if (!target) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById(target)?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [groupId, friendId, view]);
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
  useEffect(() => {
    // A cached list can predate a notification/deep link. Only render a match,
    // but keep the requested route until the existing refresh supplies it.
    if (friendId && state && !selectedFriend && !initialFriendId)
      setFriendId(null);
  }, [friendId, state, selectedFriend, initialFriendId]);
  const chosen = friends.filter((friend) => selected.includes(friend.id));
  const filtered = friends.filter((friend) =>
    friend.nickname
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const incoming = state?.requests.filter((request) => request.incoming) ?? [];
  const isForm = ["add", "code", "create"].includes(view);

  const selectedGroup = state?.groups.find((group) => group.id === groupId);
  useEffect(() => {
    if (groupId && state && !selectedGroup && !initialGroupId) setGroupId(null);
  }, [groupId, state, selectedGroup, initialGroupId]);
  const groupInvites =
    state?.groups.filter((group) => group.invited).length ?? 0;
  function openGroup(id: string) {
    setFeaturedId(id);
    setGroupId(id);
    onGroupOpen?.(id);
  }
  function openFriend(id: string) {
    setFriendConfirmation(false);
    setFriendId(id);
    onFriendOpen?.(id);
  }
  function backToList(kind: "groups" | "friends") {
    const previous = kind === "groups" ? groupId : friendId;
    setGroupId(null);
    setFriendId(null);
    onDetailBack?.();
    requestAnimationFrame(() =>
      document
        .getElementById(
          `${kind === "groups" ? "group-open" : "friend-open"}-${previous}`,
        )
        ?.focus({ preventScroll: kind === "friends" }),
    );
  }
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
    setFriendId(null);
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
            {(item.id === "friends"
              ? incoming.length
              : item.id === "groups"
                ? groupInvites
                : (challengeInvites ?? 0)) > 0 && (
              <span
                className="has-invites"
                aria-label={`${item.id === "friends" ? incoming.length : item.id === "groups" ? groupInvites : challengeInvites} ${item.id === "friends" ? "pedidos pendentes" : "convites pendentes"}`}
              >
                {item.id === "friends"
                  ? incoming.length
                  : item.id === "groups"
                    ? groupInvites
                    : challengeInvites}
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

                {view === "groups" &&
                  (selectedGroup ? (
                    <ArenaGroupPanel
                      group={selectedGroup}
                      userId={account.user.id}
                      friends={friends}
                      busy={busy}
                      act={act}
                      error={error}
                      cosmetics={cosmetics}
                      onBack={() => backToList("groups")}
                    />
                  ) : (
                    <ArenaGroups
                      groups={state.groups}
                      featuredId={featuredId}
                      onOpen={openGroup}
                      onCreate={() => create()}
                      treatment={account.phrasePreferences?.treatment}
                      busy={busy}
                      act={act}
                    />
                  ))}
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
                    {selectedFriend && (
                      <>
                        <FriendProfile
                          key={`${account.user.id}:${selectedFriend.id}`}
                          userId={account.user.id}
                          friendId={selectedFriend.id}
                          nickname={selectedFriend.nickname}
                          onClose={() => backToList("friends")}
                          closeDisabled={busy}
                          actionsOnly={friendConfirmation}
                        >
                          <FriendOptions
                            friend={selectedFriend}
                            canRemove={Boolean(state.arenaVersion)}
                            busy={busy}
                            act={act}
                            error={error}
                            onConfirmChange={setFriendConfirmation}
                            onRemoved={() => backToList("friends")}
                            onChallenge={
                              (state.arenaVersion ?? 0) >= 2 && onChallenge
                                ? () => {
                                    onChallenge(selectedFriend.id);
                                    open("challenges");
                                  }
                                : undefined
                            }
                          />
                        </FriendProfile>
                      </>
                    )}
                    <ArenaFriends
                      state={state}
                      userId={account.user.id}
                      busy={busy}
                      act={act}
                      error={error}
                      onAdd={() => open("add")}
                      onOpen={openFriend}
                    />
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
