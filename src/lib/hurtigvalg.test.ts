import { describe, it, expect, vi } from "vitest";
import { hurtigvalg, vistHurtigvalg, fastgjortFor, aktivitetNavn } from "./hurtigvalg";
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

describe("fastgjorte hurtigvalg", () => {
  const fast = (id: string, sub: string | null, cat = "montage-internt") => ({ id, categoryId: cat, subcategoryId: sub });
  const forslag = [
    { categoryId: "montage-internt", subcategoryId: "montage-internt__trucking", navn: "Trucking", antal: 9 },
    { categoryId: "montage-internt", subcategoryId: "montage-internt__montering", navn: "Montering", antal: 5 },
  ];
  it("fastgjorte først i fastgjort rækkefølge; forslag uden dubletter", () => {
    const v = vistHurtigvalg([fast("a", "montage-internt__vask-ekstra"), fast("b", "montage-internt__trucking")], forslag);
    expect(v.fastgjorte.map((h) => [h.navn, h.fastId])).toEqual([["Vask (ekstra)", "a"], ["Trucking", "b"]]);
    expect(v.forslag.map((h) => h.navn)).toEqual(["Montering"]);
  });
  it("fastgjorte forsvinder ikke, selv uden brug (ingen 14-dages-regel)", () => {
    const v = vistHurtigvalg([fast("a", "uproduktiv-tid__oprydning", "uproduktiv-tid")], []);
    expect(v.fastgjorte.map((h) => h.navn)).toEqual(["Oprydning"]);
  });
  it("udgåede aktiviteter og dubletter vises ikke", () => {
    const v = vistHurtigvalg([fast("a", "montage-internt__findes-ikke"), fast("b", null, "findes-ikke"), fast("c", "montage-internt__trucking"), fast("d", "montage-internt__trucking")], []);
    expect(v.fastgjorte.map((h) => h.fastId)).toEqual(["c"]);
  });
  it("fastgjortFor finder aktiviteten (null-underpunkt håndteres)", () => {
    const l = [fast("a", "montage-internt__trucking"), fast("b", null, "andet")];
    expect(fastgjortFor(l, "montage-internt", "montage-internt__trucking")?.id).toBe("a");
    expect(fastgjortFor(l, "andet", null)?.id).toBe("b");
    expect(fastgjortFor(l, "montage-internt", "montage-internt__montering")).toBeNull();
    expect(aktivitetNavn("andet", null)).toBe("Andet");
  });
});

describe("lokal adapter: hurtigvalg følger medarbejderen", () => {
  it("fastgør, ingen dubletter, fjern, højst 8", async () => {
    const mem: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
    });
    const { localAdapter } = await import("./storage/localAdapter");
    await localAdapter.fastgoerHurtigvalg("S", "montage-internt", "montage-internt__trucking");
    await localAdapter.fastgoerHurtigvalg("S", "montage-internt", "montage-internt__trucking");
    expect(await localAdapter.getFastgjorteHurtigvalg("S")).toHaveLength(1);
    expect(await localAdapter.getFastgjorteHurtigvalg("andenperson")).toEqual([]);
    const [h] = await localAdapter.getFastgjorteHurtigvalg("S");
    await localAdapter.fjernHurtigvalg(h.id);
    expect(await localAdapter.getFastgjorteHurtigvalg("S")).toEqual([]);
    for (let i = 0; i < 8; i++) await localAdapter.fastgoerHurtigvalg("S", "andet", `andet__${i}`);
    await expect(localAdapter.fastgoerHurtigvalg("S", "andet", "andet__9")).rejects.toThrow(/højst have 8/);
    vi.unstubAllGlobals();
  });
});
