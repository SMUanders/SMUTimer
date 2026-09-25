import { describe, it, expect, beforeEach, vi } from "vitest";
import { localAdapter } from "./localAdapter";
import type { TimeEntry } from "../../types";

// In-memory localStorage (node-miljø uden DOM).
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "e1",
    employeeId: "anders",
    workDate: "2026-09-25",
    startTime: "08:00",
    endTime: "09:00",
    durationMinutes: 60,
    categoryId: "montage-internt",
    subcategoryId: "montage-internt__montering",
    customer: "SMU-0123",
    sagId: "sag-uuid-1",
    sagSmuNummer: "SMU-0123",
    note: "",
    isBreak: false,
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId: null,
    slettet: false,
    createdAt: "2026-09-25T08:00:00.000Z",
    updatedAt: "2026-09-25T09:00:00.000Z",
    ...over,
  };
}

describe("note-only update på egen afsluttet registrering (v2.1.1)", () => {
  it("tom note kan få tilføjet tekst", async () => {
    await localAdapter.addEntries([entry({ note: "" })]);
    await localAdapter.updateEntry("e1", { note: "Monteret venstre side." });
    const [e] = await localAdapter.getEntriesForDate("anders", "2026-09-25");
    expect(e.note).toBe("Monteret venstre side.");
  });

  it("eksisterende note kan ændres", async () => {
    await localAdapter.addEntries([entry({ note: "Gammel note" })]);
    await localAdapter.updateEntry("e1", { note: "Ny note" });
    const [e] = await localAdapter.getEntriesForDate("anders", "2026-09-25");
    expect(e.note).toBe("Ny note");
  });

  it("ændrer INGEN andre felter end note (+ updatedAt)", async () => {
    const original = entry({ note: "start" });
    await localAdapter.addEntries([original]);
    await localAdapter.updateEntry("e1", { note: "rettet" });
    const [e] = await localAdapter.getEntriesForDate("anders", "2026-09-25");
    // Alt bortset fra note og updatedAt er uændret:
    expect({ ...e, note: original.note, updatedAt: original.updatedAt }).toEqual(original);
    expect(e.note).toBe("rettet");
    expect(e.startTime).toBe("08:00");
    expect(e.endTime).toBe("09:00");
    expect(e.durationMinutes).toBe(60);
    expect(e.categoryId).toBe("montage-internt");
    expect(e.subcategoryId).toBe("montage-internt__montering");
    expect(e.sagId).toBe("sag-uuid-1");
    expect(e.sagSmuNummer).toBe("SMU-0123");
    expect(e.employeeId).toBe("anders");
    expect(e.isRedo).toBe(false);
  });
});
