import { describe, it, expect } from "vitest";
import { enhedVisning, enhedValgTekst, enhedDetaljer, kortStel, standardEnhed, erMontageKategori } from "./enhed";
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

describe("enhedVisning — Kapacitet/Pladsliste-format + både reg.nr. og stelnummer", () => {
  it("reg.nr. OG stelnummer vises begge (stel forkortet)", () => {
    expect(
      enhedVisning(enhed({ beskrivelse: "Schmitz trailer", regNr: "AB12345", stelnummer: "WSM00000000999999" }))
    ).toBe("#3 · Schmitz trailer · AB12345 · …00999999");
  });
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

describe("kortStel", () => {
  it("kort stelnummer forkortes ikke", () => {
    expect(kortStel("1234567890")).toBe("1234567890");
  });
});

describe("enhedDetaljer — fulde numre under vælgeren", () => {
  it("fast rækkefølge, fuldt stelnummer, kun udfyldte felter", () => {
    expect(
      enhedDetaljer(enhed({ regNr: "AB12345", stelnummer: "WSM00000000999999", interntNr: " 17 " }))
    ).toEqual([
      { label: "Stelnr.", vaerdi: "WSM00000000999999" },
      { label: "Reg.nr.", vaerdi: "AB12345" },
      { label: "Internt nr.", vaerdi: "17" },
    ]);
  });
  it("alle fire felter", () => {
    expect(
      enhedDetaljer(enhed({ stelnummer: "S1", regNr: "R1", trailerNr: "T1", interntNr: "I1" })).map((d) => d.label)
    ).toEqual(["Stelnr.", "Reg.nr.", "Trailer-nr.", "Internt nr."]);
  });
  it("ingen numre → tom liste", () => {
    expect(enhedDetaljer(enhed({ stelnummer: "  " }))).toEqual([]);
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

describe("enhedValgTekst — vælgerens tekst (vedligeholdelsespakke 2)", () => {
  it("uden beskrivelse: internt nr. og trailer-nr. kommer med", () => {
    expect(enhedValgTekst(enhed({ loebenummer: 1, interntNr: "T-17" }))).toBe("#1 · Internt nr. T-17");
    expect(enhedValgTekst(enhed({ loebenummer: 2, regNr: "AB12345", trailerNr: "889" }))).toBe("#2 · AB12345 · Trailer-nr. 889");
    expect(enhedValgTekst(enhed({ loebenummer: 3, interntNr: "T-1", trailerNr: "889" }))).toBe("#3 · Internt nr. T-1 · Trailer-nr. 889");
  });
  it("med beskrivelse: uændret (som snapshottet)", () => {
    const e = enhed({ beskrivelse: "Schmitz trailer", regNr: "AB12345", interntNr: "T-17" });
    expect(enhedValgTekst(e)).toBe(enhedVisning(e));
  });
  it("uden numre: kun løbenummeret, som før", () => {
    expect(enhedValgTekst(enhed({ loebenummer: 4 }))).toBe("#4");
  });
  it("snapshottet (enhedVisning) er uændret", () => {
    expect(enhedVisning(enhed({ loebenummer: 1, interntNr: "T-17", trailerNr: "889" }))).toBe("#1");
  });
});
