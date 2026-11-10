import { describe, it, expect } from "vitest";
import { fordelMinutter, fordeling, fordelingTekst, tilfoejEnheder, fjernEnhed, erFordelingsAktivitet, enhedsResume } from "./fordeling";
import type { FordeltEnhed } from "../types";

const e = (id: string, sag = "s1"): FordeltEnhed => ({ enhedId: id, sagId: sag, sagSmuNummer: "SMU-0001", visning: `#${id}` });

describe("Trucking V1 — deterministisk tidsfordeling", () => {
  it("10:00–10:45, tre enheder → 15 / 15 / 15", () => {
    expect(fordelMinutter(45, 3)).toEqual([15, 15, 15]);
  });
  it("rest fordeles på de første enheder i valgt rækkefølge; summen er altid den samlede tid", () => {
    expect(fordelMinutter(45, 4)).toEqual([12, 11, 11, 11]);
    expect(fordelMinutter(10, 3)).toEqual([4, 3, 3]);
    for (const [t, n] of [[1, 3], [7, 7], [59, 4], [480, 13], [0, 2]]) {
      expect(fordelMinutter(t, n).reduce((a, b) => a + b, 0)).toBe(t);
    }
  });
  it("ingen enheder → ingen fordeling", () => {
    expect(fordelMinutter(45, 0)).toEqual([]);
    expect(fordelingTekst(45, [])).toBe("");
  });
  it("fordeling følger enhedernes rækkefølge", () => {
    expect(fordeling(10, [e("a"), e("b"), e("c")]).map((x) => `${x.enhed.enhedId}:${x.minutter}`)).toEqual(["a:4", "b:3", "c:3"]);
  });
  it("kort tekst", () => {
    expect(fordelingTekst(45, [e("a"), e("b"), e("c")])).toBe("3 enheder · 15 min pr. enhed");
    expect(fordelingTekst(10, [e("a"), e("b"), e("c")])).toBe("3 enheder · 3–4 min pr. enhed");
    expect(fordelingTekst(20, [e("a")])).toBe("1 enhed · 20 min pr. enhed");
  });
  it("tilføj uden dubletter, fjern, enheder fra forskellige sager", () => {
    const v = tilfoejEnheder([e("a")], [e("a"), e("b", "s2"), e("c", "s3")]);
    expect(v.map((x) => x.enhedId)).toEqual(["a", "b", "c"]);
    expect(fjernEnhed(v, "b").map((x) => x.enhedId)).toEqual(["a", "c"]);
  });
  it("kompakt oversigt pr. sag", () => {
    const v: FordeltEnhed[] = [
      { enhedId: "1", sagId: "A", sagSmuNummer: "SMU-0043L", visning: "#1 · AD6649" },
      { enhedId: "2", sagId: "B", sagSmuNummer: "SMU-0012L", visning: "#1 · Schmitz" },
      { enhedId: "3", sagId: "A", sagSmuNummer: "SMU-0043L", visning: "#2" },
    ];
    expect(enhedsResume(v)).toBe("SMU-0043L #1 #2 · SMU-0012L #1");
  });
  it("kun Trucking fordeler tid på flere enheder", () => {
    expect(erFordelingsAktivitet("montage-internt__trucking")).toBe(true);
    expect(erFordelingsAktivitet("montage-internt__montering")).toBe(false);
    expect(erFordelingsAktivitet(null)).toBe(false);
  });
});
