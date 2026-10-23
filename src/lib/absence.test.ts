import { describe, it, expect } from "vitest";
import {
  absenceMinutes,
  lastAbsenceEndHHMM,
  activeAbsence,
  isAbsenceActive,
  effectiveEnd,
  absenceError,
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
    customer: "", sagId: null, sagSmuNummer: null, enhedId: null, enhedVisning: null,
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

describe("absenceError — fravær kan rettes/registreres uden konflikter", () => {
  const d = (o: Partial<import("./absence").AbsenceDraft> = {}) => ({ absenceType: "syg", startTime: "08:00", expectedEnd: "", ended: "", note: "", ...o });
  const arb = [{ startTime: "06:00", endTime: "07:30" }, { startTime: "12:00", endTime: "13:00" }];
  it("gyldigt fravær uden sluttid (stadig væk)", () => {
    expect(absenceError(d(), arb, [])).toBeNull();
  });
  it("tom eller ugyldig fra-tid afvises", () => {
    expect(absenceError(d({ startTime: "" }), arb, [])).toMatch(/starter/);
  });
  it("tilbage og forventet tilbage skal ligge efter fra", () => {
    expect(absenceError(d({ ended: "08:00" }), arb, [])).toMatch(/Tilbage skal ligge efter/);
    expect(absenceError(d({ expectedEnd: "07:59" }), arb, [])).toMatch(/Forventet tilbage skal ligge efter/);
  });
  it("overlap med arbejdstid giver forståelig fejl", () => {
    expect(absenceError(d({ ended: "12:30" }), arb, [])).toMatch(/overlapper registreringen 12:00–13:00/);
    expect(absenceError(d({ startTime: "07:00", ended: "08:00" }), arb, [])).toMatch(/06:00–07:30/);
  });
  it("back-to-back med arbejdstid er OK", () => {
    expect(absenceError(d({ startTime: "07:30", ended: "12:00" }), arb, [])).toBeNull();
  });
  it("overlap med et andet fravær afvises; slettede ignoreres", () => {
    const andet = abs({ startTime: "09:00", expectedEnd: null, ended: "10:00" });
    expect(absenceError(d({ ended: "09:30" }), arb, [andet])).toMatch(/andet fravær fra 09:00/);
    expect(absenceError(d({ ended: "09:30" }), arb, [{ ...andet, slettet: true }])).toBeNull();
  });
});
