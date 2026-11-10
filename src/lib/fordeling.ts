// Trucking V1 — fordeling af ÉN registrerings arbejdstid på flere enheder. Ren logik.
//
// Medarbejderens arbejdstid er altid den ene registrering (fx 10:00–10:45 = 45 min).
// Enhedsfordelingen er underliggende data og AFLEDES deterministisk af registreringens
// varighed og de valgte enheder i den rækkefølge, de blev valgt:
//   hver enhed får floor(T / n) minutter, og de første (T mod n) enheder får 1 minut ekstra,
//   så summen ALTID er lig den samlede registrerede tid.
// Samme regel bruges i databasens læsekontrakter (Planlægning), så tallene altid stemmer.
// Fordelingen gemmes ikke som minutter — den kan derfor aldrig "løbe fra" en rettet tid.

import type { FordeltEnhed } from "../types";

/** Aktiviteter, hvor tiden kan fordeles på flere enheder (i dag kun Trucking). */
export const FORDELINGS_AKTIVITETER = ["montage-internt__trucking"] as const;

export function erFordelingsAktivitet(subcategoryId: string | null | undefined): boolean {
  return !!subcategoryId && (FORDELINGS_AKTIVITETER as readonly string[]).includes(subcategoryId);
}

/** Minutter pr. enhed (i valgt rækkefølge). Summen er altid `total`. */
export function fordelMinutter(total: number, antal: number): number[] {
  if (antal <= 0) return [];
  const t = Math.max(0, Math.floor(total));
  const base = Math.floor(t / antal);
  const rest = t % antal;
  return Array.from({ length: antal }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Enhederne med deres fordelte minutter. */
export function fordeling(total: number, enheder: FordeltEnhed[]): { enhed: FordeltEnhed; minutter: number }[] {
  const m = fordelMinutter(total, enheder.length);
  return enheder.map((enhed, i) => ({ enhed, minutter: m[i] }));
}

/** Kort tekst til tidslinjen: "3 enheder · 15 min pr. enhed" / "3 enheder · 14–15 min". */
export function fordelingTekst(total: number, enheder: FordeltEnhed[]): string {
  if (enheder.length === 0) return "";
  const m = fordelMinutter(total, enheder.length);
  const min = Math.min(...m);
  const max = Math.max(...m);
  const ental = enheder.length === 1 ? "1 enhed" : `${enheder.length} enheder`;
  return min === max ? `${ental} · ${min} min pr. enhed` : `${ental} · ${min}–${max} min pr. enhed`;
}

/** Tilføj enheder uden dubletter (bevarer valgt rækkefølge). */
export function tilfoejEnheder(valgte: FordeltEnhed[], nye: FordeltEnhed[]): FordeltEnhed[] {
  const set = new Set(valgte.map((e) => e.enhedId));
  return [...valgte, ...nye.filter((e) => !set.has(e.enhedId) && set.add(e.enhedId))];
}

export function fjernEnhed(valgte: FordeltEnhed[], enhedId: string): FordeltEnhed[] {
  return valgte.filter((e) => e.enhedId !== enhedId);
}

/** Kompakt oversigt pr. sag: "SMU-0043L #1 #2 · SMU-0012L #1" (valgt rækkefølge bevares). */
export function enhedsResume(enheder: FordeltEnhed[]): string {
  const m = new Map<string, string[]>();
  for (const e of enheder) {
    const sag = e.sagSmuNummer ?? "Uden SMU-nr.";
    const nr = /^#\d+/.exec(e.visning)?.[0] ?? e.visning;
    m.set(sag, [...(m.get(sag) ?? []), nr]);
  }
  return [...m.entries()].map(([sag, nr]) => `${sag} ${nr.join(" ")}`).join(" · ");
}
