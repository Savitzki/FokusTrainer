export { CAPIBORA } from "../supabase/functions/_shared/capibora";
/** Catalog IDs and purchase history remain untouched. Only the old brand's label changes. */
export const cosmeticDisplayName = (name: string) =>
  name === "Fokus" ? "Capibora" : name;
