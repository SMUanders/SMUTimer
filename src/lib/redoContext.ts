// "Omgøring" — lokal sessionstilstand (per enhed, IKKE database).
//
// Når en medarbejder laver noget om, huskes den oprindelige aktive opgave her
// (så den kan genoptages bagefter) sammen med den valgte årsag. Selve
// omgøringen kører som aktiv opgave i tid_current_tasks, og den gemte
// historik-linje markeres med de EKSISTERENDE felter isRedo/redoReason (ingen
// DB-ændring, intet note-hack). Samme mønster som helpContext/currentTaskStart.

import type { OwnTask } from "./helpContext";

const KEY = "smu-tid.redo-context.v1";

export interface RedoContext {
  /** Oprindelig opgave der genoptages efter omgøring. null = SELVSTÆNDIG omgøring
   *  (startet fra "Hvad nu?" uden aktiv opgave) → ingen auto-genoptagelse. */
  ownTask: OwnTask | null;
  reason: string; // REDO_REASONS-id
  note: string; // valgfri omgørings-note (redoNote)
}

type Store = Record<string, RedoContext>;

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

/** Er der en aktiv omgøring? Returnér oprindelig opgave + årsag. */
export function getRedo(employeeId: string): RedoContext | null {
  return read()[employeeId] ?? null;
}

/** Start en omgøring: husk oprindelig opgave + årsag. */
export function setRedo(employeeId: string, ctx: RedoContext): void {
  const s = read();
  s[employeeId] = ctx;
  write(s);
}

/** Ryd omgøring (efter genoptag eller "Hvad nu?"). */
export function clearRedo(employeeId: string): void {
  const s = read();
  delete s[employeeId];
  write(s);
}
