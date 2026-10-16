const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
export const accountConfigured = Boolean(url && key);
const clientPromise = accountConfigured
  ? import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, key),
    )
  : Promise.resolve(null);
export const getBackendClient = () => clientPromise;

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
