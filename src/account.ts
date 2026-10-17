import type { Session, Subscription } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { AccountExistsError } from "./accountErrors";
import { checkPendingWeights, clearAccountStorage } from "./accountStorage";
import { readHomeState, type HomeState } from "./homeState";
import { validateProfile, type Profile } from "./profile";
import { authRedirectUrl } from "./authRedirect";
import {
  accountConfigured,
  getBackendClient,
  googleProviderEnabled,
} from "./backend";
export { accountConfigured } from "./backend";

const clientPromise = getBackendClient();
const columns = "nickname,avatar_color,avatar_style,avatar_photo";
export type Account = ReturnType<typeof useAccount>;

const authErrorKeys = ["error", "error_code", "error_description"];
function authReturnNotice() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const params = authErrorKeys.some((key) => hash.has(key))
    ? hash
    : url.searchParams;
  if (!authErrorKeys.some((key) => params.has(key))) return "";
  if (params.get("error_code") === "otp_expired")
    return "Esse link de confirmação expirou ou já foi usado. Entre na sua conta ou use Reenviar confirmação no cadastro.";
  return params.get("error") === "access_denied"
    ? "A entrada foi cancelada. Você pode tentar novamente quando quiser."
    : "Não foi possível concluir a entrada. Tente novamente ou use e-mail e senha.";
}
function clearAuthReturnError() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasHashError = authErrorKeys.some((key) => hash.has(key));
  for (const key of authErrorKeys) {
    url.searchParams.delete(key);
    if (hasHashError) hash.delete(key);
  }
  if (hasHashError) url.hash = hash.toString();
  window.history.replaceState(window.history.state, "", url.href);
}

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(accountConfigured);
  const [remoteProfile, setRemoteProfile] = useState<{
    userId: string;
    value: Profile | null;
    error: string;
  } | null>(null);
  const profileRequest = useRef(0);
  const currentUser = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState(authReturnNotice);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!accountConfigured) return;
    let cancelled = false;
    let subscription: Subscription | null = null;
    void (async () => {
      try {
        const client = await clientPromise;
        if (!client || cancelled) return;
        let authRevision = 0;
        subscription = client.auth.onAuthStateChange((event, next) => {
          if (!cancelled) {
            authRevision++;
            if (event === "SIGNED_OUT" && currentUser.current) {
              try {
                clearAccountStorage(currentUser.current);
              } catch {
                setError(
                  "Você saiu, mas o navegador não permitiu limpar todos os dados locais.",
                );
              }
            }
            currentUser.current = next?.user.id ?? null;
            if (next && event === "SIGNED_IN") {
              setAuthNotice("");
              setError("");
            }
            setSession(next);
            setInitializing(false);
          }
        }).data.subscription;
        const revision = authRevision;
        const { data, error } = await client.auth.getSession();
        if (cancelled) return;
        // Let the SDK inspect the return URL before removing provider error details.
        if (authNotice) clearAuthReturnError();
        if (error)
          setError(
            "Não foi possível recuperar sua sessão. Tente entrar novamente.",
          );
        if (revision === authRevision) {
          currentUser.current = data.session?.user.id ?? null;
          setSession(data.session);
        }
        setInitializing(false);
      } catch {
        if (!cancelled) {
          setInitializing(false);
          setError("Não foi possível verificar a conexão da conta.");
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);
  const userId = session?.user.id ?? null;
  const profileResult = remoteProfile?.userId === userId ? remoteProfile : null;
  const profileLoading = Boolean(userId && !profileResult);
  const profileChecked = Boolean(
    userId && profileResult && !profileResult.error,
  );
  useEffect(() => {
    const request = ++profileRequest.current;
    setRemoteProfile(null);
    if (!accountConfigured || !userId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const client = await clientPromise;
        if (!client || cancelled) return;
        const { data, error } = await client
          .from("profiles")
          .select(columns)
          .eq("id", userId)
          .maybeSingle();
        if (cancelled || request !== profileRequest.current) return;
        if (error) throw error;
        setRemoteProfile({
          userId,
          error: "",
          value: data
            ? validateProfile({
                nickname: data.nickname,
                color: data.avatar_color,
                style: data.avatar_style,
                photo: data.avatar_photo,
              })
            : null,
        });
      } catch {
        if (!cancelled && request === profileRequest.current)
          setRemoteProfile({
            userId,
            value: null,
            error:
              "Não foi possível verificar seu perfil. Confira a conexão e tente novamente.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);
  async function signUp(
    email: string,
    password: string,
    homeState?: HomeState | null,
  ) {
    if (homeState != null && !readHomeState(homeState))
      throw new Error("Escolha um estado válido.");
    const client = await clientPromise;
    if (!client)
      throw new Error("Configure o Supabase para criar uma conta com e-mail.");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        ...(homeState !== undefined ? { data: { home_state: homeState } } : {}),
      },
    });
    if (
      error &&
      ["user_already_exists", "email_exists"].includes(error.code ?? "")
    )
      throw new AccountExistsError();
    if (error)
      throw new Error(
        "Não foi possível criar a conta. Verifique os dados e tente novamente em instantes.",
      );
    // Supabase can return an obfuscated existing user rather than an auth error.
    if (!data.session && data.user?.identities?.length === 0)
      throw new AccountExistsError();
    return Boolean(data.session);
  }
  async function resendConfirmation(email: string) {
    const client = await clientPromise;
    if (!client)
      throw new Error("O cadastro online ainda não está configurado.");
    const { error } = await client.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error)
      throw new Error(
        "Não foi possível reenviar agora. Aguarde um minuto e tente novamente. Se continuar, o serviço de e-mail precisa ser verificado.",
      );
  }
  async function signIn(email: string, password: string) {
    const client = await clientPromise;
    if (!client)
      throw new Error("O cadastro online ainda não está configurado.");
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error)
      throw new Error(
        "Confira e-mail e senha. Se acabou de se cadastrar, confirme seu e-mail antes de entrar.",
      );
    setAuthNotice("");
    setError("");
  }
  async function signInWithGoogle() {
    const client = await clientPromise;
    if (!client)
      throw new Error("O cadastro online ainda não está configurado.");
    let enabled: boolean;
    try {
      enabled = await googleProviderEnabled();
    } catch {
      throw new Error(
        "Não foi possível verificar o Google. Confira a conexão e tente novamente.",
      );
    }
    if (!enabled)
      throw new Error(
        "O login com Google ainda está sendo ativado. Por enquanto, entre com e-mail e senha.",
      );
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(),
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch {
      throw new Error(
        "Não foi possível abrir o Google. Confira a conexão e tente novamente. Se continuar, o login com Google precisa ser habilitado no Supabase.",
      );
    }
  }
  async function signOut() {
    const client = await clientPromise;
    if (!client) return;
    const leavingUser = userId;
    if (leavingUser) checkPendingWeights(leavingUser);
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        const { error } = await client.rpc("disable_push_device", {
          p_endpoint: subscription.endpoint,
        });
        const removed = await subscription.unsubscribe();
        if (error && !removed)
          throw new Error(
            "Não foi possível desativar os avisos deste aparelho. Confira a conexão e tente sair novamente.",
          );
      }
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new Error("Não foi possível sair da conta. Tente novamente.");
    if (leavingUser) clearAccountStorage(leavingUser);
    currentUser.current = null;
    setSession(null);
    setRemoteProfile(null);
    setAuthNotice("");
    setError("");
  }
  async function saveProfile(next: Profile, homeState?: HomeState | null) {
    if (homeState != null && !readHomeState(homeState))
      throw new Error("Escolha um estado válido.");
    const client = await clientPromise;
    const valid = validateProfile(next);
    if (!client || !userId)
      throw new Error("Entre na sua conta para sincronizar o perfil.");
    const { error } = await client.from("profiles").upsert({
      id: userId,
      nickname: valid.nickname,
      avatar_color: valid.color,
      avatar_style: valid.style,
      avatar_photo: valid.photo,
    });
    if (error)
      throw new Error(
        "Não foi possível salvar o perfil na conta. Confira se o banco foi configurado e tente novamente.",
      );
    if (currentUser.current !== userId) return;
    profileRequest.current++;
    setRemoteProfile({ userId, value: valid, error: "" });
    setError("");
    if (
      homeState !== undefined &&
      homeState !== readHomeState(session?.user.user_metadata?.home_state)
    ) {
      const { data, error } = await client.auth.updateUser({
        data: { home_state: homeState },
      });
      if (error)
        throw new Error(
          "Seu perfil foi salvo, mas não foi possível atualizar seu estado. Tente salvar novamente.",
        );
      setSession((prev) =>
        prev?.user.id === userId ? { ...prev, user: data.user } : prev,
      );
    }
  }
  return {
    configured: accountConfigured,
    initializing,
    user: session?.user ?? null,
    homeState: readHomeState(session?.user.user_metadata?.home_state),
    profile: profileResult?.value ?? null,
    profileLoading,
    profileChecked,
    profileError: profileResult?.error ?? "",
    error: profileResult?.error || error,
    authNotice,
    dismissAuthNotice: () => setAuthNotice(""),
    retry: () => setRefresh((n) => n + 1),
    signUp,
    resendConfirmation,
    signIn,
    signInWithGoogle,
    signOut,
    saveProfile,
  };
}
