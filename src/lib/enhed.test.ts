import { describe, it, expect } from "vitest";
import { enhedVisning, enhedIdent, kortStel, standardEnhed, erMontageKategori } from "./enhed";
import type { SagEnhed } from "./storage/types";

function enhed(over: Partial<SagEnhed> = {}): SagEnhed {
  return {
    enhedId: "e1",
    loebenummer: 3,
    beskrivelse: null,
    regNr: null,
    stelnummer: null,
    trailerNr: null,
    interntNr: null,
    ...over,
  };
}

describe("enhedVisning — samme format som Kapacitet/Pladsliste", () => {
  it("løbenummer + beskrivelse + reg.nr.", () => {
    expect(enhedVisning(enhed({ beskrivelse: "Schmitz trailer", regNr: "AB12345" }))).toBe(
      "#3 · Schmitz trailer · AB12345"
    );
  });
  it("uden beskrivelse: løbenummer + reg.nr.", () => {
    expect(enhedVisning(enhed({ loebenummer: 32, regNr: "GJ2007" }))).toBe("#32 · GJ2007");
  });
  it("uden reg.nr.: langt stelnummer forkortes", () => {
    expect(enhedVisning(enhed({ loebenummer: 5, stelnummer: "WSM00000000999999" }))).toBe("#5 · …00999999");
  });
  it("kun løbenummer, når intet andet er kendt (standardenhed)", () => {
    expect(enhedVisning(enhed({ loebenummer: 1 }))).toBe("#1");
  });
  it("tomme/whitespace-felter ignoreres", () => {
    expect(enhedVisning(enhed({ beskrivelse: "  ", regNr: " " }))).toBe("#3");
  });
});

describe("enhedIdent / kortStel", () => {
  it("reg.nr. vinder over stelnummer", () => {
    expect(enhedIdent(enhed({ regNr: "AB12345", stelnummer: "WSM00000000999999" }))).toBe("AB12345");
  });
  it("kort stelnummer forkortes ikke", () => {
    expect(kortStel("1234567890")).toBe("1234567890");
  });
});

describe("standardEnhed — godkendt standardvalg", () => {
  const én = [enhed({ enhedId: "e1" })];
  const to = [enhed({ enhedId: "e1" }), enhed({ enhedId: "e2", loebenummer: 4 })];

  it("montage + præcis én enhed → forvalgt", () => {
    expect(standardEnhed("montage-ude", én)?.enhedId).toBe("e1");
    expect(standardEnhed("montage-internt", én)?.enhedId).toBe("e1");
  });
  it("montage + flere enheder → intet forvalg (hele sagen, opfordring i UI)", () => {
    expect(standardEnhed("montage-ude", to)).toBeNull();
  });
  it("andre kategorier → altid sagsniveau", () => {
    expect(standardEnhed("tegnestue-grafik", én)).toBeNull();
    expect(standardEnhed("print-og-skaer", én)).toBeNull();
  });
  it("ingen enheder → intet forvalg", () => {
    expect(standardEnhed("montage-ude", [])).toBeNull();
  });
  it("erMontageKategori", () => {
    expect(erMontageKategori("montage-ude")).toBe(true);
    expect(erMontageKategori("salg-administration")).toBe(false);
  });
});
