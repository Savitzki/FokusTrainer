import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Camera,
  Image as ImageIcon,
  Check,
  Smartphone,
  LockKeyhole,
  LogOut,
  Pencil,
  Mail,
  UserRound,
  Flame,
  Trophy,
  Dumbbell,
} from "lucide-react";
import { frameImage, frameArtworkStyle } from "./cosmetics";
import { ProfileCover } from "./ProfileCosmetics";
import type { Account } from "./account";
import AccountForm from "./AccountForm";
import PhrasePreferencesFields from "./PhrasePreferencesFields";
import { defaultPhrasePreferences } from "./phrasePreferences";
import {
  isNickname,
  NicknameConflictError,
  type NicknameAvailability,
} from "./nickname";
import {
  AVATAR_COLORS,
  AVATAR_STYLES,
  avatarSource,
  blankProfile,
  normalizeNickname,
  preparePhoto,
  validateProfile,
  type Profile,
} from "./profile";

export function Avatar({
  profile,
  size = 44,
  frame,
}: {
  profile: Profile | null;
  size?: number;
  frame?: string;
}) {
  const art = frame ? frameImage(frame) : null;
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const image = (
    <img
      className="profile-avatar"
      data-frame={art && failedArt !== art ? frame : undefined}
      src={avatarSource(profile)}
      width={size}
      height={size}
      alt={profile ? `Avatar de ${profile.nickname}` : "Seu avatar"}
    />
  );
  return art && failedArt !== art ? (
    <span className="framed-avatar" style={{ width: size, height: size }}>
      {image}
      <img
        src={art}
        onError={() => setFailedArt(art)}
        className="avatar-frame-art"
        style={frame ? frameArtworkStyle(frame) : undefined}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        decoding="async"
      />
    </span>
  ) : (
    image
  );
}

export default function ProfilePanel({
  profile,
  account,
  onSaveLocal,
  onSaved,
  onRegistrationCompleted,
  cosmeticFrame,
  cosmeticBanner,
  stats,
  children,
  initialTab = "profile",
}: {
  profile: Profile | null;
  account: Account;
  onSaveLocal: (profile: Profile) => void;
  onSaved: (message: string) => void;
  onRegistrationCompleted?: () => void;
  cosmeticFrame?: string;
  cosmeticBanner?: string;
  stats?: { workouts: number; streak: number; bestStreak: number };
  children?: ReactNode;
  initialTab?: "profile" | "account";
}) {
  const [authOpen, setAuthOpen] = useState(initialTab === "account");
  const [editing, setEditing] = useState(!profile);
  const registrationPending = useRef(false);
  useEffect(() => {
    if (
      account.user &&
      account.profileChecked &&
      !account.profileLoading &&
      !account.profileError &&
      !profile
    )
      registrationPending.current = true;
  }, [
    account.user?.id,
    account.profileChecked,
    account.profileLoading,
    account.profileError,
    profile,
  ]);
  const [phrasePreferences, setPhrasePreferences] = useState(
    account.phrasePreferences ?? defaultPhrasePreferences(),
  );
  useEffect(
    () =>
      setPhrasePreferences(
        account.phrasePreferences ?? defaultPhrasePreferences(),
      ),
    [
      account.phrasePreferences?.displayName,
      account.phrasePreferences?.treatment,
    ],
  );
  const [draft, setDraft] = useState<Profile>(() => profile ?? blankProfile());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [availability, setAvailability] = useState<NicknameAvailability | null>(
    null,
  );
  const [checkingNick, setCheckingNick] = useState(false);
  const nicknameLocked = Boolean(account.user && profile);
  const displayName =
    phrasePreferences.displayName.trim() || draft.nickname || "Seu perfil";
  const sexLabel = {
    masculine: "Masculino",
    feminine: "Feminino",
    neutral: "Não informado",
  }[phrasePreferences.treatment];
  function cancelEditing() {
    setDraft(profile ?? blankProfile());
    setPhrasePreferences(account.phrasePreferences ?? defaultPhrasePreferences());
    setAvailability(null);
    setError("");
    setEditing(false);
  }
  useEffect(() => {
    setAvailability(null);
    setCheckingNick(false);
    if (!account.user || nicknameLocked || !isNickname(draft.nickname)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setCheckingNick(true);
      void account
        .checkNickname(draft.nickname)
        .then((result) => {
          if (!cancelled) {
            setAvailability(result);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "Não foi possível conferir seu nick. Tente salvar novamente",
            );
        })
        .finally(() => {
          if (!cancelled) setCheckingNick(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [account.user?.id, nicknameLocked, draft.nickname]);
  useEffect(() => {
    setDraft(profile ?? blankProfile());
  }, [profile]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const valid = validateProfile({
        ...draft,
        nickname: nicknameLocked
          ? profile!.nickname
          : normalizeNickname(draft.nickname),
      });
      if (account.user && !nicknameLocked) {
        const checked = await account.checkNickname(valid.nickname);
        setAvailability(checked);
        if (!checked.valid || !checked.available)
          throw new NicknameConflictError(checked.suggestions);
      }
      if (account.user) await account.saveProfile(valid, phrasePreferences);
      else onSaveLocal(valid);
      setEditing(false);
      onSaved(
        account.user
          ? "Perfil salvo na sua conta."
          : "Perfil salvo neste dispositivo.",
      );
      if (account.user && registrationPending.current) {
        registrationPending.current = false;
        onRegistrationCompleted?.();
      }
    } catch (error) {
      if (error instanceof NicknameConflictError)
        setAvailability({
          valid: true,
          available: false,
          suggestions: error.suggestions,
        });
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (authOpen && !account.user)
    return (
      <div className="profile-panel auth-panel">
        <AccountForm
          account={account}
          profile={profile}
          onSignedIn={() => setAuthOpen(false)}
        />
      </div>
    );
  return (
    <div className="profile-panel profile-redesign">
      <section className="profile-identity" aria-label="Identidade do perfil">
        <ProfileCover
          banner={cosmeticBanner}
          fallback={
            <span className="profile-banner-placeholder" aria-hidden="true">
              <ImageIcon size={32} />
            </span>
          }
        />
        {!editing && !account.profileLoading && (
          <button
            type="button"
            className="icon-button profile-edit-button"
            aria-label="Editar perfil"
            title="Editar perfil"
            onClick={() => setEditing(true)}
          >
            <Pencil size={19} aria-hidden="true" />
          </button>
        )}
        <div className="profile-identity-main">
          <div className="profile-identity-copy">
            <h3>{displayName}</h3>
            <p className="profile-handle">
              {draft.nickname ? "@" + draft.nickname : "Escolha seu @nick"}
              {nicknameLocked && <LockKeyhole size={12} aria-label="Nick permanente" />}
            </p>
          </div>
          <div className="profile-portrait">
            <Avatar
              profile={draft.nickname ? draft : { ...draft, nickname: "CA" }}
              size={84}
              frame={cosmeticFrame}
            />
                <label className={`photo-upload profile-photo-button ${photoBusy ? "is-busy" : ""}`} title="Alterar foto">
                  <Camera size={18} />
                  <span className="sr-only">{photoBusy ? "Preparando…" : "Alterar foto"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Foto do avatar"
                    disabled={photoBusy || busy || account.profileLoading}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      setEditing(true);
                      setPhotoBusy(true);
                      setError("");
                      try {
                        const photo = await preparePhoto(file);
                        setDraft((prev) => ({ ...prev, photo }));
                      } catch (error) {
                        setError((error as Error).message);
                      } finally {
                        setPhotoBusy(false);
                      }
                    }}
                  />
                </label>
          </div>
        </div>
        {!account.user && (
          <div className="profile-identity-footer">
            <span className="profile-connection"><Smartphone size={13} /> Neste celular</span>
          </div>
        )}
      </section>
      {!account.user && (
        <button type="button" className="primary-button profile-login" onClick={() => setAuthOpen(true)}>
          Entrar na conta
        </button>
      )}
      {account.profileLoading ? (
        <p role="status" className="modal-description">Carregando seu perfil…</p>
      ) : account.profileError && !profile ? (
        <div className="form-error" role="alert">
          {account.profileError}
          <button type="button" className="text-button" onClick={account.retry}>Tentar novamente</button>
        </div>
      ) : editing ? (
        <form className="profile-editor" aria-label="Editar perfil" onSubmit={save}>
          <h3>{profile ? "Do seu jeito" : "Monte seu perfil"}</h3>
          {account.user && (
            <details className="profile-details compact-disclosure">
              <summary>Dados da conta</summary>
              <section aria-label="Dados da conta">
                <dl>
                  <div>
                    <dt><Mail size={17} aria-hidden="true" /> E-mail</dt>
                    <dd>{account.user.email || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt><UserRound size={17} aria-hidden="true" /> Sexo</dt>
                    <dd>{sexLabel}</dd>
                  </div>
                </dl>
              </section>
            </details>
          )}

            <label className="form-label">
              Seu nick
              <input
                autoComplete="nickname"
                maxLength={25}
                placeholder="Ex.: dani.treina"
                required
                disabled={busy}
                readOnly={nicknameLocked}
                aria-describedby="nickname-rules"
                aria-invalid={availability?.available === false || undefined}
                value={draft.nickname}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    nickname: event.target.value,
                  }))
                }
              />
            </label>
            <p className="field-hint nickname-rules" id="nickname-rules">
              {nicknameLocked ? (
                <>
                  <LockKeyhole size={13} /> Seu @nick é permanente
                </>
              ) : account.user ? (
                "3–24 caracteres · letras, números, . - _ · permanente"
              ) : (
                "Nick local · entre na conta para reservar um @nick único"
              )}
            </p>
            {checkingNick && (
              <p className="field-hint" role="status">
                Conferindo nick…
              </p>
            )}
            {availability && !availability.available && (
              <div className="nickname-feedback" role="alert">
                <p>Esse nick já está em uso</p>
                {!!availability.suggestions.length && (
                  <div
                    className="nickname-suggestions"
                    aria-label="Sugestões de nick"
                  >
                    {availability.suggestions.map((nick) => (
                      <button
                        className="outline-button"
                        key={nick}
                        type="button"
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, nickname: nick }));
                          setError("");
                        }}
                      >
                        @{nick}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {account.user && (
              <>
                <PhrasePreferencesFields
                  value={phrasePreferences}
                  onChange={setPhrasePreferences}
                />
              </>
            )}
            <fieldset className="avatar-options" disabled={busy || photoBusy}>
              <legend>Estilo do avatar</legend>
              <div
                className="avatar-styles"
                role="radiogroup"
                aria-label="Estilo do avatar"
              >
                {Object.entries(AVATAR_STYLES).map(([id, label]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!draft.photo && draft.style === id}
                    aria-label={label}
                    key={id}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        style: id as Profile["style"],
                        photo: null,
                      }))
                    }
                  >
                    <Avatar
                      profile={{
                        ...draft,
                        nickname: draft.nickname || "CA",
                        style: id as Profile["style"],
                        photo: null,
                      }}
                      size={43}
                    />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="avatar-options" disabled={busy || photoBusy}>
              <legend>Cor do avatar</legend>
              <div
                className="avatar-colors"
                role="radiogroup"
                aria-label="Cor do avatar"
              >
                {Object.entries(AVATAR_COLORS).map(([id, color]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.color === id}
                    aria-label={color.label}
                    key={id}
                    style={{
                      background: color.background,
                      color: color.foreground,
                    }}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        color: id as Profile["color"],
                      }))
                    }
                  >
                    {draft.color === id && <Check size={20} />}
                  </button>
                ))}
              </div>
            </fieldset>

          {draft.photo && (
            <button
              className="text-button profile-remove-photo"
              type="button"
              disabled={photoBusy || busy}
              onClick={() => setDraft((prev) => ({ ...prev, photo: null }))}
            >Remover foto</button>
          )}
          <div className="profile-editor-actions">
            {profile && (
              <button type="button" className="outline-button" disabled={busy || photoBusy} onClick={cancelEditing}>
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="primary-button form-submit"
              disabled={
                busy ||
                photoBusy ||
                checkingNick ||
                availability?.available === false
              }
            >
              <Check size={17} aria-hidden="true" />
              {busy ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      ) : (
        <>
          {account.user && stats && (
            <section className="profile-journey" aria-label="Sua trajetória">
              {[
                { label: "Treinos", value: stats.workouts, Icon: Dumbbell },
                { label: "Ofensiva", value: stats.streak, Icon: Flame },
                { label: "Recorde", value: stats.bestStreak, Icon: Trophy },
              ].map(({label, value, Icon}) => (
                <div key={label}>
                  <span><Icon size={16} aria-hidden="true" /> {label}</span>
                  <strong>{value}<small>{label === "Treinos" ? "" : value === 1 ? " dia" : " dias"}</small></strong>
                </div>
              ))}
            </section>
          )}
          {account.user && children}
        </>
      )}
      {account.error && (
        <div className="form-error" role="alert">
          {account.error}
          <button className="text-button" type="button" onClick={account.retry}>Tentar novamente</button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {account.user && (
        <button
          className="outline-button profile-signout"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await account.signOut();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Não foi possível sair. Tente novamente",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={17} /> Sair da conta
        </button>
      )}
    </div>
  );
}
