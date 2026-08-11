import { describe, it, expect } from "vitest";
import { summarizeDay, expectedWorkMinutes } from "./summary";
import type { TimeEntry } from "../types";

function e(
  start: string,
  end: string,
  opts: Partial<TimeEntry> = {}
): TimeEntry {
  const dur =
    (parseInt(end.slice(0, 2)) * 60 + parseInt(end.slice(3))) -
    (parseInt(start.slice(0, 2)) * 60 + parseInt(start.slice(3)));
  return {
    id: Math.random().toString(36).slice(2), employeeId: "anders",
    workDate: "2026-08-10", startTime: start, endTime: end, durationMinutes: dur,
    categoryId: "montage-ude", subcategoryId: null, customer: "", note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, slettet: false, createdAt: "", updatedAt: "",
    ...opts,
  };
}

describe("summarizeDay", () => {
  it("pause tælles ikke som arbejdstid", () => {
    const s = summarizeDay([
      e("10:00", "12:00"),
      e("12:00", "12:30", { isBreak: true }),
      e("12:30", "14:00"),
    ]);
    expect(s.workedMinutes).toBe(210); // 120 + 90
    expect(s.breakMinutes).toBe(30);
  });

  it("finder huller mellem linjer", () => {
    const s = summarizeDay([e("08:00", "09:00"), e("09:15", "10:00")]);
    expect(s.gaps).toHaveLength(1);
    expect(s.gaps[0].minutes).toBe(15);
  });

  it("finder overlap mellem arbejdslinjer", () => {
    const s = summarizeDay([e("08:00", "10:00"), e("09:00", "11:00")]);
    expect(s.overlaps).toHaveLength(1);
  });

  it("manglende tid = forventet − arbejdet (7,5t)", () => {
    const s = summarizeDay([e("08:00", "12:00")]); // 240 min
    expect(s.missingMinutes).toBe(450 - 240);
  });

  it("ingen manglende tid når fuld dag er registreret", () => {
    const s = summarizeDay([e("08:00", "12:00"), e("12:00", "15:30")]); // 240+210=450
    expect(s.missingMinutes).toBe(0);
  });
});

describe("expectedWorkMinutes", () => {
  it("hverdag (man–fre) = 450 min", () => {
    expect(expectedWorkMinutes("2026-08-10")).toBe(450); // mandag
    expect(expectedWorkMinutes("2026-08-14")).toBe(450); // fredag
  });
  it("weekend = 0 (ingen automatisk forventning)", () => {
    expect(expectedWorkMinutes("2026-08-15")).toBe(0); // lørdag
    expect(expectedWorkMinutes("2026-08-16")).toBe(0); // søndag
  });
});
