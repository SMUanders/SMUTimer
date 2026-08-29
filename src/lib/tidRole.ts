import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// Viewerens (den autentificerede brugers) rolle i SMU Tid. Bruges KUN til at afgøre,
// om leder-korrektionshandlinger VISES i frontend. Den reelle grænse er RLS owner-scope
// (smu-os-v2 migration 20260828140001): skrivning på en andens dag lykkes kun hvis
// viewer faktisk har leder/admin. Frontend simulerer aldrig at viewer er medarbejderen.

export type TidRole = "observatoer" | "medarbejder" | "leder" | "admin" | null;

/**
 * Må viewer udføre leder-korrektioner (rette/tilføje/afslutte) på en medarbejders dag?
 * - Produktion: kun `leder`/`admin`. `medarbejder` og `observatoer` = read-only her.
 * - Lokal dev (ingen Supabase/RLS): tilladt, så korrektionsflowet kan afprøves.
 * RLS forbliver den autoritative håndhævelse uanset hvad denne returnerer.
 */
export function canLeaderCorrect(args: { supabaseConfigured: boolean; role: TidRole }): boolean {
  if (!args.supabaseConfigured) return true;
  return args.role === "leder" || args.role === "admin";
}

/** Læser viewerens egen tid-rolle fra `app_adgange` via RLS (kun egen række). */
export function useTidRole(
  client: SupabaseClient | null,
  supabaseConfigured: boolean
): { role: TidRole; loading: boolean } {
  const [role, setRole] = useState<TidRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !client) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data: u } = await client.auth.getUser();
      const uid = u.user?.id;
      if (!uid) {
        if (alive) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await client
        .from("app_adgange")
        .select("rolle")
        .eq("user_id", uid)
        .eq("app", "tid")
        .eq("aktiv", true)
        .maybeSingle();
      if (alive) {
        setRole(((data as { rolle?: string } | null)?.rolle as TidRole) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, supabaseConfigured]);

  return { role, loading };
}
