import type { TimeEntry, CurrentTask, Absence } from "../../types";
import type { TimeEntryStore } from "./types";
import { nowIso, newId } from "./types";

const ABSENCES_KEY = "smu-tid.absences.v1";
function loadAbsences(): Absence[] {
  try {
    const raw = localStorage.getItem(ABSENCES_KEY);
    return raw ? (JSON.parse(raw) as Absence[]) : [];
  } catch {
    return [];
  }
}
function saveAbsences(a: Absence[]): void {
  localStorage.setItem(ABSENCES_KEY, JSON.stringify(a));
}

const TASKS_KEY = "smu-tid.current-tasks.v1";
function loadTasks(): CurrentTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? (JSON.parse(raw) as CurrentTask[]) : [];
  } catch {
    return [];
  }
}
function saveTasks(t: CurrentTask[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(t));
}

// Midlertidig dev-fallback: gemmer i browserens localStorage.
// Bruges KUN indtil Supabase-credentials er sat (se index.ts). Ikke den
// endelige løsning — samme interface som Supabase-adapteren.

const STORAGE_KEY = "smu-tid.entries.v1";

function loadAll(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TimeEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: TimeEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const localAdapter: TimeEntryStore = {
  name: "local",

  async getEntriesForDate(employeeId, isoDate) {
    return loadAll()
      .filter((e) => !e.slettet && e.employeeId === employeeId && e.workDate === isoDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  async getEntriesForDateAll(isoDate) {
    return loadAll().filter((e) => !e.slettet && e.workDate === isoDate);
  },

  async getEntriesInRange(fromIso, toIso) {
    // ISO-datoer sammenlignes korrekt som strenge.
    return loadAll().filter(
      (e) => !e.slettet && e.workDate >= fromIso && e.workDate <= toIso
    );
  },

  async getEntriesForSag(sagId) {
    return loadAll().filter((e) => !e.slettet && e.sagId === sagId);
  },

  async addEntries(newEntries) {
    const all = loadAll();
    all.push(...newEntries);
    saveAll(all);
  },

  async updateEntry(id, patch) {
    const all = loadAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch, id, updatedAt: nowIso() };
    saveAll(all);
  },

  // Soft-delete: markér slettet i stedet for at fjerne.
  async deleteEntry(id) {
    const all = loadAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], slettet: true, updatedAt: nowIso() };
    saveAll(all);
  },

  // Lokal dev-fallback: én synkron læs-ændr-skriv af hele listen = reelt atomisk.
  async replaceEntry(id, replacements) {
    const all = loadAll();
    const old = all.find((e) => e.id === id && !e.slettet);
    if (!old) throw new Error("Registreringen findes ikke eller er allerede ændret");
    const now = nowIso();
    const marked = all.map((e) =>
      e.id === id || (old.splitGroupId && e.splitGroupId === old.splitGroupId)
        ? { ...e, slettet: true, updatedAt: now }
        : e
    );
    saveAll([...marked, ...replacements]);
  },

  // Lokal dev-fallback for afkortning: samme afgrænsning som databasefunktionen
  // (seneste, ikke split, kun kortere, uændret siden brugeren så den), med historik.
  async shortenLatestEntry(id, newEnd, expectedEnd) {
    const all = loadAll();
    const r = all.find((e) => e.id === id && !e.slettet);
    if (!r) throw new Error("Registreringen findes ikke eller er allerede ændret");
    if (r.endTime !== expectedEnd) throw new Error("Registreringen er ændret i mellemtiden");
    if (r.splitGroupId) throw new Error("En registrering delt omkring frokost kan ikke afkortes her");
    const senere = all.some(
      (e) => !e.slettet && e.id !== r.id && e.employeeId === r.employeeId && e.workDate === r.workDate && e.endTime > r.endTime
    );
    if (senere) throw new Error("Kun dagens seneste registrering kan afkortes");
    if (!(newEnd > r.startTime && newEnd < r.endTime)) throw new Error("Ny sluttid skal ligge efter start og før nuværende slut");
    const now = nowIso();
    const [sh, sm] = r.startTime.split(":").map(Number);
    const [eh, em] = newEnd.split(":").map(Number);
    const kopi = { ...r, id: newId(), endTime: newEnd, durationMinutes: eh * 60 + em - (sh * 60 + sm), createdAt: now, updatedAt: now };
    saveAll([...all.map((e) => (e.id === id ? { ...e, slettet: true, updatedAt: now } : e)), kopi]);
  },

  async updateOwnNote(id, note) {
    const all = loadAll();
    const idx = all.findIndex((e) => e.id === id && !e.slettet);
    if (idx === -1) throw new Error("Registreringen findes ikke eller er slettet");
    all[idx] = { ...all[idx], note, updatedAt: nowIso() };
    saveAll(all);
  },

  async deleteSplitGroup(splitGroupId) {
    const all = loadAll();
    let changed = false;
    for (let i = 0; i < all.length; i++) {
      if (all[i].splitGroupId === splitGroupId) {
        all[i] = { ...all[i], slettet: true, updatedAt: nowIso() };
        changed = true;
      }
    }
    if (changed) saveAll(all);
  },

  // ---- Aktuel opgave ----
  async getCurrentTask(employeeId) {
    return loadTasks().find((t) => t.employeeId === employeeId) ?? null;
  },

  async getAllCurrentTasks() {
    return loadTasks();
  },

  async setCurrentTask(task) {
    const all = loadTasks().filter((t) => t.employeeId !== task.employeeId);
    all.push({ ...task, updatedAt: nowIso() });
    saveTasks(all);
  },

  async clearCurrentTask(employeeId) {
    saveTasks(loadTasks().filter((t) => t.employeeId !== employeeId));
  },

  // ---- Fravær ----
  async getAbsencesForDate(employeeId, isoDate) {
    return loadAbsences().filter(
      (a) => !a.slettet && a.employeeId === employeeId && a.workDate === isoDate
    );
  },

  async getAbsencesForDateAll(isoDate) {
    return loadAbsences().filter((a) => !a.slettet && a.workDate === isoDate);
  },

  async getActiveAbsence(employeeId) {
    return (
      loadAbsences().find(
        (a) => !a.slettet && a.ended === null && a.employeeId === employeeId
      ) ?? null
    );
  },

  async addAbsence(absence) {
    const all = loadAbsences();
    all.push(absence);
    saveAbsences(all);
  },

  // "Jeg er tilbage": sæt faktisk retur (ended). ended !== null ⇒ ikke aktiv.
  async endAbsence(id, ended) {
    const all = loadAbsences();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ended, updatedAt: nowIso() };
    saveAbsences(all);
  },

  // Ingen SMU OS i lokal dev → ingen sags-søgning (typeahead viser "ingen resultater").
  async searchSager() {
    return [];
  },

  // Ingen SMU OS i lokal dev → ingen enheder (vælgeren skjules; registrering på sagsniveau).
  async getSagEnheder() {
    return [];
  },
};
