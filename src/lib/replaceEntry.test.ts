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

describe("Pakke 1.1 — afkort egen, seneste registrering (lokal kontrakt = DB-afgrænsning)", () => {
  it("09:00–09:45 afkortes til 09:38: originalen bevares som slettet, kopien slutter 09:38", async () => {
    const org = linje("09:00", "09:45");
    await localAdapter.addEntries([org]);
    await localAdapter.shortenLatestEntry(org.id, "09:38", "09:45");
    const dag = await localAdapter.getEntriesForDate("andreas", "2026-10-22");
    expect(dag.map((e) => `${e.startTime}-${e.endTime} ${e.durationMinutes}`)).toEqual(["09:00-09:38 38"]);
  });
  it("samtidig ændring (forventet slut passer ikke) afvises", async () => {
    const org = linje("09:00", "09:45");
    await localAdapter.addEntries([org]);
    await expect(localAdapter.shortenLatestEntry(org.id, "09:38", "09:50")).rejects.toThrow(/ændret/);
  });
  it("kun dagens seneste, kun kortere, ikke split", async () => {
    const a = linje("08:00", "09:00");
    const b = linje("09:00", "09:45");
    const s = linje("12:30", "13:00", { splitGroupId: "g" });
    await localAdapter.addEntries([a, b]);
    await expect(localAdapter.shortenLatestEntry(a.id, "08:30", "09:00")).rejects.toThrow(/seneste/);
    await expect(localAdapter.shortenLatestEntry(b.id, "09:50", "09:45")).rejects.toThrow();
    await localAdapter.addEntries([s]);
    await expect(localAdapter.shortenLatestEntry(s.id, "12:45", "13:00")).rejects.toThrow(/frokost/);
  });
  it("egen note kan rettes", async () => {
    const org = linje("10:00", "10:30");
    await localAdapter.addEntries([org]);
    await localAdapter.updateOwnNote(org.id, "ny note");
    const dag = await localAdapter.getEntriesForDate("andreas", "2026-10-22");
    expect(dag[0].note).toBe("ny note");
  });
});
