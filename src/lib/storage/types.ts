import type { TimeEntry } from "../../types";

// Fælles storage-interface. Al persistering går gennem dette — resten af appen
// kender ikke til om data ligger i localStorage eller Supabase.
// Alle metoder er async, så adapterne kan være netværksbaserede (Supabase).
export interface TimeEntryStore {
  readonly name: "local" | "supabase";
  getEntriesForDate(employeeId: string, isoDate: string): Promise<TimeEntry[]>;
  /** Alle medarbejderes linjer på én dato (til admin-dagsoverblik). */
  getEntriesForDateAll(isoDate: string): Promise<TimeEntry[]>;
  /** Alle medarbejderes linjer i et datointerval, inkl. begge ender (uge). */
  getEntriesInRange(fromIso: string, toIso: string): Promise<TimeEntry[]>;
  addEntries(entries: TimeEntry[]): Promise<void>;
  updateEntry(id: string, patch: Partial<TimeEntry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  deleteSplitGroup(splitGroupId: string): Promise<void>;
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
