// Enhed på tid (TR-088) — ren, testbar logik. Ingen UI, ingen datahentning.
//
// Visningsnavn bygger på formatet fra SMU Kapacitet og SMU Pladsliste ("#N · beskrivelse"),
//   men viser både reg.nr. og stelnummer: "#3 · Schmitz trailer · AB12345 · …00999999" / "#1".
// Løbenummeret står først (OS-identiteten), derefter beskrivelse, reg.nr. og stelnummer
// (forkortet). Kilde til grundformat: smu-kapacitet src/lib/os.ts + src/plan/visning.ts.

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

/**
 * "#3 · Schmitz trailer · AB12345 · …00999999" — gemmes også som snapshot på registreringen.
 * Montørerne identificerer enheder på både reg.nr. og stelnummer (Anders, 20. okt. 2026), så Tid
 * viser BEGGE, når begge findes (Kapacitet viser kun ét). Stelnummeret forkortes til de sidste 8
 * tegn, så linjen kan læses på telefonen; det fulde nummer vises under vælgeren (enhedDetaljer).
 */
export function enhedVisning(e: SagEnhed): string {
  const beskrivelse = e.beskrivelse?.trim();
  const navn = beskrivelse ? `#${e.loebenummer} · ${beskrivelse}` : `#${e.loebenummer}`;
  const reg = e.regNr?.trim() || null;
  const stel = e.stelnummer?.trim() ? kortStel(e.stelnummer) : null;
  return [navn, reg, stel].filter(Boolean).join(" · ");
}

/**
 * Fulde identitetsfelter til kontrol mod enheden (fx stelnummer på typeskiltet).
 * Kun udfyldte felter, i fast rækkefølge.
 */
export function enhedDetaljer(e: SagEnhed): { label: string; vaerdi: string }[] {
  const felter: [string, string | null][] = [
    ["Stelnr.", e.stelnummer],
    ["Reg.nr.", e.regNr],
    ["Trailer-nr.", e.trailerNr],
    ["Internt nr.", e.interntNr],
  ];
  return felter
    .map(([label, v]) => ({ label, vaerdi: v?.trim() ?? "" }))
    .filter((f) => f.vaerdi !== "");
}

/**
 * Standardvalg (godkendt 19. okt. 2026): ved montage forvælges enheden, hvis sagen har
 * PRÆCIS én aktiv enhed. Ellers intet forvalg (= "Hele sagen"), og ved andre kategorier
 * er standarden altid sagsniveau. Enhed er aldrig obligatorisk.
 */
export function standardEnhed(categoryId: string, enheder: SagEnhed[]): SagEnhed | null {
  return erMontageKategori(categoryId) && enheder.length === 1 ? enheder[0] : null;
}
