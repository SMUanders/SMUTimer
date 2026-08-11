// Medarbejdere = den DELTE profiler-tabel (SMU-standard). Ingen egen liste.
// Læses via den delte Supabase-klient; cached efter første load.

import { getSupabaseClient } from "./supabaseClient";

export interface Person {
  id: string; // = profiler.id = auth.users.id
  name: string;
}

// Vis-navn: 'nt' -> Natasha (undtagelse), ellers stort forbogstav.
function displayName(fuldtNavn: string | null): string {
  const n = (fuldtNavn ?? "").trim();
  if (n.toLowerCase() === "nt") return "Natasha";
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}

// Ikke-personer der ikke skal vises i vælgeren.
const EXCLUDE = new Set(["info"]);

// Dev-fallback når Supabase ikke er konfigureret (lokal udvikling uden keys).
const DEV_PEOPLE: Person[] = [
  "Anders", "Natasha", "Henriette", "Ida", "Marie",
  "Andreas", "Sascha", "Ina", "Lissy", "Dana",
].map((name) => ({ id: name.toLowerCase(), name }));

let _people: Person[] = [];
let _loaded = false;

export async function loadPeople(): Promise<Person[]> {
  const client = getSupabaseClient();
  if (!client) {
    _people = DEV_PEOPLE;
    _loaded = true;
    return _people;
  }
  const { data, error } = await client
    .from("profiler")
    .select("id, fuldt_navn, aktiv")
    .eq("aktiv", true);
  if (error) {
    console.error("Kunne ikke hente profiler:", error.message);
    _loaded = true;
    return _people;
  }
  _people = (data as { id: string; fuldt_navn: string | null }[])
    .filter((p) => !EXCLUDE.has((p.fuldt_navn ?? "").trim().toLowerCase()))
    .map((p) => ({ id: p.id, name: displayName(p.fuldt_navn) }))
    .sort((a, b) => a.name.localeCompare(b.name, "da"));
  _loaded = true;
  return _people;
}

export function people(): Person[] {
  return _people;
}
export function isPeopleLoaded(): boolean {
  return _loaded;
}
export function getPerson(id: string | null): Person | undefined {
  if (!id) return undefined;
  return _people.find((p) => p.id === id);
}
export function getPersonName(id: string | null): string {
  return getPerson(id)?.name ?? "";
}
