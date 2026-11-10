import { describe, it, expect } from "vitest";
import { hurtigvalg } from "./hurtigvalg";
import type { TimeEntry } from "../types";

let n = 0;
const e = (o: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
  employeeId: "S",
  workDate: "2026-11-03",
  startTime: "10:00",
  endTime: "10:30",
  durationMinutes: 30,
  categoryId: "montage-internt",
  subcategoryId: "montage-internt__trucking",
  customer: "",
  sagId: null,
  sagSmuNummer: null,
  enhedId: null,
  enhedVisning: null,
  fordelteEnheder: [],
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
});

describe("personlige hurtigvalg", () => {
  it("ofte brugt aktivitet bliver hurtigvalg — ikke hardkodet til en person", () => {
    const rows = [e({}), e({ startTime: "11:00" }), e({ workDate: "2026-11-04" })];
    expect(hurtigvalg(rows, "S")).toEqual([
      { categoryId: "montage-internt", subcategoryId: "montage-internt__trucking", navn: "Trucking", antal: 3 },
    ]);
    expect(hurtigvalg(rows, "andenperson")).toEqual([]);
  });
  it("under 3 gange giver intet hurtigvalg", () => {
    expect(hurtigvalg([e({}), e({})], "S")).toEqual([]);
  });
  it("pause, omgøring, hjælp og slettede tæller ikke", () => {
    const rows = [
      e({ categoryId: "pause", subcategoryId: "pause__frokost", isBreak: true }),
      e({ categoryId: "pause", subcategoryId: "pause__frokost", isBreak: true }),
      e({ categoryId: "pause", subcategoryId: "pause__frokost", isBreak: true }),
      e({ isRedo: true }),
      e({ note: "Hjælp på anden opgave" }),
      e({ slettet: true }),
    ];
    expect(hurtigvalg(rows, "S")).toEqual([]);
  });
  it("frokost-delte dele tælles som én registrering", () => {
    const rows = [e({ splitGroupId: "g" }), e({ splitGroupId: "g" }), e({ splitGroupId: "g" })];
    expect(hurtigvalg(rows, "S")).toEqual([]);
  });
  it("mest brugte først, højst 3", () => {
    const mk = (sub: string, k: number) => Array.from({ length: k }, () => e({ subcategoryId: sub }));
    const rows = [
      ...mk("montage-internt__trucking", 5),
      ...mk("montage-internt__montering", 7),
      ...mk("montage-internt__vask-ekstra", 3),
      ...mk("montage-internt__afmontering", 4),
    ];
    const navne = hurtigvalg(rows, "S").map((h) => h.subcategoryId);
    expect(navne).toEqual(["montage-internt__montering", "montage-internt__trucking", "montage-internt__afmontering"]);
  });
});
