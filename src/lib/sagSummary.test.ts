import { describe, it, expect } from "vitest";
import { summarizeSag } from "./sagSummary";
import type { TimeEntry } from "../types";

function e(over: Partial<TimeEntry>): TimeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    employeeId: "anders",
    workDate: "2026-10-01",
    startTime: "08:00",
    endTime: "09:00",
    durationMinutes: 60,
    categoryId: "montage-internt",
    subcategoryId: "montage-internt__montering",
    customer: "SMU-0123",
    sagId: "sag-1",
    sagSmuNummer: "SMU-0123",
    note: "",
    isBreak: false,
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId: null,
    slettet: false,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...over,
  };
}

describe("summarizeSag — total, fordeling, ingen dobbeltoptælling", () => {
  it("summerer total korrekt (hver linje tælles én gang)", () => {
    const s = summarizeSag([e({ durationMinutes: 60 }), e({ durationMinutes: 30 }), e({ durationMinutes: 15 })]);
    expect(s.totalMinutes).toBe(105);
    expect(s.entryCount).toBe(3);
  });

  it("slettede linjer tælles IKKE med", () => {
    const s = summarizeSag([e({ durationMinutes: 60 }), e({ durationMinutes: 999, slettet: true })]);
    expect(s.totalMinutes).toBe(60);
    expect(s.entryCount).toBe(1);
  });

  it("fordeling pr. medarbejder summerer til totalen (ingen dobbelttælling)", () => {
    const s = summarizeSag([
      e({ employeeId: "anders", durationMinutes: 60 }),
      e({ employeeId: "anders", durationMinutes: 30 }),
      e({ employeeId: "natasha", durationMinutes: 45 }),
    ]);
    expect(s.byEmployee.reduce((x, g) => x + g.minutes, 0)).toBe(s.totalMinutes);
    const anders = s.byEmployee.find((g) => g.employeeId === "anders");
    expect(anders).toEqual({ employeeId: "anders", minutes: 90, count: 2 });
    // sorteret efter mest tid først
    expect(s.byEmployee[0].employeeId).toBe("anders");
  });

  it("fordeling pr. aktivitet summerer til totalen og grupperer på kategori+underpunkt", () => {
    const s = summarizeSag([
      e({ categoryId: "montage-internt", subcategoryId: "montage-internt__montering", durationMinutes: 60 }),
      e({ categoryId: "montage-internt", subcategoryId: "montage-internt__montering", durationMinutes: 30 }),
      e({ categoryId: "montage-internt", subcategoryId: "montage-internt__trucking", durationMinutes: 20 }),
    ]);
    expect(s.byCategory.reduce((x, g) => x + g.minutes, 0)).toBe(s.totalMinutes);
    expect(s.byCategory.length).toBe(2);
    expect(s.byCategory[0].minutes).toBe(90); // montering størst
  });

  it("tom input → nul", () => {
    const s = summarizeSag([]);
    expect(s).toEqual({ totalMinutes: 0, entryCount: 0, byEmployee: [], byCategory: [] });
  });
});
