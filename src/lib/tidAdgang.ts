import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// App-adgangs-gate for SMU Tid. Et Hub-login giver ikke i sig selv adgang til
// Tid — det afgør `app_adgange` via `har_app_adgang('tid')` (samme RPC som RLS
// bruger, inkl. krav om aktiv profil og global super-admin-bypass — en deaktiveret
// konto afvises derfor også her; den kan ikke læse sin egen profil). Gaten
// ændrer ikke Tids rollemodel: hvem der må registrere/rette timer, afgøres
// fortsat af `useTidRole` + RLS.

export type TidAdgangTilstand =
  | "aaben" // lokal dev uden Supabase — appen forbliver åben (local fallback)
  | "indlaeser"
  | "login"
  | "adgang"
  | "ingen_adgang"
  | "fejl";

export interface TidAdgangSvar {
  harAdgang: boolean;
  fejl: string | null;
}

/** Ren afgørelse — ingen I/O. Fail-closed: alt andet end et eksplicit `true` afviser. */
export function afgoerTidAdgang(args: {
  supabaseConfigured: boolean;
  authLoading: boolean;
  harSession: boolean;
  svar: TidAdgangSvar | null;
}): TidAdgangTilstand {
  if (!args.supabaseConfigured) return "aaben";
  if (args.authLoading) return "indlaeser";
  if (!args.harSession) return "login";
  if (!args.svar) return "indlaeser";
  if (args.svar.fejl) return "fejl";
  return args.svar.harAdgang ? "adgang" : "ingen_adgang";
}

/** Henter Tid-adgang for den indloggede bruger. Svaret er bundet til bruger-id'et. */
export function useTidAdgang(
  client: SupabaseClient | null,
  userId: string | null
): TidAdgangSvar | null {
  const [data, setData] = useState<{ forBruger: string; svar: TidAdgangSvar } | null>(null);

  useEffect(() => {
    if (!client || !userId) return;
    let alive = true;
    (async () => {
      const adgang = await client.rpc("har_app_adgang", { _app: "tid" });
      if (!alive) return;
      setData({
        forBruger: userId,
        svar: {
          harAdgang: !adgang.error && adgang.data === true,
          fejl: adgang.error ? adgang.error.message : null,
        },
      });
    })();
    return () => {
      alive = false;
    };
  }, [client, userId]);

  return data && data.forBruger === userId ? data.svar : null;
}
