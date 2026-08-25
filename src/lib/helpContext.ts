// "Hjælp på anden opgave" — lokal sessionstilstand (per enhed, IKKE database).
//
// Når en medarbejder midlertidigt hjælper på en anden opgave, huskes den EGNE
// aktive opgave her, så den kan genoptages bagefter. Selve hjælp-opgaven ligger
// (som al aktiv opgave) i tid_current_tasks. Denne fil gemmer KUN "hvad skal jeg
// tilbage til". Ingen DB-ændring, ingen migration — samme mønster som
// currentTaskStart/dayEnded (localStorage).

const KEY = "smu-tid.help-context.v1";

// Note på en hjælp-historiklinje, så Min dag kan vise "Hjælp på anden opgave".
export const HELP_NOTE = "Hjælp på anden opgave";

export interface OwnTask {
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string;
  note: string;
}

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

/** Er der en aktiv hjælp-session? Returnér den egne opgave der kan genoptages. */
export function getHelp(employeeId: string): OwnTask | null {
  return read()[employeeId]?.ownTask ?? null;
}

/** Start en hjælp-session: husk den egne opgave. */
export function setHelp(employeeId: string, ownTask: OwnTask): void {
  const s = read();
  s[employeeId] = { ownTask };
  write(s);
}

/** Ryd hjælp-session (efter genoptag eller "Hvad nu?"). */
export function clearHelp(employeeId: string): void {
  const s = read();
  delete s[employeeId];
  write(s);
}

/** Markér en historiklinjes note som en hjælp-linje (bevarer evt. egen note). */
export function helpNote(userNote: string): string {
  const n = userNote.trim();
  return n ? `${HELP_NOTE} — ${n}` : HELP_NOTE;
}

/** Er en historiklinjes note en hjælp-linje? (til Min dag-visning). */
export function isHelpNote(note: string | null | undefined): boolean {
  return !!note && note.startsWith(HELP_NOTE);
}
