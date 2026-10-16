import type { Session, Subscription } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { validateProfile, type Profile } from "./profile";
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
    value: Profile;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
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
        subscription = client.auth.onAuthStateChange((_event, next) => {
          if (!cancelled) {
            setSession(next);
            setInitializing(false);
          }
        }).data.subscription;
        const { data, error } = await client.auth.getSession();
        if (cancelled) return;
        // Let the SDK inspect the return URL before removing provider error details.
        if (authNotice) clearAuthReturnError();
        if (error)
          setError(
            "Não foi possível recuperar sua sessão. Tente entrar novamente.",
          );
        setSession(data.session);
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
  useEffect(() => {
    setRemoteProfile(null);
    setError("");
    if (!accountConfigured || !userId) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const client = await clientPromise;
        if (!client || cancelled) return;
        const { data, error } = await client
          .from("profiles")
          .select(columns)
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data)
          setRemoteProfile({
            userId,
            value: validateProfile({
              nickname: data.nickname,
              color: data.avatar_color,
              style: data.avatar_style,
              photo: data.avatar_photo,
            }),
          });
      } catch {
        if (!cancelled)
          setError(
            "Não foi possível carregar o perfil da conta. Confira a conexão e tente novamente.",
          );
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);
  async function signUp(email: string, password: string) {
    const client = await clientPromise;
    if (!client)
      throw new Error("Configure o Supabase para criar uma conta com e-mail.");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: new URL(".", window.location.href).href },
    });
    if (error)
      throw new Error(
        "Não foi possível criar a conta. Verifique os dados e tente novamente em instantes.",
      );
    return Boolean(data.session);
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
          redirectTo: new URL(".", window.location.href).href,
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
  }
  async function saveProfile(next: Profile) {
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
    setRemoteProfile({ userId, value: valid });
    setError("");
  }
  return {
    configured: accountConfigured,
    initializing,
    user: session?.user ?? null,
    profile: remoteProfile?.userId === userId ? remoteProfile.value : null,
    profileLoading,
    error,
    authNotice,
    dismissAuthNotice: () => setAuthNotice(""),
    retry: () => setRefresh((n) => n + 1),
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    saveProfile,
  };
}
