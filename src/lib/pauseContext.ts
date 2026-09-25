// "Pause fra aktiv opgave" — lokal sessionstilstand (per enhed, IKKE database).
//
// Når en medarbejder holder pause MENS en normal opgave er aktiv, huskes den
// oprindelige opgave her, så den kan genoptages automatisk når pausen slutter.
// Selve pausen ligger (som al aktiv status) i tid_current_tasks. Denne fil gemmer
// KUN "hvad skal jeg tilbage til". Ingen DB-ændring, ingen migration — nøjagtig
// samme mønster som helpContext/redoContext (localStorage).
//
// Pause startet fra "Hvad nu?" (uden underliggende opgave) sætter INGEN kontekst
// her → efter pausen går man tilbage til "Hvad nu?" (standalone), som hidtil.

import type { OwnTask } from "./helpContext";

const KEY = "smu-tid.pause-context.v1";

type Store = Record<string, { ownTask: OwnTask }>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}
function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignorér (privat browsing o.l.) */
  }
}

/** Er der en opgave der skal genoptages efter pausen? Returnér den, ellers null. */
export function getPause(employeeId: string): OwnTask | null {
  return read()[employeeId]?.ownTask ?? null;
}

/** Start pause fra en aktiv opgave: husk den oprindelige opgave til genoptag. */
export function setPause(employeeId: string, ownTask: OwnTask): void {
  const s = read();
  s[employeeId] = { ownTask };
  write(s);
}

/** Ryd pause-kontekst (efter genoptag, eller når pausen var standalone). */
export function clearPause(employeeId: string): void {
  const s = read();
  delete s[employeeId];
  write(s);
}
