import type { TimeEntryStore } from "./types";
import { localAdapter } from "./localAdapter";
import { createSupabaseAdapter } from "./supabaseAdapter";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";

export type { TimeEntryStore } from "./types";
export { newId, nowIso } from "./types";
export { isSupabaseConfigured };

// Vælger storage-backend: Supabase når konfigureret (delt klient), ellers
// local-fallback (lokal dev uden keys).

let active: TimeEntryStore = localAdapter;
let initialized = false;

/** Initialiser storage én gang ved app-start. Returnerer valgt backend. */
export async function initStore(): Promise<TimeEntryStore["name"]> {
  if (initialized) return active.name;
  initialized = true;
  const client = getSupabaseClient();
  if (client) {
    try {
      active = createSupabaseAdapter(client);
    } catch (err) {
      console.error("Supabase-init fejlede — bruger local fallback.", err);
      active = localAdapter;
    }
  }
  return active.name;
}

/** Den aktive storage-backend. Kald efter initStore(). */
export function store(): TimeEntryStore {
  return active;
}
