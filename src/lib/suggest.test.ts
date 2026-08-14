import { describe, it, expect } from "vitest";
import { suggestNextSlot } from "./suggest";
import type { TimeEntry } from "../types";

function e(start: string, end: string): TimeEntry {
  return {
    id: Math.random().toString(36).slice(2), employeeId: "anders",
    workDate: "2026-08-10", startTime: start, endTime: end, durationMinutes: 0,
    categoryId: "montage-ude", subcategoryId: null, customer: "", note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, slettet: false, createdAt: "", updatedAt: "",
  };
}

describe("suggestNextSlot", () => {
  it("ingen registreringer → dagens start 07:30 (+30)", () => {
    expect(suggestNextSlot([])).toEqual({ startTime: "07:30", endTime: "08:00" });
  });

  it("07:30–11:00 findes → foreslå 11:00–11:30", () => {
    expect(suggestNextSlot([e("07:30", "11:00")])).toEqual({
      startTime: "11:00",
      endTime: "11:30",
    });
  });

  it("hul mellem to blokke foreslås (09:00–10:00)", () => {
    const slot = suggestNextSlot([e("07:30", "09:00"), e("10:00", "12:00")]);
    expect(slot).toEqual({ startTime: "09:00", endTime: "10:00" });
  });

  it("foreslår hele det første ledige hul", () => {
    const slot = suggestNextSlot([e("07:30", "08:00"), e("10:00", "12:00")]);
    expect(slot).toEqual({ startTime: "08:00", endTime: "10:00" });
  });

  it("ignorerer rækkefølge (usorteret input)", () => {
    const slot = suggestNextSlot([e("10:00", "12:00"), e("07:30", "09:00")]);
    expect(slot).toEqual({ startTime: "09:00", endTime: "10:00" });
  });

  it("skæv sluttid rundes til 15-minutters rytme (10:22 → 10:30–11:00)", () => {
    expect(suggestNextSlot([e("07:30", "10:22")])).toEqual({
      startTime: "10:30",
      endTime: "11:00",
    });
  });
});
