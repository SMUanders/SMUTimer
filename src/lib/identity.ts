// Afgør den AUTORITATIVE medarbejder-identitet til skrivninger (tid-registreringer).
//
// Sikkerhedsregel (jf. RLS owner-scope i smu-os-v2 migration 20260828140001):
//   En almindelig medarbejder må kun skrive på sig selv. Identiteten skal komme fra den
//   autentificerede bruger (auth.uid), ALDRIG fra en dropdown/localStorage/query-param.
//
// Produktion (Supabase-auth aktiv): identitet = auth.uid. Medarbejder-vælgeren vises ikke,
//   og en evt. legacy localStorage-værdi er IKKE autoritativ (ryddes).
// Lokal dev (ingen Supabase → ingen RLS): vælger-fallback fra localStorage er tilladt.

export interface IdentityInput {
  /** Er Supabase/auth konfigureret? (produktion = true) */
  supabaseConfigured: boolean;
  /** auth.uid() for den indloggede bruger (null hvis ukendt/ikke logget ind) */
  authUserId: string | null;
  /** Legacy localStorage-værdi (smu-tid.employee) — må aldrig være autoritativ i produktion */
  legacyStored: string | null;
}

export interface IdentityResult {
  /** Autoritativ medarbejder-id til writes (null → ingen registrering mulig) */
  employeeId: string | null;
  /** Må medarbejder-vælgeren vises? (kun lokal dev) */
  pickerAllowed: boolean;
  /** Skal legacy localStorage-værdien ryddes? */
  clearLegacy: boolean;
}

export function resolveEmployeeIdentity(i: IdentityInput): IdentityResult {
  if (i.supabaseConfigured) {
    // Produktion: kun den autentificerede bruger. Ingen vælger. Legacy ryddes,
    // så gamle browserværdier aldrig kan skrive som en anden medarbejder.
    return { employeeId: i.authUserId, pickerAllowed: false, clearLegacy: true };
  }
  // Lokal dev: vælger-fallback (ingen RLS at beskytte).
  return { employeeId: i.legacyStored, pickerAllowed: true, clearLegacy: false };
}
