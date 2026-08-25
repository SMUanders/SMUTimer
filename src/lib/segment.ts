// SMU Tid vNext — enkel segment-logik. Ren og testbar, ingen kæde-/genoptag-logik.
//
// Model: man starter noget, afslutter det med BEKRÆFTEDE tider, og vælger så
// næste handling. Ingen automatisk afrunding der skaber overlap: både start og
// slut foreslås med SAMME nærmeste-kvarter-regel, så back-to-back registreringer
// (fx 09:00–10:00 og 10:00–11:00) rører hinanden i stedet for at overlappe.
//
// Ingen migration: bruger tid_time_entries + tid_current_tasks som de er.

import type { TimeEntry } from "../types";
import { isBreakCategory } from "../data/categories";
import { durationMinutes, toMinutes, toHHMM, roundTo15, roundTo5, ceilTo5 } from "./time";
import { isoToHHMM } from "./currentTaskStart";

export interface FinishTimes {
  startTime: string;
  endTime: string;
}

/** Mindste registrerede hjælpstid i minutter (mini-stopur). */
export const HELP_MIN_MINUTES = 5;

/** Klamp en split-start så den ALDRIG ligger før seneste registrerings sluttid
 *  (systemets default må aldrig selv skabe overlap med en tidligere linje). */
function notBefore(hhmm: string, lastEndHHMM?: string | null): string {
  return lastEndHHMM && toMinutes(lastEndHHMM) > toMinutes(hhmm) ? lastEndHHMM : hhmm;
}

/**
 * "Hjælp på anden opgave" er et mini-stopur med 5-minutters afrunding.
 * Starttidspunktet rundes til nærmeste 5 min, men aldrig før seneste sluttid
 * (så hjælpen rører den forrige linje i stedet for at overlappe den).
 */
export function helpStartHHMM(nowIso: string, lastEndHHMM?: string | null): string {
  return notBefore(roundTo5(isoToHHMM(nowIso)), lastEndHHMM);
}

/**
 * Slut på hjælpen ved ét-tryk-stop: rund OP til næste 5 min, men mindst
 * HELP_MIN_MINUTES efter starten. Egen opgave genoptages fra denne sluttid, så
 * der aldrig er overlap mellem hjælp-linjen og den genoptagede egen-opgave.
 */
export function helpStopEndHHMM(startHHMM: string, nowIso: string): string {
  const startM = toMinutes(startHHMM);
  const rounded = toMinutes(ceilTo5(isoToHHMM(nowIso)));
  return toHHMM(Math.max(rounded, startM + HELP_MIN_MINUTES));
}

/**
 * Luk den EGNE opgave frem til en split-start (hjælp/omgøring). Begge tider er
 * allerede rundet. Returnerer null hvis egen opgave var aktiv under ét interval
 * (slut ≤ start) — så undgår vi at fabrikere en BAGUDDATERET egen-linje, der
 * kunne overlappe en tidligere registrering. Den lille egen-tid absorberes i
 * stedet af den efterfølgende split (hjælp/omgøring rører egen opgave, aldrig overlap).
 */
export function ownCloseUntil(ownStartHHMM: string, splitStartHHMM: string): FinishTimes | null {
  if (toMinutes(splitStartHHMM) <= toMinutes(ownStartHHMM)) return null;
  return { startTime: ownStartHHMM, endTime: splitStartHHMM };
}

/**
 * Luk egen opgave frem til hjælpens start (hjælp bruger 5-min-grid).
 * Startforslag = seneste registrerings sluttid (sammenhængende tidslinje, intet
 * hul), ellers egen opgaves rundede starttid.
 */
export function helpOwnCloseTimes(
  ownStartIso: string,
  helpStartHHMM: string,
  lastEndHHMM?: string | null
): FinishTimes | null {
  return ownCloseUntil(lastEndHHMM ?? roundTo5(isoToHHMM(ownStartIso)), helpStartHHMM);
}

/** Omgøringens starttidspunkt: nærmeste kvarter (15-min-grid), men aldrig før
 *  seneste sluttid (rører forrige linje, aldrig overlap). */
export function redoStartHHMM(nowIso: string, lastEndHHMM?: string | null): string {
  return notBefore(roundTo15(isoToHHMM(nowIso)), lastEndHHMM);
}

/** Luk egen opgave frem til omgøringens start (15-min-grid). Startforslag =
 *  seneste registrerings sluttid (sammenhængende), ellers rundet egen-start. */
export function redoOwnCloseTimes(
  ownStartIso: string,
  redoStart: string,
  lastEndHHMM?: string | null
): FinishTimes | null {
  return ownCloseUntil(lastEndHHMM ?? roundTo15(isoToHHMM(ownStartIso)), redoStart);
}

/**
 * Seneste registrerings sluttid samme dag (til "sammenhængende" startforslag).
 * Slettede linjer ignoreres. Returnerer null hvis dagen er tom → brug eksisterende
 * første-start-logik i stedet. Ændrer INGEN data — kun et forslag.
 */
export function lastEntryEndHHMM(entries: TimeEntry[]): string | null {
  const ends = entries.filter((e) => !e.slettet).map((e) => e.endTime);
  if (ends.length === 0) return null;
  return ends.reduce((max, e) => (toMinutes(e) > toMinutes(max) ? e : max));
}

/** ISO-tidsstempel for i dag på et "HH:MM" (til at gemme en valgt starttid). */
export function hhmmToIsoToday(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Foreslå bekræftelses-tider: rund start OG slut til NÆRMESTE kvarter (samme
 * regel → ingen kæde-overlap). Brugeren kan altid rette dem i afslut-flowet.
 */
export function suggestFinishTimes(startedAtIso: string, nowIso: string): FinishTimes {
  const startTime = roundTo15(isoToHHMM(startedAtIso));
  let endTime = roundTo15(isoToHHMM(nowIso));
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    endTime = toHHMM(toMinutes(startTime) + 15);
  }
  return { startTime, endTime };
}

export interface BuildParams {
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string;
  note: string;
  newId: () => string;
  nowIso: string;
  // Omgøring — markeres på selve historik-linjen (eksisterende felter, ingen DB-ændring).
  isRedo?: boolean;
  redoReason?: string | null;
  redoNote?: string;
}

/** Byg en historik-linje med de bekræftede tider. is_break følger kategorien. */
export function buildEntry(p: BuildParams): TimeEntry {
  let end = p.endTime;
  if (toMinutes(end) <= toMinutes(p.startTime)) {
    end = toHHMM(toMinutes(p.startTime) + 15);
  }
  const isRedo = p.isRedo ?? false;
  return {
    id: p.newId(),
    employeeId: p.employeeId,
    workDate: p.workDate,
    startTime: p.startTime,
    endTime: end,
    durationMinutes: durationMinutes(p.startTime, end),
    categoryId: p.categoryId,
    subcategoryId: p.subcategoryId,
    customer: p.orderNumber.trim(),
    note: p.note.trim(),
    isBreak: isBreakCategory(p.categoryId),
    isRedo,
    redoReason: isRedo ? p.redoReason ?? null : null,
    redoNote: isRedo ? (p.redoNote ?? "").trim() : "",
    splitGroupId: null,
    slettet: false,
    createdAt: p.nowIso,
    updatedAt: p.nowIso,
  };
}

/**
 * KUN nøjagtig dublet blokeres (samme medarbejder + start + slut + kategori/
 * underpunkt + ordre/sag). Ingen generel overlap-blokering — gamle konflikter/
 * testdata må ikke lamme fremadrettet registrering.
 */
export function isExactDuplicate(entry: TimeEntry, existing: TimeEntry[]): boolean {
  return existing
    .filter((e) => !e.slettet)
    .some(
      (e) =>
        e.employeeId === entry.employeeId &&
        e.startTime === entry.startTime &&
        e.endTime === entry.endTime &&
        e.categoryId === entry.categoryId &&
        e.subcategoryId === entry.subcategoryId &&
        (e.customer ?? "") === (entry.customer ?? "")
    );
}
