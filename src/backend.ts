const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
export const accountConfigured = Boolean(url && key);
const clientPromise = accountConfigured
  ? import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, key),
    )
  : Promise.resolve(null);
export const getBackendClient = () => clientPromise;

export async function googleProviderEnabled(): Promise<boolean> {
  if (!accountConfigured) return false;
  const response = await fetch(
    new URL("auth/v1/settings", `${url.replace(/\/+$/, "")}/`),
    {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw new Error("Não foi possível verificar o login Google.");
  const settings = await response.json();
  return settings.external?.google === true;
}

export async function backendRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const client = await clientPromise;
  if (!client) throw new Error("O serviço online ainda não foi configurado.");
  const { data, error } = await client.rpc(name, args);
  if (error)
    throw new Error(
      error.code === "P0001"
        ? error.message
        : "Não foi possível conectar. Confira a internet e a configuração do banco.",
    );
  return data as T;
}
