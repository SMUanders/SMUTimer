import { describe, it, expect } from "vitest";
import { employeeDaySummary } from "./adminSummary";
import type { TimeEntry } from "../types";

function e(start: string, end: string, opts: Partial<TimeEntry> = {}): TimeEntry {
  const dur =
    parseInt(end.slice(0, 2)) * 60 + parseInt(end.slice(3)) -
    (parseInt(start.slice(0, 2)) * 60 + parseInt(start.slice(3)));
  return {
    id: Math.random().toString(36).slice(2), employeeId: "anders",
    workDate: "2026-08-10", startTime: start, endTime: end, durationMinutes: dur,
    categoryId: "montage-ude", subcategoryId: null, customer: "", note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, createdAt: "2026-08-10T07:00:00Z", updatedAt: "2026-08-10T07:00:00Z",
    ...opts,
  };
}

const MON = "2026-08-10";
const SAT = "2026-08-15";

describe("employeeDaySummary", () => {
  it("hverdag uden linjer → ikke-startet", () => {
    const s = employeeDaySummary("anders", [], MON);
    expect(s.status).toBe("ikke-startet");
    expect(s.expectedMinutes).toBe(450);
    expect(s.missingMinutes).toBe(450);
  });

  it("delvist udfyldt", () => {
    const s = employeeDaySummary("anders", [e("08:00", "12:00")], MON); // 240
    expect(s.status).toBe("delvist");
    expect(s.missingMinutes).toBe(210);
    expect(s.overtimeMinutes).toBe(0);
  });

  it("fuld dag → udfyldt", () => {
    const s = employeeDaySummary("anders", [e("07:30", "15:00")], MON); // 450
    expect(s.status).toBe("udfyldt");
    expect(s.missingMinutes).toBe(0);
    expect(s.overtimeMinutes).toBe(0);
  });

  it("over forventet → overarbejde", () => {
    const s = employeeDaySummary("anders", [e("07:00", "16:00")], MON); // 540
    expect(s.status).toBe("overarbejde");
    expect(s.overtimeMinutes).toBe(90);
  });

  it("weekend → fri (forventet 0)", () => {
    const s = employeeDaySummary("anders", [], SAT);
    expect(s.status).toBe("fri");
    expect(s.expectedMinutes).toBe(0);
    expect(s.missingMinutes).toBe(0);
  });

  it("pause tæller ikke; omgøring tælles", () => {
    const s = employeeDaySummary(
      "anders",
      [
        e("08:00", "12:00", { isRedo: true }),
        e("12:00", "12:30", { isBreak: true }),
        e("12:30", "14:00"),
      ],
      MON
    );
    expect(s.workedMinutes).toBe(330); // 240 + 90, pause ekskl.
    expect(s.redoCount).toBe(1);
  });

  it("sidst opdateret = seneste updatedAt", () => {
    const s = employeeDaySummary(
      "anders",
      [
        e("08:00", "09:00", { updatedAt: "2026-08-10T08:00:00Z" }),
        e("09:00", "10:00", { updatedAt: "2026-08-10T09:30:00Z" }),
      ],
      MON
    );
    expect(s.lastUpdated).toBe("2026-08-10T09:30:00Z");
  });
});
