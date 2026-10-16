import { useEffect, useState, type FormEvent } from "react";
import { Camera, Check, Cloud, LogOut, Smartphone } from "lucide-react";
import type { Account } from "./account";
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
}: {
  profile: Profile | null;
  account: Account;
  onSaveLocal: (profile: Profile) => void;
  onSaved: (message: string) => void;
}) {
  const [tab, setTab] = useState<"profile" | "account">("profile");
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
      if (account.user) await account.saveProfile(valid);
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
      {tab === "profile" ? (
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
                  ? "Só o perfil sincroniza. Treinos e peso ficam neste dispositivo, separados por conta."
                  : "O perfil local não cria login nem sincroniza com outros aparelhos."}
              </p>
            </form>
          )}
        </>
      ) : (
        <AccountForm account={account} onSignedIn={() => setTab("profile")} />
      )}
    </div>
  );
}

function AccountForm({
  account,
  onSignedIn,
}: {
  account: Account;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!account.configured)
    return (
      <div className="account-info">
        <Cloud size={30} />
        <h3>Cadastro online em preparação</h3>
        <p>
          O cadastro com e-mail e senha ainda não está disponível nesta versão
          publicada.
        </p>
        <p>
          Enquanto isso, personalize seu perfil na aba Meu perfil e continue
          usando o app neste dispositivo.
        </p>
      </div>
    );
  if (account.user)
    return (
      <div className="account-info">
        <Cloud size={30} />
        <h3>Conta conectada</h3>
        <p className="account-email">{account.user.email}</p>
        <p>
          Seu nick e avatar ficam na conta. Os treinos e pesos são locais e
          separados para cada usuário deste aparelho.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="outline-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await account.signOut();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={17} /> Sair da conta
        </button>
      </div>
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const signedIn = await account.signUp(email, password);
        if (signedIn) onSignedIn();
        else
          setMessage(
            "Confira seu e-mail para confirmar o cadastro. Depois volte aqui e entre na sua conta.",
          );
      } else {
        await account.signIn(email, password);
        onSignedIn();
      }
      setPassword("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="modal-description">
        {mode === "signup"
          ? "Crie sua conta para levar seu nick e avatar com você."
          : "Entre para recuperar seu perfil."}
      </p>
      <label className="form-label">
        E-mail
        <input
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="form-label">
        Senha
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          maxLength={128}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {mode === "signup" && (
        <p className="field-hint">
          Use pelo menos 8 caracteres. Após entrar, personalize seu nick e
          avatar.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="field-hint" role="status">
          {message}
        </p>
      )}
      <button className="primary-button form-submit" disabled={busy}>
        {busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
      </button>
      <button
        type="button"
        className="text-button auth-mode"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
          setMessage("");
          setPassword("");
        }}
      >
        {mode === "signup" ? "Já tenho conta" : "Quero criar uma conta"}
      </button>
      <p className="privacy-note">
        Ao entrar, você abre registros locais separados. Seus registros sem
        login continuam neste aparelho. Treinos e peso ainda não sincronizam
        entre dispositivos.
      </p>
    </form>
  );
}
