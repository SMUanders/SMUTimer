import type { TimeEntry, CurrentTask, Absence } from "../../types";
import type { TimeEntryStore } from "./types";
import { nowIso } from "./types";

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
};
