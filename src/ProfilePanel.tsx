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
                  ? "Com o serviço online ativo, perfil e novos treinos sincronizam. Seu peso fica neste aparelho."
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
          Seu perfil e novos treinos podem sincronizar com o serviço online. O
          peso fica neste aparelho, separado por conta.
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
      <button
        type="button"
        className="google-signin"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            await account.signInWithGoogle();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 48 48"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.8-3.5 6.1-8.6 6.1-14.9Z"
          />
          <path
            fill="#34A853"
            d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"
          />
          <path
            fill="#FBBC05"
            d="M12.6 27.6a12.2 12.2 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"
          />
          <path
            fill="#EA4335"
            d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.6 19.6 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"
          />
        </svg>
        Continuar com Google
      </button>
      <div className="auth-divider">
        <span>ou use seu e-mail</span>
      </div>
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
        login continuam neste aparelho. Novos treinos podem sincronizar com o
        serviço online; o peso continua local.
      </p>
    </form>
  );
}
