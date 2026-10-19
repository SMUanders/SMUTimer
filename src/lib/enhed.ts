// Enhed på tid (TR-088) — ren, testbar logik. Ingen UI, ingen datahentning.
//
// Visningsnavn følger SAMME format som SMU Kapacitet og SMU Pladsliste:
//   "#3 · Schmitz trailer · AB12345" / "#32 · GJ2007" / "#5 · …00999999" / "#1"
// Løbenummeret står først (OS-identiteten), så beskrivelse + kort identitet (reg.nr.,
// ellers stelnummer forkortet). Kilde: smu-kapacitet src/lib/os.ts + src/plan/visning.ts.

import type { SagEnhed } from "./storage/types";

/** Montage er konkret enhedsarbejde (TR-088) → enhed foreslås her. */
export const MONTAGE_KATEGORIER = ["montage-ude", "montage-internt"] as const;

export function erMontageKategori(categoryId: string): boolean {
  return (MONTAGE_KATEGORIER as readonly string[]).includes(categoryId);
}

/** Langt stelnummer forkortes til de sidste 8 tegn ("…00999999"). */
export function kortStel(stel: string): string {
  const s = stel.trim();
  return s.length > 10 ? `…${s.slice(-8)}` : s;
}

/** Kort identitet: reg.nr. → ellers stelnummer (forkortet) → ellers intet. */
export function enhedIdent(e: SagEnhed): string | null {
  if (e.regNr?.trim()) return e.regNr.trim();
  if (e.stelnummer?.trim()) return kortStel(e.stelnummer);
  return null;
}

/** "#3 · Schmitz trailer · AB12345" — gemmes også som snapshot på registreringen. */
export function enhedVisning(e: SagEnhed): string {
  const beskrivelse = e.beskrivelse?.trim();
  const navn = beskrivelse ? `#${e.loebenummer} · ${beskrivelse}` : `#${e.loebenummer}`;
  return [navn, enhedIdent(e)].filter(Boolean).join(" · ");
}

/**
 * Standardvalg (godkendt 19. okt. 2026): ved montage forvælges enheden, hvis sagen har
 * PRÆCIS én aktiv enhed. Ellers intet forvalg (= "Hele sagen"), og ved andre kategorier
 * er standarden altid sagsniveau. Enhed er aldrig obligatorisk.
 */
export function standardEnhed(categoryId: string, enheder: SagEnhed[]): SagEnhed | null {
  return erMontageKategori(categoryId) && enheder.length === 1 ? enheder[0] : null;
}
