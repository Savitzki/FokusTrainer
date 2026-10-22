import type { Session, Subscription } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { accountAuthError } from "./accountErrors";
import {
  accountStorageGeneration,
  checkPendingWeights,
  clearAccountStorage,
} from "./accountStorage";
import {
  readPhrasePreferences,
  validatePhrasePreferences,
  type PhrasePreferences,
} from "./phrasePreferences";
import { normalizeNickname, validateProfile, type Profile } from "./profile";
import {
  isEmailAddress,
  isNickname,
  NicknameConflictError,
  readNicknameAvailability,
} from "./nickname";
import { authRedirectUrl } from "./authRedirect";
import {
  accountConfigured,
  backendRpc,
  getBackendClient,
  googleProviderEnabled,
  requestNicknameSession,
} from "./backend";
import { useSyncedResource } from "./useSyncedResource";
import { invalidateSync, withSync, withSyncTimeout } from "./sync";
import { STORAGE_KEY } from "./model";
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
  const currentUser = useRef<string | null>(null);
  const metadataRevision = useRef(0);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState(authReturnNotice);
  useEffect(() => {
    if (!accountConfigured) return;
    let cancelled = false;
    let subscription: Subscription | null = null;
    void (async () => {
      try {
        const client = await withSyncTimeout(clientPromise);
        if (!client || cancelled) return;
        let authRevision = 0;
        subscription = client.auth.onAuthStateChange((event, next) => {
          if (!cancelled) {
            metadataRevision.current++;
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
        const { data, error } = await withSyncTimeout(client.auth.getSession());
        if (cancelled) return;
        // Let the SDK inspect the return URL before removing provider error details.
        if (authNotice) clearAuthReturnError();
        if (error && revision === authRevision)
          setError(
            "Não foi possível recuperar sua sessão. Tente entrar novamente.",
          );
        if (revision === authRevision) {
          currentUser.current = data.session?.user.id ?? null;
          setSession(data.session);
        }
        setInitializing(false);
      } catch {
        if (!cancelled && !currentUser.current) {
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
  const profileResource = useSyncedResource<Profile | null>({
    userId,
    resource: "profile",
    queryKey: "profile",
    enabled: Boolean(accountConfigured && userId),
    cacheKey: userId ? `${STORAGE_KEY}:account:${userId}:profile` : undefined,
    parse: (value) => (value === null ? null : validateProfile(value)),
    read: async () => {
      const generation = accountStorageGeneration(userId!);
      const client = await clientPromise;
      if (!client)
        throw new Error("O serviço online ainda não foi configurado");
      const { data, error } = await client
        .from("profiles")
        .select(columns)
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      // Metadata is secondary: it must not delay initial profile availability.
      const revision = metadataRevision.current;
      if (typeof client.auth.getUser === "function")
        void withSyncTimeout(client.auth.getUser())
          .then(({ data, error }) => {
            if (
              !error &&
              data.user &&
              currentUser.current === userId &&
              generation === accountStorageGeneration(userId!) &&
              revision === metadataRevision.current &&
              profileResource.isCurrent()
            )
              setSession((previous) =>
                previous?.user.id === userId &&
                (JSON.stringify(previous.user.user_metadata) !==
                  JSON.stringify(data.user.user_metadata) ||
                  previous.user.email_confirmed_at !==
                    data.user.email_confirmed_at)
                  ? { ...previous, user: data.user }
                  : previous,
              );
          })
          .catch(() => {});
      return data
        ? validateProfile({
            nickname: data.nickname,
            color: data.avatar_color,
            style: data.avatar_style,
            photo: data.avatar_photo,
          })
        : null;
    },
  });
  const profileLoading = profileResource.sync.initialLoading;
  const profileChecked = Boolean(
    userId && (profileResource.state || profileResource.sync.lastSuccess > 0),
  );
  const profileResult = userId
    ? { userId, value: profileResource.state, error: profileResource.error }
    : null;
  async function signUp(
    email: string,
    password: string,
    phrasePreferences?: PhrasePreferences,
  ) {
    const preferences = phrasePreferences
      ? validatePhrasePreferences(phrasePreferences)
      : null;
    const client = await clientPromise;
    if (!client)
      throw new Error("Configure o Supabase para criar uma conta com e-mail.");
    const { data, error } = await client.auth
      .signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          ...(preferences
            ? {
                data: {
                  display_name: preferences.displayName,
                  phrase_treatment: preferences.treatment,
                },
              }
            : {}),
        },
      })
      .catch((error: unknown) => {
        throw accountAuthError(error, "signup");
      });
    if (error) throw accountAuthError(error, "signup");
    // Obfuscated existing users follow the same pending-confirmation flow.
    return Boolean(data.session);
  }
  async function resendConfirmation(email: string) {
    const client = await clientPromise;
    if (!client)
      throw new Error("O cadastro online ainda não está configurado.");
    const { error } = await client.auth
      .resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authRedirectUrl() },
      })
      .catch((error: unknown) => {
        throw accountAuthError(error, "resend");
      });
    if (error) throw accountAuthError(error, "resend");
  }
  async function signIn(identifier: string, password: string) {
    const client = await clientPromise;
    if (!client)
      throw new Error("O cadastro online ainda não está configurado.");
    let error;
    try {
      if (isEmailAddress(identifier)) {
        ({ error } = await client.auth.signInWithPassword({
          email: identifier.trim(),
          password,
        }));
      } else {
        if (!isNickname(identifier)) throw new Error("Invalid nickname");
        const tokens = await requestNicknameSession(
          normalizeNickname(identifier),
          password,
        );
        ({ error } = await client.auth.setSession(tokens));
      }
    } catch (failure) {
      throw accountAuthError(failure, "signin");
    }
    if (error) throw accountAuthError(error, "signin");
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
    setAuthNotice("");
    setError("");
  }
  async function saveProfile(
    next: Profile,
    phrasePreferences?: PhrasePreferences,
  ) {
    const generation = userId ? accountStorageGeneration(userId) : -1;
    const preferences = phrasePreferences
      ? validatePhrasePreferences(phrasePreferences)
      : null;
    const client = await clientPromise;
    const valid = validateProfile(next);
    if (!client || !userId)
      throw new Error("Entre na sua conta para sincronizar o perfil.");
    if (profileResult?.value && valid.nickname !== profileResult.value.nickname)
      throw new Error("Seu nick é permanente e não pode ser alterado.");
    const { error } = await withSyncTimeout(
      client.from("profiles").upsert({
        id: userId,
        nickname: valid.nickname,
        avatar_color: valid.color,
        avatar_style: valid.style,
        avatar_photo: valid.photo,
      }),
    );
    if (error?.code === "23505") {
      let suggestions: string[] = [];
      try {
        suggestions = readNicknameAvailability(
          await backendRpc("check_nickname", { p_nickname: valid.nickname }),
        ).suggestions;
      } catch {
        /* The unique constraint is still authoritative. */
      }
      throw new NicknameConflictError(suggestions);
    }
    if (error?.code === "P0001")
      throw new Error("Seu nick é permanente e não pode ser alterado.");
    if (error)
      throw new Error(
        "Não foi possível salvar o perfil na conta. Confira se o banco foi configurado e tente novamente.",
      );
    if (
      currentUser.current !== userId ||
      generation !== accountStorageGeneration(userId)
    )
      return;
    profileResource.publish(valid);
    invalidateSync(userId, ["profile"], true, "profile");
    setError("");
    const previousPreferences = readPhrasePreferences(
      session?.user.user_metadata,
    );
    if (
      preferences &&
      (preferences.displayName !== previousPreferences.displayName ||
        preferences.treatment !== previousPreferences.treatment)
    ) {
      metadataRevision.current++;
      const { data, error } = await withSyncTimeout(
        client.auth.updateUser({
          data: {
            ...(preferences
              ? {
                  display_name: preferences.displayName,
                  phrase_treatment: preferences.treatment,
                }
              : {}),
          },
        }),
      ).catch(() => {
        throw new Error(
          "Seu perfil foi salvo, mas não foi possível atualizar as preferências das frases. Tente salvar novamente.",
        );
      });
      if (error)
        throw new Error(
          "Seu perfil foi salvo, mas não foi possível atualizar as preferências das frases. Tente salvar novamente.",
        );
      if (
        currentUser.current !== userId ||
        generation !== accountStorageGeneration(userId)
      )
        return;
      setSession((prev) =>
        prev?.user.id === userId ? { ...prev, user: data.user } : prev,
      );
    }
  }
  return withSync(
    {
      configured: accountConfigured,
      initializing,
      user: session?.user ?? null,
      phrasePreferences: readPhrasePreferences(session?.user.user_metadata),
      profile: profileResult?.value ?? null,
      profileLoading,
      profileChecked,
      profileError: profileResult?.error
        ? `Não foi possível verificar seu perfil. ${profileResult.error}`
        : "",
      error: profileResult?.error || error,
      authNotice,
      dismissAuthNotice: () => setAuthNotice(""),
      retry: profileResource.refresh,
      checkNickname: async (nickname: string) =>
        readNicknameAvailability(
          await backendRpc("check_nickname", {
            p_nickname: normalizeNickname(nickname),
          }),
        ),
      signUp,
      resendConfirmation,
      signIn,
      signInWithGoogle,
      signOut,
      saveProfile,
    },
    profileResource.sync,
  );
}
