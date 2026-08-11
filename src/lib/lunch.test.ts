import { describe, it, expect } from "vitest";
import {
  getLunchWindow,
  proposeLunchSplit,
  splitAroundLunch,
} from "./lunch";
import type { TimeEntry } from "../types";

// 2026-08-10 er en mandag; 2026-08-14 fredag; 2026-08-15 lørdag.
const MON = "2026-08-10";
const FRI = "2026-08-14";
const SAT = "2026-08-15";

function breakEntry(start: string, end: string): TimeEntry {
  return {
    id: "b", employeeId: "anders", workDate: MON, startTime: start, endTime: end, durationMinutes: 0,
    categoryId: "pause", subcategoryId: "frokost", customer: "", note: "",
    isBreak: true, isRedo: false, redoReason: null, redoNote: "", splitGroupId: "g",
    createdAt: "", updatedAt: "",
  };
}

describe("getLunchWindow", () => {
  it("man–tor: 12:00–12:30", () => {
    expect(getLunchWindow(MON)).toEqual({ startTime: "12:00", endTime: "12:30" });
  });
  it("fredag: 10:00–10:30", () => {
    expect(getLunchWindow(FRI)).toEqual({ startTime: "10:00", endTime: "10:30" });
  });
  it("weekend: ingen frokost", () => {
    expect(getLunchWindow(SAT)).toBeNull();
  });
});

describe("splitAroundLunch", () => {
  it("10:00–14:00 (man) → 3 dele med korrekte grænser", () => {
    const parts = splitAroundLunch("10:00", "14:00", { startTime: "12:00", endTime: "12:30" });
    expect(parts).toEqual([
      { startTime: "10:00", endTime: "12:00", isBreak: false },
      { startTime: "12:00", endTime: "12:30", isBreak: true },
      { startTime: "12:30", endTime: "14:00", isBreak: false },
    ]);
  });

  it("fredag bruger 10:00–10:30", () => {
    const parts = splitAroundLunch("09:00", "12:00", { startTime: "10:00", endTime: "10:30" });
    expect(parts.map((p) => `${p.startTime}-${p.endTime}${p.isBreak ? "*" : ""}`)).toEqual([
      "09:00-10:00",
      "10:00-10:30*",
      "10:30-12:00",
    ]);
  });

  it("start midt i frokost → ingen tom del før", () => {
    const parts = splitAroundLunch("12:10", "14:00", { startTime: "12:00", endTime: "12:30" });
    expect(parts).toEqual([
      { startTime: "12:10", endTime: "12:30", isBreak: true },
      { startTime: "12:30", endTime: "14:00", isBreak: false },
    ]);
  });

  it("grænse-berøring (slut = frokoststart) → ingen split", () => {
    const parts = splitAroundLunch("10:00", "12:00", { startTime: "12:00", endTime: "12:30" });
    expect(parts).toEqual([{ startTime: "10:00", endTime: "12:00", isBreak: false }]);
  });

  it("varigheder pr. del er korrekte (10–14 → 120/30/90)", () => {
    const parts = splitAroundLunch("10:00", "14:00", { startTime: "12:00", endTime: "12:30" });
    const mins = (s: string, e: string) =>
      (parseInt(e.slice(0, 2)) * 60 + parseInt(e.slice(3))) -
      (parseInt(s.slice(0, 2)) * 60 + parseInt(s.slice(3)));
    expect(parts.map((p) => mins(p.startTime, p.endTime))).toEqual([120, 30, 90]);
  });
});

describe("proposeLunchSplit", () => {
  it("foreslår split når tidsrum overlapper frokost (man)", () => {
    expect(proposeLunchSplit(MON, "10:00", "14:00", [])).toEqual({
      startTime: "12:00", endTime: "12:30",
    });
  });

  it("ingen split i weekend", () => {
    expect(proposeLunchSplit(SAT, "10:00", "14:00", [])).toBeNull();
  });

  it("ingen split hvis tidsrum ikke rører frokost", () => {
    expect(proposeLunchSplit(MON, "08:00", "11:00", [])).toBeNull();
  });

  it("undgår dobbelt frokost hvis der allerede findes en pause i frokosten", () => {
    expect(proposeLunchSplit(MON, "10:00", "14:00", [breakEntry("12:00", "12:30")])).toBeNull();
  });
});
