import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildEntry } from "./segment";
import { buildEntries } from "./entries";
import { setPause, getPause } from "./pauseContext";
import type { EntryDraft } from "../types";

// TR-088: enheden skal følge registreringen hele vejen — fra aktiv opgave til historiklinje,
// gennem suspend/resume — og pauser/frokostlinjer er aldrig enhedsarbejde.

describe("buildEntry (afslut opgave) bærer sag + enhed", () => {
  const base = {
    employeeId: "anders",
    workDate: "2026-10-19",
    startTime: "08:00",
    endTime: "09:00",
    categoryId: "montage-ude",
    subcategoryId: "montage-ude__montering",
    orderNumber: "SMU-0115",
    note: "",
    newId: () => "id1",
    nowIso: "2026-10-19T09:00:00.000Z",
  };

  it("enhed sat → gemmes på linjen", () => {
    const e = buildEntry({ ...base, sagId: "s1", sagSmuNummer: "SMU-0115", enhedId: "e3", enhedVisning: "#3 · Trailer" });
    expect(e.sagId).toBe("s1");
    expect(e.enhedId).toBe("e3");
    expect(e.enhedVisning).toBe("#3 · Trailer");
  });

  it("ingen enhed → sagsniveau (null)", () => {
    const e = buildEntry({ ...base, sagId: "s1", sagSmuNummer: "SMU-0115" });
    expect(e.enhedId).toBeNull();
    expect(e.enhedVisning).toBeNull();
  });
});

describe("buildEntries (leder-korrektion) bærer enhed; frokost-split giver pause uden enhed", () => {
  const draft: EntryDraft = {
    startTime: "08:00",
    endTime: "14:00",
    categoryId: "montage-ude",
    subcategoryId: "montage-ude__montering",
    customer: "SMU-0115",
    sagId: "s1",
    sagSmuNummer: "SMU-0115",
    enhedId: "e3",
    enhedVisning: "#3 · Trailer",
    note: "",
    isRedo: false,
    redoReason: null,
    redoNote: "",
  };
  let n = 0;
  const opts = { employeeId: "anders", newId: () => `id${++n}`, now: () => "2026-10-19T14:00:00.000Z" };

  it("uden frokost: én linje med enhed", () => {
    const [e] = buildEntries(draft, "2026-10-19", { ...opts, lunch: null });
    expect(e.enhedId).toBe("e3");
  });

  it("med frokost-split: arbejdslinjer har enhed, pauselinjen har ikke", () => {
    const rows = buildEntries(draft, "2026-10-19", {
      ...opts,
      lunch: { startTime: "12:00", endTime: "12:30" },
    });
    const pause = rows.filter((r) => r.isBreak);
    const arbejde = rows.filter((r) => !r.isBreak);
    expect(arbejde.length).toBeGreaterThan(0);
    expect(arbejde.every((r) => r.enhedId === "e3" && r.sagId === "s1")).toBe(true);
    expect(pause.every((r) => r.enhedId === null && r.sagId === null)).toBe(true);
  });
});

describe("pauseContext bevarer enheden over en pause (suspend/resume)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("enhedId + snapshot kommer uændret tilbage", () => {
    setPause("anders", {
      categoryId: "montage-ude",
      subcategoryId: null,
      orderNumber: "SMU-0115",
      sagId: "s1",
      sagSmuNummer: "SMU-0115",
      enhedId: "e3",
      enhedVisning: "#3 · Trailer",
      note: "",
    });
    const t = getPause("anders");
    expect(t?.enhedId).toBe("e3");
    expect(t?.enhedVisning).toBe("#3 · Trailer");
  });
});
