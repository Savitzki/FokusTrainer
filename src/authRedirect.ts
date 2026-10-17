// A fixed production URL prevents preview/local addresses entering confirmation
// emails. Supabase must also allow this exact URL in its Auth configuration.
export function authRedirectUrl() {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  return configured || new URL(".", window.location.href).href;
}
