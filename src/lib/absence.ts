// Ren fravær-logik. Ingen UI, ingen storage — let at teste.
// Fravær tæller ALDRIG som arbejdstid eller pause. Det "dækker" et tidsrum, så
// der ikke fejlagtigt vises hul/mangler i den periode, men reducerer ikke andet.
//
// ÉN autoritativ tilstand: aktivt fravær = ended === null (ude nu). Den effektive
// sluttid til dækning/varighed = ended ?? expectedEnd (faktisk retur når kendt,
// ellers forventet).

import type { Absence } from "../types";
import { toMinutes } from "./time";

/** Er fraværet aktivt (medarbejderen er ude nu)? */
export function isAbsenceActive(a: Absence): boolean {
  return !a.slettet && a.ended === null;
}

/** Effektiv sluttid: faktisk retur hvis kendt, ellers forventet (kan være null). */
export function effectiveEnd(a: Absence): string | null {
  return a.ended ?? a.expectedEnd;
}

/** Ikke-slettede fravær med en kendt (faktisk/forventet) sluttid. */
function withEnd(absences: Absence[]): Array<{ startMin: number; endMin: number }> {
  return absences
    .filter((a) => !a.slettet)
    .map((a) => ({ start: a.startTime, end: effectiveEnd(a) }))
    .filter((iv): iv is { start: string; end: string } => iv.end !== null)
    .map((iv) => ({ startMin: toMinutes(iv.start), endMin: toMinutes(iv.end) }))
    .filter((iv) => iv.endMin > iv.startMin);
}

/**
 * Samlet fraværstid i minutter (kun fravær med kendt sluttid). Bruges til at
 * reducere "mangler"-signalet — fraværet må IKKE tælle som arbejdstid.
 */
export function absenceMinutes(absences: Absence[]): number {
  return withEnd(absences).reduce((sum, iv) => sum + (iv.endMin - iv.startMin), 0);
}

/** Seneste (effektive) fravær-sluttid samme dag (til sammenhængende startforslag). */
export function lastAbsenceEndHHMM(absences: Absence[]): string | null {
  const ends = absences
    .filter((a) => !a.slettet)
    .map(effectiveEnd)
    .filter((e): e is string => e !== null);
  if (ends.length === 0) return null;
  return ends.reduce((max, e) => (toMinutes(e) > toMinutes(max) ? e : max));
}

/** Det aktive fravær (ude nu). Højst ét ad gangen; nyeste vinder hvis flere. */
export function activeAbsence(absences: Absence[]): Absence | null {
  const act = absences.filter(isAbsenceActive);
  if (act.length === 0) return null;
  return act.reduce((newest, a) => (a.updatedAt > newest.updatedAt ? a : newest));
}

/** Et fravær, som det redigeres i fraværseditoren (tom streng = ikke angivet). */
export interface AbsenceDraft {
  absenceType: string;
  startTime: string;
  expectedEnd: string;
  ended: string;
  note: string;
}

/**
 * Validering af et fravær før gem. Returnerer en forståelig fejltekst eller null.
 *  - "Fra" skal være en gyldig tid; "Forventet tilbage" og "Tilbage" er valgfri, men skal
 *    ligge efter "Fra", når de er udfyldt (tom "Tilbage" = stadig væk / åbent fravær).
 *  - Må ikke overlappe arbejdstid eller et andet fravær samme dag.
 */
export function absenceError(
  d: AbsenceDraft,
  entries: { startTime: string; endTime: string; slettet?: boolean }[],
  andreFravaer: Absence[]
): string | null {
  const gyldig = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!gyldig(d.startTime)) return "Angiv hvornår fraværet starter (TT:MM).";
  for (const [felt, navn] of [[d.expectedEnd, "Forventet tilbage"], [d.ended, "Tilbage"]] as const) {
    if (felt === "") continue;
    if (!gyldig(felt)) return `${navn} skal være en tid (TT:MM) eller tom.`;
    if (toMinutes(felt) <= toMinutes(d.startTime)) return `${navn} skal ligge efter "Fra".`;
  }
  // Fraværets tidsrum: til faktisk retur, ellers forventet retur, ellers kun starttidspunktet.
  const s = toMinutes(d.startTime);
  const sl = d.ended || d.expectedEnd;
  const e = sl ? toMinutes(sl) : s + 1;
  const rammer = (a: number, b: number) => s < b && a < e;
  const arbejde = entries.find((x) => !x.slettet && rammer(toMinutes(x.startTime), toMinutes(x.endTime)));
  if (arbejde) return `Fraværet overlapper registreringen ${arbejde.startTime}–${arbejde.endTime}.`;
  const andet = andreFravaer.find((a) => {
    if (a.slettet) return false;
    const as = toMinutes(a.startTime);
    const ae = effectiveEnd(a);
    return rammer(as, ae ? toMinutes(ae) : as + 1);
  });
  if (andet) return `Fraværet overlapper et andet fravær fra ${andet.startTime}.`;
  return null;
}
