// Frokost-split — kernelogik. Ren TS, ingen UI.
//
// Regler (jf. spec):
//  - Man–tor: frokost 12:00–12:30
//  - Fre:     frokost 10:00–10:30
//  - Weekend: ingen auto-frokost/split
//  - Overlapper en registrering standardfrokosten (og der findes ikke allerede
//    en pause i tidsrummet), foreslås split. Standardvalg = ja.
//  - Findes der allerede en pause der dækker frokost, splittes IKKE (undgå
//    dobbelt frokost).
//  - Brugeren kan aktivt vælge "arbejdede gennem frokost / split ikke".

import type { TimeEntry } from "../types";
import { overlaps, toMinutes, toHHMM, type Interval } from "./time";
import { weekdayOf } from "./time";

export interface LunchWindow {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

// weekday: 0=søn .. 6=lør. Let at ændre ét sted.
export const LUNCH_BY_WEEKDAY: Record<number, LunchWindow | null> = {
  0: null, // søndag
  1: { startTime: "12:00", endTime: "12:30" }, // mandag
  2: { startTime: "12:00", endTime: "12:30" },
  3: { startTime: "12:00", endTime: "12:30" },
  4: { startTime: "12:00", endTime: "12:30" },
  5: { startTime: "10:00", endTime: "10:30" }, // fredag
  6: null, // lørdag
};

/** Standardfrokost for en given dato, eller null (weekend). */
export function getLunchWindow(isoDate: string): LunchWindow | null {
  return LUNCH_BY_WEEKDAY[weekdayOf(isoDate)] ?? null;
}

function asInterval(w: { startTime: string; endTime: string }): Interval {
  return { start: toMinutes(w.startTime), end: toMinutes(w.endTime) };
}

/**
 * Afgør om der skal foreslås frokost-split for en ny/redigeret registrering.
 * Returnerer frokostvinduet hvis split skal foreslås, ellers null.
 *
 * @param existing  Dagens eksisterende registreringer (ekskl. den der redigeres).
 */
export function proposeLunchSplit(
  isoDate: string,
  startTime: string,
  endTime: string,
  existing: TimeEntry[]
): LunchWindow | null {
  const lunch = getLunchWindow(isoDate);
  if (!lunch) return null; // weekend / ingen frokost

  const entry = { start: toMinutes(startTime), end: toMinutes(endTime) };
  const lunchIv = asInterval(lunch);
  if (!overlaps(entry, lunchIv)) return null; // rører ikke frokost

  // Findes der allerede en pause der overlapper frokosten? Undgå dobbelt frokost.
  const alreadyHasBreak = existing.some(
    (e) =>
      e.isBreak &&
      overlaps({ start: toMinutes(e.startTime), end: toMinutes(e.endTime) }, lunchIv)
  );
  if (alreadyHasBreak) return null;

  return lunch;
}

/**
 * Skal dagssedlen vise en *forventet* frokost-placeholder?
 * Returnerer frokostvinduet hvis ja, ellers null.
 *
 * Vises kun på frokost-dage (man–fre) hvor INGEN registrering (arbejde eller
 * pause) rører frokost-vinduet — dvs. før man har splittet frokosten ud eller
 * har arbejdet henover frokosten. Rent visuelt: tæller ikke i nogen sum.
 */
export function expectedLunchPlaceholder(
  isoDate: string,
  entries: TimeEntry[]
): LunchWindow | null {
  const lunch = getLunchWindow(isoDate);
  if (!lunch) return null;

  const lunchIv = asInterval(lunch);
  const covered = entries.some((e) =>
    overlaps({ start: toMinutes(e.startTime), end: toMinutes(e.endTime) }, lunchIv)
  );
  return covered ? null : lunch;
}

export interface SplitPart {
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

/**
 * Del et tidsrum op omkring frokostvinduet. Returnerer op til tre dele
 * (arbejde før / pause / arbejde efter) — kun dele med varighed > 0.
 * Pausen er skæringen mellem tidsrummet og frokostvinduet.
 */
export function splitAroundLunch(
  startTime: string,
  endTime: string,
  lunch: LunchWindow
): SplitPart[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const lStart = toMinutes(lunch.startTime);
  const lEnd = toMinutes(lunch.endTime);

  const breakStart = Math.max(start, lStart);
  const breakEnd = Math.min(end, lEnd);

  // Intet ægte overlap → ingen split.
  if (breakStart >= breakEnd) {
    return [{ startTime, endTime, isBreak: false }];
  }

  const parts: SplitPart[] = [];
  if (start < breakStart) {
    parts.push({ startTime: toHHMM(start), endTime: toHHMM(breakStart), isBreak: false });
  }
  parts.push({ startTime: toHHMM(breakStart), endTime: toHHMM(breakEnd), isBreak: true });
  if (breakEnd < end) {
    parts.push({ startTime: toHHMM(breakEnd), endTime: toHHMM(end), isBreak: false });
  }
  return parts;
}
