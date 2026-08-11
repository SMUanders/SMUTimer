import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ÉN delt Supabase-klient til både auth og data, så login-sessionen (JWT) følger
// automatisk med på alle data-kald. Uden dette ville de stramme RLS-policies
// afvise data-kaldene.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true når begge env-variabler er sat (dvs. deployet beta). */
export const isSupabaseConfigured = Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

/** Den delte klient, eller null hvis Supabase ikke er konfigureret (lokal dev). */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}
