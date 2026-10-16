import type { Session, Subscription } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { validateProfile, type Profile } from "./profile";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
export const accountConfigured = Boolean(url && key);
const clientPromise = accountConfigured
  ? import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, key),
    )
  : Promise.resolve(null);
const columns = "nickname,avatar_color,avatar_style,avatar_photo";
export type Account = ReturnType<typeof useAccount>;

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(accountConfigured);
  const [remoteProfile, setRemoteProfile] = useState<{
    userId: string;
    value: Profile;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
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
  async function signOut() {
    const client = await clientPromise;
    if (!client) return;
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
    retry: () => setRefresh((n) => n + 1),
    signUp,
    signIn,
    signOut,
    saveProfile,
  };
}
