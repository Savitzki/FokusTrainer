import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Camera,
  Check,
  Cloud,
  Smartphone,
  LockKeyhole,
  LogOut,
} from "lucide-react";
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
  return (
    <img
      className="profile-avatar"
      data-frame={frame}
      src={avatarSource(profile)}
      width={size}
      height={size}
      alt={profile ? `Avatar de ${profile.nickname}` : "Seu avatar"}
    />
  );
}

export default function ProfilePanel({
  profile,
  account,
  onSaveLocal,
  onSaved,
  onRegistrationCompleted,
  cosmeticFrame,
  children,
  initialTab = "profile",
}: {
  profile: Profile | null;
  account: Account;
  onSaveLocal: (profile: Profile) => void;
  onSaved: (message: string) => void;
  onRegistrationCompleted?: () => void;
  cosmeticFrame?: string;
  children?: ReactNode;
  initialTab?: "profile" | "account";
}) {
  const [authOpen, setAuthOpen] = useState(initialTab === "account");
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
    <div className="profile-panel">
      <>
        <p className="account-status">
          {account.user ? <Cloud size={16} /> : <Smartphone size={16} />}
          {account.user
            ? "Perfil conectado à sua conta"
            : "Perfil deste dispositivo"}
        </p>
        {account.user ? (
          <p className="profile-account-email">{account.user.email}</p>
        ) : (
          <button className="text-button" onClick={() => setAuthOpen(true)}>
            Entrar na conta
          </button>
        )}
        {account.profileLoading ? (
          <p role="status" className="modal-description">
            Carregando seu perfil…
          </p>
        ) : account.profileError && !profile ? (
          <div className="form-error" role="alert">
            {account.profileError}
            <button className="text-button" onClick={account.retry}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={save}>
            <div className="avatar-preview">
              <Avatar
                profile={draft.nickname ? draft : { ...draft, nickname: "FT" }}
                size={88}
                frame={cosmeticFrame}
              />
              <div>
                <label className={`photo-upload ${photoBusy ? "is-busy" : ""}`}>
                  <Camera size={18} />
                  {photoBusy ? "Preparando…" : "Usar foto"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Foto do avatar"
                    disabled={photoBusy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
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
                {draft.photo && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, photo: null }))
                    }
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
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
                "3–24 letras, números, ponto, hífen ou _ · Único e permanente depois de salvar"
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
            <fieldset className="avatar-options">
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
                        nickname: draft.nickname || "FT",
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
            <fieldset className="avatar-options">
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
            {account.error && (
              <div className="form-error" role="alert">
                {account.error}
                <button
                  className="text-button"
                  type="button"
                  onClick={account.retry}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
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
              {busy ? "Salvando…" : "Salvar perfil"}
            </button>
            <p className="privacy-note">
              {account.user
                ? "Perfil, treinos e pesos sincronizam com a conta quando conectado."
                : "O perfil local não cria login nem sincroniza com outros aparelhos."}
            </p>
          </form>
        )}
      </>
      {account.user && children}
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
