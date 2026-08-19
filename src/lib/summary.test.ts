import { describe, it, expect } from "vitest";
import { summarizeDay, expectedWorkMinutes, missingInputSegments } from "./summary";
import type { TimeEntry } from "../types";

const MON = "2026-08-10"; // mandag  → arbejdsdag 07:30–15:30
const FRI = "2026-08-14"; // fredag  → arbejdsdag 07:30–15:00
const SAT = "2026-08-15"; // lørdag  → ingen arbejdsdag

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

  it("MANUEL Pause-kategori (isBreak=false) tæller heller ikke som arbejde", () => {
    // Regression: en pause registreret manuelt via kategori 'pause' må ikke
    // tælle med, selvom isBreak-flaget ikke er sat.
    const s = summarizeDay([
      e("07:30", "12:00"), // 270 arbejde
      e("12:00", "12:30", { categoryId: "pause", isBreak: false }), // 30 pause
      e("12:30", "15:30"), // 180 arbejde
    ]);
    expect(s.workedMinutes).toBe(450); // 7,5 t — IKKE 480
    expect(s.breakMinutes).toBe(30);
  });

  it("manuel pause skaber ikke overarbejde/manglende ift. 7,5 t", () => {
    const s = summarizeDay(
      [
        e("07:30", "12:00"),
        e("12:00", "12:30", { categoryId: "pause" }),
        e("12:30", "15:30"),
      ],
      450
    );
    expect(s.workedMinutes).toBe(450);
    expect(s.missingMinutes).toBe(0); // ikke manglende
    // overarbejde udledes i adminSummary som max(0, worked-expected) = 0
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
  it("mandag–torsdag = 450 min (7,5 t)", () => {
    expect(expectedWorkMinutes("2026-08-10")).toBe(450); // mandag
    expect(expectedWorkMinutes("2026-08-13")).toBe(450); // torsdag
  });
  it("fredag = 420 min (7 t)", () => {
    expect(expectedWorkMinutes("2026-08-14")).toBe(420); // fredag
  });
  it("weekend = 0 (ingen automatisk forventning)", () => {
    expect(expectedWorkMinutes("2026-08-15")).toBe(0); // lørdag
    expect(expectedWorkMinutes("2026-08-16")).toBe(0); // søndag
  });
});

describe("missingInputSegments (Indtastning mangler, rammet ind af arbejdsdag)", () => {
  it("mandag: 07:30–10:00 + 11:15–15:30 → mangler 10:00–11:15", () => {
    const seg = missingInputSegments([e("07:30", "10:00"), e("11:15", "15:30")], MON);
    expect(seg).toEqual([{ startTime: "10:00", endTime: "11:15", minutes: 75 }]);
  });

  it("fredag: 07:30–14:00 → mangler frem til 15:00 (ikke 15:30)", () => {
    const seg = missingInputSegments([e("07:30", "14:00")], FRI);
    expect(seg).toEqual([{ startTime: "14:00", endTime: "15:00", minutes: 60 }]);
  });

  it("mandag: sen start 09:00–15:30 → mangler i starten 07:30–09:00", () => {
    const seg = missingInputSegments([e("09:00", "15:30")], MON);
    expect(seg).toEqual([{ startTime: "07:30", endTime: "09:00", minutes: 90 }]);
  });

  it("tid før/efter arbejdsdagen tæller ikke som manglende", () => {
    // Fuld dag dækket + ekstra tid udenfor rammen → intet mangler.
    const seg = missingInputSegments(
      [e("06:30", "07:30"), e("07:30", "15:30"), e("15:30", "17:00")],
      MON
    );
    expect(seg).toEqual([]);
  });

  it("weekend → ingen manglende indtastning", () => {
    expect(missingInputSegments([e("09:00", "12:00")], SAT)).toEqual([]);
  });

  it("reserveret frokost dækker hullet (vises ikke dobbelt)", () => {
    const seg = missingInputSegments(
      [e("07:30", "12:00"), e("12:30", "15:30")],
      MON,
      [{ startTime: "12:00", endTime: "12:30" }]
    );
    expect(seg).toEqual([]);
  });
});
