import type { TimeEntry, CurrentTask, Absence } from "../../types";

/** Resultat fra sags-søgning (OS-ejet read-contract public.tid_sag_search). */
export interface SagRef {
  sagId: string;
  smuNummer: string;
  titel: string;
  kundeNavn: string;
}

/** En aktiv enhed på en sag (OS-ejet read-contract public.tid_sag_enheder). */
export interface SagEnhed {
  enhedId: string;
  loebenummer: number;
  /** Enhedens beskrivelse (OS' `enheder.type`, fritekst — TR-089). */
  beskrivelse: string | null;
  regNr: string | null;
  stelnummer: string | null;
  trailerNr: string | null;
  interntNr: string | null;
}

// Fælles storage-interface. Al persistering går gennem dette — resten af appen
// kender ikke til om data ligger i localStorage eller Supabase.
// Alle metoder er async, så adapterne kan være netværksbaserede (Supabase).
/** Det, en medarbejder må ændre på sin egen registrering. */
export interface OwnEntryPatch {
  startTime: string;
  endTime: string;
  categoryId: string;
  subcategoryId: string | null;
  note: string;
}

/** Det, der kan rettes på et fravær. */
export type AbsencePatch = Partial<Pick<Absence, "startTime" | "expectedEnd" | "ended" | "absenceType" | "note">>;

export interface TimeEntryStore {
  readonly name: "local" | "supabase";
  getEntriesForDate(employeeId: string, isoDate: string): Promise<TimeEntry[]>;
  /** Alle medarbejderes linjer på én dato (til admin-dagsoverblik). */
  getEntriesForDateAll(isoDate: string): Promise<TimeEntry[]>;
  /** Alle medarbejderes linjer i et datointerval, inkl. begge ender (uge). */
  getEntriesInRange(fromIso: string, toIso: string): Promise<TimeEntry[]>;
  /** Alle (ikke-slettede) registreringer knyttet til én SMU-sag (sag_id), på tværs
   *  af medarbejdere og datoer. Kun autoritativ sag-reference — ingen fritekst-match. */
  getEntriesForSag(sagId: string): Promise<TimeEntry[]>;
  addEntries(entries: TimeEntry[]): Promise<void>;
  updateEntry(id: string, patch: Partial<TimeEntry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  deleteSplitGroup(splitGroupId: string): Promise<void>;
  /**
   * Erstat en registrering ATOMISK: originalen (og dens frokost-split-gruppe) markeres
   * slettet, og erstatningen indsættes — i én transaktion, ellers sker intet
   * (tid_erstat_registrering, hub-migration 20261022180000). Kaster ved fejl.
   */
  replaceEntry(id: string, replacements: TimeEntry[]): Promise<void>;
  /**
   * Medarbejderen afkorter sin EGEN, seneste registrering fra i dag (kun sluttid) —
   * atomisk med historik. `expectedEnd` = den sluttid, brugeren så (samtidige ændringer
   * afvises). Håndhæves af tid_afkort_seneste_registrering (hub-migration 20261023100000).
   */
  shortenLatestEntry(id: string, newEnd: string, expectedEnd: string): Promise<void>;
  /** Medarbejderen retter noten på sin egen registrering (tid_ret_egen_note). */
  updateOwnNote(id: string, note: string): Promise<void>;
  /**
   * Medarbejderen retter sin EGEN registrering (start, slut, aktivitet, note) — atomisk med
   * historik, overlapkontrol og samtidighedskontrol (`entry.updatedAt` = den version, brugeren
   * så). Håndhæves af tid_ret_egen_registrering (hub-migration 20261023140000).
   */
  updateOwnEntry(entry: TimeEntry, patch: OwnEntryPatch): Promise<void>;
  /** Medarbejderen sletter (blødt) sin egen registrering (tid_slet_egen_registrering). */
  deleteOwnEntry(entry: TimeEntry): Promise<void>;

  // "Aktuel opgave" — status, adskilt fra time entries (påvirker ingen tal).
  getCurrentTask(employeeId: string): Promise<CurrentTask | null>;
  getAllCurrentTasks(): Promise<CurrentTask[]>;
  setCurrentTask(task: CurrentTask): Promise<void>;
  clearCurrentTask(employeeId: string): Promise<void>;

  // "Fravær i arbejdsdagen" — delt status, adskilt fra time entries (tæller
  // aldrig som arbejdstid/pause). Kræver tabellen tid_absences (migration 0006).
  getAbsencesForDate(employeeId: string, isoDate: string): Promise<Absence[]>;
  /** Alle medarbejderes fravær på én dato (til admin-overblik). */
  getAbsencesForDateAll(isoDate: string): Promise<Absence[]>;
  /** Aktivt fravær (ude nu) for én medarbejder, hvis noget. */
  getActiveAbsence(employeeId: string): Promise<Absence | null>;
  addAbsence(absence: Absence): Promise<void>;
  /** Afslut fravær ("Jeg er tilbage"): sæt faktisk sluttid. */
  endAbsence(id: string, endTime: string): Promise<void>;
  /**
   * Ret fravær (medarbejder: eget; leder: alle — eksisterende RLS). Afvises, hvis fraværet er
   * ændret siden `absence.updatedAt` (beskyttelse mod utilsigtet overskrivning).
   */
  updateAbsence(absence: Absence, patch: AbsencePatch): Promise<void>;
  /** Slet fravær (blødt: slettet=true) — samme regler som updateAbsence. */
  deleteAbsence(absence: Absence): Promise<void>;

  // SMU-sag: søg eksisterende OS-sager via OS-ejet read-contract (tid_sag_search).
  // Kræver ingen 'os'-adgang. Local-adapter returnerer [] (ingen OS i dev).
  searchSager(query: string): Promise<SagRef[]>;

  // Enhed (TR-088): sagens aktive enheder via OS-ejet read-contract (tid_sag_enheder).
  // Kræver ingen 'os'-adgang. Local-adapter returnerer [] (ingen OS i dev).
  getSagEnheder(sagId: string): Promise<SagEnhed[]>;
}

// ID/tidsstempel — bruges når nye entries bygges. crypto.randomUUID giver et
// gyldigt uuid, så samme id kan bruges direkte i Postgres (uuid-kolonne).
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
