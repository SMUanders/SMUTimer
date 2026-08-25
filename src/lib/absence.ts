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
