import { describe, it, expect } from "vitest";
import { filtrerPladsEnheder, grupperPaaSag, tilFordeltEnhed, kortEtiket, normaliser } from "./pladsEnheder";
import type { PladsEnhed } from "./storage/types";

const p = (id: string, sag: string, smu: string, loeb: number, o: Partial<PladsEnhed> = {}): PladsEnhed => ({
  enhedId: id,
  sagId: sag,
  smuNummer: smu,
  sagTitel: "Titel",
  kunde: "Kunde",
  loebenummer: loeb,
  beskrivelse: null,
  regNr: null,
  stelnummer: null,
  trailerNr: null,
  interntNr: null,
  zone: null,
  ...o,
});

const rows = [
  p("a1", "A", "SMU-0043L", 2, { regNr: "AD8204" }),
  p("a2", "A", "SMU-0043L", 1, { regNr: "AD6649", stelnummer: "WDB9634031L123456" }),
  p("b1", "B", "SMU-0012L", 1, { beskrivelse: "Schmitz trailer", regNr: "CH 63 64", interntNr: "T-17" }),
];

describe("Trucking V1 — søgning blandt enheder på pladsen", () => {
  it("tom søgning viser hele pladsen", () => {
    expect(filtrerPladsEnheder(rows, "  ")).toHaveLength(3);
  });
  it("SMU-nummer viser sagens enheder (uden præfiks og bindestreg)", () => {
    expect(filtrerPladsEnheder(rows, "0043").map((r) => r.enhedId)).toEqual(["a1", "a2"]);
    expect(filtrerPladsEnheder(rows, "smu 0043l")).toHaveLength(2); // to ord — begge skal passe
    expect(filtrerPladsEnheder(rows, "smu-0043l").map((r) => r.enhedId)).toEqual(["a1", "a2"]);
  });
  it("reg.nr., stelnummer, internt nr. og beskrivelse — normaliseret", () => {
    expect(filtrerPladsEnheder(rows, "ch6364").map((r) => r.enhedId)).toEqual(["b1"]);
    expect(filtrerPladsEnheder(rows, "L123456").map((r) => r.enhedId)).toEqual(["a2"]);
    expect(filtrerPladsEnheder(rows, "t17").map((r) => r.enhedId)).toEqual(["b1"]);
    expect(filtrerPladsEnheder(rows, "schmitz").map((r) => r.enhedId)).toEqual(["b1"]);
  });
  it("#løbenummer kombineret med SMU-nummer", () => {
    expect(filtrerPladsEnheder(rows, "0043 #1").map((r) => r.enhedId)).toEqual(["a2"]);
  });
  it("intet træf → tom liste", () => {
    expect(filtrerPladsEnheder(rows, "XX9999")).toEqual([]);
  });
  it("normalisering", () => {
    expect(normaliser(" ab 12-345 ")).toBe("AB12345");
  });
});

describe("gruppering og snapshot", () => {
  it("grupperer pr. sag, enheder efter løbenummer", () => {
    const g = grupperPaaSag(rows);
    expect(g.map((x) => x.smuNummer)).toEqual(["SMU-0043L", "SMU-0012L"]);
    expect(g[0].enheder.map((r) => r.loebenummer)).toEqual([1, 2]);
  });
  it("snapshot bærer sag og visning (historik bevares, når enheden forlader pladsen)", () => {
    const f = tilFordeltEnhed(rows[1]);
    expect(f).toEqual({ enhedId: "a2", sagId: "A", sagSmuNummer: "SMU-0043L", visning: "#1 · AD6649 · …1L123456" });
    expect(kortEtiket(f)).toBe("SMU-0043L #1 · AD6649 · …1L123456");
    expect(kortEtiket(tilFordeltEnhed(rows[2]))).toBe("SMU-0012L #1 · Schmitz trailer · CH 63 64");
  });
});
