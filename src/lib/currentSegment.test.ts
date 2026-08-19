import { describe, it, expect } from "vitest";
import {
  applySegmentAction,
  closeSegmentToEntry,
  entryFromTimes,
  segmentBlockReason,
  type SegmentState,
} from "./currentSegment";
import { floorTo15, ceilTo15 } from "./time";
import { isoToHHMM } from "./currentTaskStart";
import type { CurrentTask, TimeEntry } from "../types";

const ctx = {
  employeeId: "anders",
  nowIso: "2026-08-19T10:07:00.000Z", // ceil → 10:15 (lokal tid antaget = UTC i test)
  workDate: "2026-08-19",
  newId: () => "fixed-id",
};

function task(overrides: Partial<CurrentTask> = {}): CurrentTask {
  return {
    employeeId: "anders",
    categoryId: "montage-ude",
    subcategoryId: null,
    orderNumber: "54277",
    note: null,
    updatedAt: "2026-08-19T08:00:00.000Z",
    updatedBy: null,
    ...overrides,
  };
}

const draft = { categoryId: "montage-ude", subcategoryId: null, orderNumber: "54277", note: "" };

describe("closeSegmentToEntry (afrunding + is_break)", () => {
  it("start rundes ned, slut rundes op til kvarter", () => {
    const startIso = "2026-08-19T08:07:00.000Z";
    const e = closeSegmentToEntry(task(), startIso, ctx);
    // Tidszone-uafhængigt: udled forventet via samme hjælpere (isoToHHMM = lokal tid).
    expect(e.startTime).toBe(floorTo15(isoToHHMM(startIso))); // rundet ned
    expect(e.endTime).toBe(ceilTo15(isoToHHMM(ctx.nowIso))); // rundet op
    expect(e.durationMinutes).toBe(135); // 08:07→ned … 10:07→op = 2:15 (offset-invariant)
    expect(e.isBreak).toBe(false);
    expect(e.customer).toBe("54277"); // ordre/sag gemmes i customer-feltet
  });

  it("pause-kategori giver is_break=true", () => {
    const e = closeSegmentToEntry(task({ categoryId: "pause", subcategoryId: "pause__frokost" }), "2026-08-19T09:00:00.000Z", ctx);
    expect(e.isBreak).toBe(true);
  });
});

describe("applySegmentAction (tilstandsmaskine)", () => {
  it("start opgave opretter INGEN historik-linje", () => {
    const state: SegmentState = { task: null, startedAtIso: null };
    const r = applySegmentAction(state, { type: "start", draft }, ctx);
    expect(r.entry).toBeNull();
    expect(r.nextTask?.categoryId).toBe("montage-ude");
    expect(r.nextStartIso).toBe(ctx.nowIso);
  });

  it("skift opgave lukker første segment OG starter ny", () => {
    const state: SegmentState = { task: task(), startedAtIso: "2026-08-19T08:00:00.000Z" };
    const r = applySegmentAction(state, { type: "switch", draft: { ...draft, orderNumber: "99999" } }, ctx);
    expect(r.entry).not.toBeNull();
    expect(r.entry?.isBreak).toBe(false);
    expect(r.nextTask?.orderNumber).toBe("99999");
    expect(r.nextStartIso).toBe(ctx.nowIso);
  });

  it("start pause lukker arbejdssegment og starter pause", () => {
    const state: SegmentState = { task: task(), startedAtIso: "2026-08-19T08:00:00.000Z" };
    const r = applySegmentAction(state, { type: "pause" }, ctx);
    expect(r.entry?.isBreak).toBe(false); // den lukkede linje var arbejde
    expect(r.nextTask?.categoryId).toBe("pause");
    expect(r.nextTask?.subcategoryId).toBe("pause__frokost");
  });

  it("tilbage til arbejde lukker pause med is_break=true", () => {
    const pause = task({ categoryId: "pause", subcategoryId: "pause__frokost", orderNumber: null });
    const state: SegmentState = { task: pause, startedAtIso: "2026-08-19T09:00:00.000Z" };
    const r = applySegmentAction(state, { type: "resume", draft }, ctx);
    expect(r.entry?.isBreak).toBe(true); // pausen gemmes som pause
    expect(r.nextTask?.categoryId).toBe("montage-ude"); // genoptager arbejde
  });

  it("afslut opgave lukker aktivt segment og rydder aktiv opgave", () => {
    const state: SegmentState = { task: task(), startedAtIso: "2026-08-19T08:00:00.000Z" };
    const r = applySegmentAction(state, { type: "close" }, ctx);
    expect(r.entry).not.toBeNull();
    expect(r.nextTask).toBeNull();
    expect(r.nextStartIso).toBeNull();
  });

  it("handling uden aktivt segment lukker intet", () => {
    const state: SegmentState = { task: null, startedAtIso: null };
    const r = applySegmentAction(state, { type: "close" }, ctx);
    expect(r.entry).toBeNull();
  });
});

describe("entryFromTimes (afslut med rettet tid)", () => {
  it("gemmer de eksplicitte (rettede) tider", () => {
    const e = entryFromTimes(task(), "08:15", "11:45", ctx);
    expect(e.startTime).toBe("08:15");
    expect(e.endTime).toBe("11:45");
    expect(e.durationMinutes).toBe(210);
  });
  it("slut ≤ start → minimum ét kvarter", () => {
    const e = entryFromTimes(task(), "10:00", "10:00", ctx);
    expect(e.endTime).toBe("10:15");
  });
});

describe("segmentBlockReason (dublet-/overlap-beskyttelse)", () => {
  function te(overrides: Partial<TimeEntry> = {}): TimeEntry {
    return {
      id: "x", employeeId: "anders", workDate: "2026-08-19",
      startTime: "08:00", endTime: "10:00", durationMinutes: 120,
      categoryId: "montage-ude", subcategoryId: null, customer: "54277", note: "",
      isBreak: false, isRedo: false, redoReason: null, redoNote: "",
      splitGroupId: null, slettet: false, createdAt: "", updatedAt: "",
      ...overrides,
    };
  }

  it("identisk linje → 'duplicate'", () => {
    const e = te();
    expect(segmentBlockReason(e, [te()])).toBe("duplicate");
  });

  it("grænse-overlap ≤ 15 min (kvarter-afrunding) → tilladt (null)", () => {
    // Ny 10:00–12:00 mod eksisterende 08:00–10:15 → overlap = 15 min → ok.
    const nyt = te({ startTime: "10:00", endTime: "12:00", customer: "99999" });
    const eksisterende = te({ startTime: "08:00", endTime: "10:15" });
    expect(segmentBlockReason(nyt, [eksisterende])).toBeNull();
  });

  it("ægte overlap > 15 min → 'overlap'", () => {
    const nyt = te({ startTime: "09:00", endTime: "11:00", customer: "99999" });
    const eksisterende = te({ startTime: "08:00", endTime: "10:00" }); // overlap 60 min
    expect(segmentBlockReason(nyt, [eksisterende])).toBe("overlap");
  });

  it("slettede linjer ignoreres", () => {
    const e = te();
    expect(segmentBlockReason(e, [te({ slettet: true })])).toBeNull();
  });

  it("ingen konflikt → null", () => {
    const nyt = te({ startTime: "10:30", endTime: "12:00", customer: "99999" });
    expect(segmentBlockReason(nyt, [te({ startTime: "08:00", endTime: "10:00" })])).toBeNull();
  });
});
