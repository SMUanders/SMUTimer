import type { TimeEntryStore } from "./types";
import { localAdapter } from "./localAdapter";

export type { TimeEntryStore } from "./types";
export { newId, nowIso } from "./types";

// Vælger storage-backend: Supabase når credentials findes, ellers local-fallback.
// Supabase-adapteren (og supabase-js) importeres dynamisk, så den kun kommer med
// i bundlet når den faktisk bruges.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// MIDLERTIDIG DEBUG (fjernes efter Netlify-env er bekræftet):
// viser om env-variablerne er bagt ind i buildet — UDEN at afsløre keyen.
export function envDebug() {
  return {
    hasUrl: Boolean(SUPABASE_URL),
    hasKey: Boolean(SUPABASE_ANON_KEY),
    urlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null, // host er ikke hemmelig
  };
}

let active: TimeEntryStore = localAdapter;
let initialized = false;

/** Initialiser storage én gang ved app-start. Returnerer valgt backend. */
export async function initStore(): Promise<TimeEntryStore["name"]> {
  if (initialized) return active.name;
  initialized = true;
  if (isSupabaseConfigured()) {
    try {
      const { createSupabaseAdapter } = await import("./supabaseAdapter");
      active = createSupabaseAdapter(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    } catch (err) {
      // Falder tilbage til local hvis Supabase ikke kan initialiseres.
      console.error("Supabase-init fejlede — bruger local fallback.", err);
      active = localAdapter;
    }
  }
  // MIDLERTIDIG DEBUG (fjernes efter Netlify-env er bekræftet):
  const dbg = envDebug();
  console.info(
    `[SMU Tid] backend=${active.name} · VITE_SUPABASE_URL present=${dbg.hasUrl} · VITE_SUPABASE_ANON_KEY present=${dbg.hasKey}` +
      (dbg.urlHost ? ` · host=${dbg.urlHost}` : "")
  );
  return active.name;
}

/** Den aktive storage-backend. Kald efter initStore(). */
export function store(): TimeEntryStore {
  return active;
}
