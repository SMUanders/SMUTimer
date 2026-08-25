import { describe, it, expect } from "vitest";
import { buildDayTimeline } from "./dayTimeline";
import { HELP_NOTE } from "./helpContext";
import type { TimeEntry } from "../types";

function te(o: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    employeeId: "laila",
    workDate: "2026-08-21",
    startTime: "08:00",
    endTime: "09:00",
    durationMinutes: 60,
    categoryId: "montage-ude",
    subcategoryId: null,
    customer: "54277",
    note: "",
    isBreak: false,
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId: null,
    slettet: false,
    createdAt: "",
    updatedAt: "",
    ...o,
  };
}

const kinds = (b: ReturnType<typeof buildDayTimeline>) => b.map((x) => x.kind);

describe("buildDayTimeline", () => {
  it("normal dag uden huller: to back-to-back → ingen hul", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:00", endTime: "09:00" }),
      te({ startTime: "09:00", endTime: "10:00" }),
    ]);
    expect(kinds(t)).toEqual(["work", "work"]);
    expect(t.every((b) => !b.conflict)).toBe(true);
  });

  it("dag med pause → pause-blok", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:00", endTime: "12:00" }),
      te({ startTime: "12:00", endTime: "12:30", categoryId: "pause", isBreak: true }),
    ]);
    expect(kinds(t)).toEqual(["work", "pause"]);
  });

  it("dag med hul → hul-blok med korrekte tider", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:00", endTime: "09:00" }),
      te({ startTime: "09:30", endTime: "10:00" }),
    ]);
    expect(kinds(t)).toEqual(["work", "gap", "work"]);
    const gap = t.find((b) => b.kind === "gap")!;
    expect(gap.startTime).toBe("09:00");
    expect(gap.endTime).toBe("09:30");
    expect(gap.durationMin).toBe(30);
  });

  it("dag med hjælp → help-blok (note-markør)", () => {
    const t = buildDayTimeline([te({ note: HELP_NOTE, categoryId: "montage-ude" })]);
    expect(kinds(t)).toEqual(["help"]);
  });

  it("dag med omgøring → redo-blok (isRedo), ikke almindeligt arbejde", () => {
    const t = buildDayTimeline([
      te({ startTime: "10:15", endTime: "10:35", categoryId: "montage-ude", isRedo: true, redoReason: "produktionsfejl" }),
    ]);
    expect(kinds(t)).toEqual(["redo"]);
  });

  it("dag med dublet → begge markeret som konflikt", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:45", endTime: "09:00" }),
      te({ startTime: "08:45", endTime: "09:00" }),
    ]);
    expect(t.filter((b) => b.conflict)).toHaveLength(2);
  });

  it("dag med overlap → de overlappende markeret, ikke-overlappende ikke", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:45", endTime: "09:00" }),
      te({ startTime: "08:50", endTime: "09:05" }),
      te({ startTime: "10:00", endTime: "10:30" }),
    ]);
    const conf = t.filter((b) => b.conflict);
    expect(conf).toHaveLength(2);
    expect(conf.every((b) => b.endMin <= 545)).toBe(true); // begge før 09:05
  });

  it("back-to-back rører hinanden → INTET overlap", () => {
    const t = buildDayTimeline([
      te({ startTime: "09:10", endTime: "09:55" }),
      te({ startTime: "09:55", endTime: "10:00" }),
    ]);
    expect(t.every((b) => !b.conflict)).toBe(true);
  });

  it("både hjælp og pause i samme dag", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:00", endTime: "08:30" }),
      te({ startTime: "08:30", endTime: "08:35", note: HELP_NOTE }),
      te({ startTime: "08:35", endTime: "09:00" }),
      te({ startTime: "12:00", endTime: "12:30", categoryId: "pause", isBreak: true }),
    ]);
    // work, help, work, [hul], pause
    expect(kinds(t)).toEqual(["work", "help", "work", "gap", "pause"]);
  });

  it("slettede linjer ignoreres", () => {
    const t = buildDayTimeline([
      te({ startTime: "08:00", endTime: "09:00" }),
      te({ startTime: "09:00", endTime: "10:00", slettet: true }),
    ]);
    expect(t).toHaveLength(1);
  });

  it("rækkefølge sorteres korrekt (uordnet input)", () => {
    const t = buildDayTimeline([
      te({ startTime: "10:00", endTime: "11:00" }),
      te({ startTime: "08:00", endTime: "09:00" }),
    ]);
    expect(t[0].startTime).toBe("08:00");
    // hul 09:00–10:00 imellem
    expect(kinds(t)).toEqual(["work", "gap", "work"]);
  });
});
