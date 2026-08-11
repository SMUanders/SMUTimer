import type { TimeEntry } from "../../types";
import type { TimeEntryStore } from "./types";
import { nowIso } from "./types";

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
};
