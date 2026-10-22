import { describe, it, expect, beforeEach, vi } from "vitest";
import { localAdapter } from "./storage/localAdapter";
import { buildEntry } from "./segment";
import type { TimeEntry } from "../types";

// Pakke 1 (Manus QA 22. okt. 2026): en lederrettelse er en ATOMISK erstatning.
// I LIVE håndhæves det af DB-funktionen tid_erstat_registrering (testet mod DEV med
// rollback). Her testes kontrakten via den lokale adapter: originalen markeres slettet
// og erstatningen indsættes samlet — eller intet ændres.

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
});

let n = 0;
const linje = (startTime: string, endTime: string, o: Partial<TimeEntry> = {}): TimeEntry => ({
  ...buildEntry({
    employeeId: "andreas", workDate: "2026-10-22", startTime, endTime,
    categoryId: "montage-internt", subcategoryId: null, orderNumber: "", note: "",
    newId: () => `id-${++n}`, nowIso: "2026-10-22T10:00:00.000Z",
  }),
  ...o,
});

describe("replaceEntry — atomisk lederrettelse", () => {
  it("originalen markeres slettet, og erstatningen indsættes", async () => {
    const org = linje("15:15", "16:00");
    await localAdapter.addEntries([org]);
    const ny = linje("15:45", "16:00");
    await localAdapter.replaceEntry(org.id, [ny]);
    const dag = await localAdapter.getEntriesForDate("andreas", "2026-10-22");
    expect(dag.map((e) => e.id)).toEqual([ny.id]); // kun erstatningen er aktiv
  });

  it("allerede erstattet → afvises, intet ændres (ingen dobbelt-rettelse)", async () => {
    const org = linje("08:00", "09:00");
    await localAdapter.addEntries([org]);
    await localAdapter.replaceEntry(org.id, [linje("08:00", "08:30")]);
    await expect(localAdapter.replaceEntry(org.id, [linje("08:00", "08:45")])).rejects.toThrow();
    const dag = await localAdapter.getEntriesForDate("andreas", "2026-10-22");
    expect(dag.map((e) => `${e.startTime}-${e.endTime}`)).toEqual(["08:00-08:30"]);
  });

  it("frokost-split: hele gruppen erstattes", async () => {
    const a = linje("11:00", "12:00", { splitGroupId: "g1" });
    const b = linje("12:30", "13:00", { splitGroupId: "g1" });
    await localAdapter.addEntries([a, b]);
    await localAdapter.replaceEntry(a.id, [linje("11:00", "13:00")]);
    const dag = await localAdapter.getEntriesForDate("andreas", "2026-10-22");
    expect(dag.map((e) => `${e.startTime}-${e.endTime}`)).toEqual(["11:00-13:00"]);
  });
});
