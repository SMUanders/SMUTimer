import { describe, it, expect } from "vitest";
import {
  absenceMinutes,
  lastAbsenceEndHHMM,
  activeAbsence,
  isAbsenceActive,
  effectiveEnd,
} from "./absence";
import { summarizeDay } from "./summary";
import { buildDayTimeline } from "./dayTimeline";
import type { Absence, TimeEntry } from "../types";

function abs(o: Partial<Absence> = {}): Absence {
  return {
    id: Math.random().toString(36).slice(2),
    employeeId: "henriette",
    workDate: "2026-08-25",
    startTime: "09:30",
    expectedEnd: "11:30",
    ended: "11:30",
    absenceType: "syg",
    note: "",
    slettet: false,
    createdAt: "2026-08-25T07:00:00Z",
    updatedAt: "2026-08-25T07:00:00Z",
    ...o,
  };
}

function work(startTime: string, endTime: string): TimeEntry {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return {
    id: Math.random().toString(36).slice(2),
    employeeId: "henriette",
    workDate: "2026-08-25",
    startTime,
    endTime,
    durationMinutes: eh * 60 + em - (sh * 60 + sm),
    categoryId: "montage-ude",
    subcategoryId: null,
    customer: "",
    note: "",
    isBreak: false,
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId: null,
    slettet: false,
    createdAt: "",
    updatedAt: "",
  };
}

describe("absence-helpers", () => {
  it("aktivt fravær = ended IS NULL (ingen dobbeltstatus)", () => {
    expect(isAbsenceActive(abs({ ended: null }))).toBe(true);
    expect(isAbsenceActive(abs({ ended: "11:18" }))).toBe(false);
    expect(isAbsenceActive(abs({ ended: null, slettet: true }))).toBe(false);
  });

  it("effectiveEnd = faktisk retur hvis kendt, ellers forventet", () => {
    // Mens hun er væk: vis forventet 11:30.
    expect(effectiveEnd(abs({ expectedEnd: "11:30", ended: null }))).toBe("11:30");
    // Efter retur 11:18: den faktiske vinder.
    expect(effectiveEnd(abs({ expectedEnd: "11:30", ended: "11:18" }))).toBe("11:18");
    expect(effectiveEnd(abs({ expectedEnd: null, ended: null }))).toBeNull();
  });

  it("absenceMinutes bruger faktisk retur (11:18 ⇒ 108 min, ikke forventet 120)", () => {
    expect(absenceMinutes([abs({ startTime: "09:30", expectedEnd: "11:30", ended: "11:18" })])).toBe(108);
    expect(absenceMinutes([abs({ expectedEnd: null, ended: null })])).toBe(0); // ukendt
    expect(absenceMinutes([abs({ slettet: true })])).toBe(0);
  });

  it("lastAbsenceEndHHMM = seneste (effektive) fraværs sluttid (næste arbejdsstart)", () => {
    expect(lastAbsenceEndHHMM([abs({ ended: "11:18" })])).toBe("11:18");
    expect(lastAbsenceEndHHMM([abs({ expectedEnd: null, ended: null })])).toBeNull();
  });

  it("activeAbsence finder det aktive fravær (nyeste, ended null)", () => {
    const a1 = abs({ ended: null, updatedAt: "2026-08-25T07:00:00Z" });
    const a2 = abs({ ended: null, updatedAt: "2026-08-25T09:00:00Z" });
    expect(activeAbsence([a1, a2])?.updatedAt).toBe("2026-08-25T09:00:00Z");
    expect(activeAbsence([abs({ ended: "11:18" })])).toBeNull();
  });
});

describe("summarizeDay med fravær", () => {
  const entries = [work("08:00", "09:30")]; // 90 min arbejde
  const absences = [abs({ startTime: "09:30", expectedEnd: "11:30", ended: "11:30" })]; // 120 min

  it("fravær tæller IKKE som arbejdstid eller pause", () => {
    const s = summarizeDay(entries, 450, absences);
    expect(s.workedMinutes).toBe(90);
    expect(s.breakMinutes).toBe(0);
    expect(s.absenceMinutes).toBe(120);
  });

  it("fravær reducerer 'mangler' (7:30 − 1:30 arbejde − 2:00 fravær = 4:00)", () => {
    const s = summarizeDay(entries, 450, absences);
    expect(s.missingMinutes).toBe(450 - 90 - 120); // 240
  });

  it("fravær skaber IKKE hul i det dækkede tidsrum", () => {
    const s = summarizeDay(entries, 450, absences);
    expect(s.gaps).toHaveLength(0); // 08:00–09:30 arbejde + 09:30–11:30 fravær rører
  });

  it("uden fravær: hul mellem arbejde og senere arbejde", () => {
    const s = summarizeDay([work("08:00", "09:30"), work("11:30", "12:00")], 450, []);
    expect(s.gaps).toHaveLength(1); // 09:30–11:30 hul
  });
});

describe("buildDayTimeline med fravær", () => {
  it("fravær vises som egen 'fravaer'-blok, intet hul, intet overlap", () => {
    const blocks = buildDayTimeline(
      [work("08:00", "09:30"), work("11:30", "12:00")],
      [abs({ startTime: "09:30", expectedEnd: "11:30", ended: "11:30" })]
    );
    expect(blocks.map((b) => b.kind)).toEqual(["work", "fravaer", "work"]);
    expect(blocks.every((b) => !b.conflict)).toBe(true);
    expect(blocks.some((b) => b.kind === "gap")).toBe(false);
  });

  it("aktivt fravær (ended null) vises som åben blok", () => {
    const blocks = buildDayTimeline([], [abs({ expectedEnd: null, ended: null })]);
    expect(blocks[0].kind).toBe("fravaer");
    expect(blocks[0].open).toBe(true);
  });
});
