import { describe, expect, it } from "vitest";
import { gyldigDato, gyldigOverblikAdresse, overblikSoegning, tolkOverblik } from "./overblikAdresse";

const SAG = "0b6c1f2e-1111-4222-8333-944455556666";
const IDAG = "2026-11-11";

describe("tolkOverblik", () => {
  it("uden parametre: Dag, i dag (som før)", () => {
    expect(tolkOverblik("")).toEqual({ fane: "dag", dato: null, uge: null, sag: null });
  });
  it("OS-deeplinket uden fane åbner fanen Sag (som før)", () => {
    const t = tolkOverblik(`?sag=${SAG}&smu=SMU-0123`);
    expect(t.fane).toBe("sag");
    expect(t.sag).toEqual({ sagId: SAG, smuNummer: "SMU-0123" });
  });
  it("læser fane, dato og uge", () => {
    expect(tolkOverblik("?fane=uge&uge=2026-11-09&dato=2026-11-10")).toEqual({
      fane: "uge",
      dato: "2026-11-10",
      uge: "2026-11-09",
      sag: null,
    });
  });
  it("ugyldige værdier falder sikkert tilbage", () => {
    expect(tolkOverblik("?fane=maaned&dato=2026-02-30&uge=skrald&sag=ikke-et-id")).toEqual({
      fane: "dag",
      dato: null,
      uge: null,
      sag: null,
    });
  });
});

describe("overblikSoegning", () => {
  it("udelader standarden", () => {
    expect(overblikSoegning({ fane: "dag", dato: IDAG, uge: IDAG, sag: null }, IDAG)).toBe("");
    expect(overblikSoegning({ fane: "dag", dato: null, uge: null, sag: null }, IDAG)).toBe("");
  });
  it("skriver fane, dato, uge og sag", () => {
    expect(overblikSoegning({ fane: "dag", dato: "2026-11-10", uge: null, sag: null }, IDAG)).toBe("?dato=2026-11-10");
    expect(overblikSoegning({ fane: "uge", dato: null, uge: "2026-11-04", sag: null }, IDAG)).toBe("?fane=uge&uge=2026-11-04");
    expect(overblikSoegning({ fane: "sag", dato: null, uge: null, sag: { sagId: SAG, smuNummer: "SMU-0123" } }, IDAG)).toBe(
      `?fane=sag&sag=${SAG}&smu=SMU-0123`,
    );
  });
  it("sag uden SMU-nummer skrives uden smu", () => {
    expect(overblikSoegning({ fane: "sag", dato: null, uge: null, sag: { sagId: SAG, smuNummer: null } }, IDAG)).toBe(
      `?fane=sag&sag=${SAG}`,
    );
  });
  it("tur-retur: det skrevne læses som det samme", () => {
    const t = { fane: "uge" as const, dato: "2026-11-10", uge: "2026-11-02", sag: { sagId: SAG, smuNummer: "SMU-0123" } };
    expect(tolkOverblik(overblikSoegning(t, IDAG))).toEqual(t);
  });
});

describe("gyldigDato og gyldigOverblikAdresse", () => {
  it("datoer", () => {
    expect(gyldigDato("2028-02-29")).toBe("2028-02-29");
    expect(gyldigDato("2027-02-29")).toBeNull();
  });
  it("kun Overblikkets egen adresse", () => {
    expect(gyldigOverblikAdresse("/oversigt?fane=uge")).toBe("/oversigt?fane=uge");
    for (const v of [null, "", "/", "/oversigtx", "https://ondt.example/oversigt", "//oversigt"]) {
      expect(gyldigOverblikAdresse(v)).toBe("/oversigt");
    }
  });
});
