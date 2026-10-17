import { useEffect, useState, type FormEvent } from "react";
import { Camera, Check, Cloud, Settings, Smartphone } from "lucide-react";
import AppearanceSettings from "./AppearanceSettings";
import type { Account } from "./account";
import AccountForm from "./AccountForm";
import HomeStateSelect from "./HomeStateSelect";
import PhrasePreferencesFields from "./PhrasePreferencesFields";
import { defaultPhrasePreferences } from "./phrasePreferences";
import { readHomeState } from "./homeState";
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
}: {
  profile: Profile | null;
  size?: number;
}) {
  return (
    <img
      className="profile-avatar"
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
  initialTab = "profile",
}: {
  profile: Profile | null;
  account: Account;
  onSaveLocal: (profile: Profile) => void;
  onSaved: (message: string) => void;
  initialTab?: "profile" | "account";
}) {
  const [tab, setTab] = useState<"profile" | "account" | "settings">(
    initialTab,
  );
  const [homeState, setHomeState] = useState(account.homeState ?? "general");
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
  useEffect(
    () => setHomeState(account.homeState ?? "general"),
    [account.homeState],
  );
  const [draft, setDraft] = useState<Profile>(() => profile ?? blankProfile());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
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
        nickname: normalizeNickname(draft.nickname),
      });
      if (account.user)
        await account.saveProfile(
          valid,
          readHomeState(homeState),
          phrasePreferences,
        );
      else onSaveLocal(valid);
      onSaved(
        account.user
          ? "Perfil salvo na sua conta."
          : "Perfil salvo neste dispositivo.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-panel">
      <div className="profile-navigation">
        <div className="segmented-control" aria-label="Opções do perfil">
          <button
            aria-pressed={tab === "profile"}
            onClick={() => setTab("profile")}
          >
            Meu perfil
          </button>
          <button
            aria-pressed={tab === "account"}
            onClick={() => setTab("account")}
          >
            {account.user ? "Minha conta" : "Cadastro / entrar"}
          </button>
        </div>
        <button
          className="icon-button settings-button"
          aria-label="Configurações"
          title="Configurações"
          aria-pressed={tab === "settings"}
          onClick={() => setTab("settings")}
        >
          <Settings size={21} />
        </button>
      </div>
      {tab === "settings" ? (
        <AppearanceSettings onBack={() => setTab("profile")} />
      ) : tab === "profile" ? (
        <>
          <p className="account-status">
            {account.user ? <Cloud size={16} /> : <Smartphone size={16} />}
            {account.user
              ? "Perfil conectado à sua conta"
              : "Perfil deste dispositivo"}
          </p>
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
                  profile={
                    draft.nickname ? draft : { ...draft, nickname: "FT" }
                  }
                  size={88}
                />
                <div>
                  <label
                    className={`photo-upload ${photoBusy ? "is-busy" : ""}`}
                  >
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
                  value={draft.nickname}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      nickname: event.target.value,
                    }))
                  }
                />
              </label>
              {account.user && (
                <>
                  <PhrasePreferencesFields
                    value={phrasePreferences}
                    onChange={setPhrasePreferences}
                  />
                  <HomeStateSelect value={homeState} onChange={setHomeState} />
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
                disabled={busy || photoBusy}
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
      ) : (
        <AccountForm
          account={account}
          profile={profile}
          onSignedIn={() => setTab("profile")}
        />
      )}
    </div>
  );
}
