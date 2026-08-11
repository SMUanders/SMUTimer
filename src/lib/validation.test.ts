import { describe, it, expect } from "vitest";
import { validateEntry } from "./validation";
import type { TimeEntry } from "../types";

function entry(start: string, end: string): TimeEntry {
  return {
    id: "x", employeeId: "anders", workDate: "2026-08-10", startTime: start, endTime: end,
    durationMinutes: 0, categoryId: "montage-ude", subcategoryId: null, customer: "", note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, createdAt: "", updatedAt: "",
  };
}

describe("validateEntry", () => {
  it("blokerer når slut ≤ start", () => {
    const r = validateEntry("12:00", "12:00", "montage-ude", []);
    expect(r.errors).toContain("Sluttid skal være efter starttid.");
  });

  it("blokerer ugyldig tid", () => {
    const r = validateEntry("25:00", "26:00", "montage-ude", []);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("gyldigt tidsrum uden overlap: ingen fejl/advarsel", () => {
    const r = validateEntry("08:00", "12:00", "montage-ude", [entry("13:00", "14:00")]);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("overlap BLOKERER med tydelig fejl", () => {
    const r = validateEntry("08:00", "12:00", "montage-ude", [entry("11:00", "13:00")]);
    expect(r.errors).toContain("Der er allerede registreret tid i dette tidsrum.");
  });
});
