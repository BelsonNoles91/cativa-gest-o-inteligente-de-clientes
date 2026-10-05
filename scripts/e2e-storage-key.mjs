/** Mirrors @supabase/supabase-js default auth storage-key derivation. */
export function supabaseAuthStorageKey(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  const hostPrefix = hostname.split(".")[0];
  if (!hostPrefix) throw new Error("Supabase URL precisa conter um host.");
  return `sb-${hostPrefix}-auth-token`;
}
