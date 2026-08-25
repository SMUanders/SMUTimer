// Dagsoverblik: registreret arbejdstid, pause, huller, overlap, manglende tid.
// Ren TS, ingen UI.

import type { TimeEntry, Absence } from "../types";
import { toMinutes, overlaps, weekdayOf } from "./time";
import { isBreakCategory } from "../data/categories";
import { effectiveEnd } from "./absence";

/**
 * En linje tæller som PAUSE (ikke arbejdstid) hvis den enten er markeret isBreak
 * (auto-frokost-split) ELLER har hovedkategori "Pause" (manuel registrering).
 * Robust mod at isBreak-flaget ikke er sat på ældre/manuelle pause-linjer.
 */
export function isPauseEntry(e: TimeEntry): boolean {
  return e.isBreak || isBreakCategory(e.categoryId);
}

/** Forventet arbejdstid mandag–torsdag (minutter). 7,5 t = 450 min. */
export const EXPECTED_WORK_MINUTES = 450;
/** Forventet arbejdstid fredag (minutter). 7 t = 420 min. */
export const FRIDAY_WORK_MINUTES = 420;

/**
 * Forventet arbejdstid for en given dato:
 *  - mandag–torsdag = 450 min (7,5 t)
 *  - fredag         = 420 min (7 t)
 *  - weekend        = 0 (ingen automatisk forventning)
 */
export function expectedWorkMinutes(isoDate: string): number {
  const wd = weekdayOf(isoDate); // 0=søn .. 6=lør
  if (wd === 0 || wd === 6) return 0; // weekend
  if (wd === 5) return FRIDAY_WORK_MINUTES; // fredag
  return EXPECTED_WORK_MINUTES; // man–tor
}

export interface Gap {
  startTime: string;
  endTime: string;
  minutes: number;
}

export interface OverlapPair {
  a: TimeEntry;
  b: TimeEntry;
}

export interface DaySummary {
  workedMinutes: number;
  breakMinutes: number;
  /** Registreret fravær (tæller ALDRIG som arbejde/pause; dækker sit tidsrum). */
  absenceMinutes: number;
  gaps: Gap[];
  overlaps: OverlapPair[];
  /** Positiv = der mangler tid ift. forventet arbejdsdag (minus fravær). */
  missingMinutes: number;
}

export function summarizeDay(
  entries: TimeEntry[],
  expectedMinutes = EXPECTED_WORK_MINUTES,
  absences: Absence[] = []
): DaySummary {
  const work = entries.filter((e) => !isPauseEntry(e));
  const breaks = entries.filter((e) => isPauseEntry(e));

  const workedMinutes = work.reduce((sum, e) => sum + e.durationMinutes, 0);
  const breakMinutes = breaks.reduce((sum, e) => sum + e.durationMinutes, 0);

  // Fravær med kendt (faktisk/forventet) sluttid: dækker tidsrum + reducerer "mangler".
  const absenceIvs = absences
    .filter((a) => !a.slettet && effectiveEnd(a))
    .map((a) => ({ start: toMinutes(a.startTime), end: toMinutes(effectiveEnd(a) as string) }))
    .filter((iv) => iv.end > iv.start);
  const absenceMinutes = absenceIvs.reduce((sum, iv) => sum + (iv.end - iv.start), 0);

  // Overlap: par af ARBEJDS-linjer der overlapper (pause ekskluderet).
  const overlapPairs: OverlapPair[] = [];
  for (let i = 0; i < work.length; i++) {
    for (let j = i + 1; j < work.length; j++) {
      const a = work[i];
      const b = work[j];
      if (
        overlaps(
          { start: toMinutes(a.startTime), end: toMinutes(a.endTime) },
          { start: toMinutes(b.startTime), end: toMinutes(b.endTime) }
        )
      ) {
        overlapPairs.push({ a, b });
      }
    }
  }

  // Huller: uregistrerede mellemrum mellem på hinanden følgende dækkede tidsrum.
  // Alle linjer inkl. pause OG fravær tæller som "dækket" tid, så hverken pause
  // eller fravær laver hul.
  const covered = [
    ...entries.map((e) => ({ s: toMinutes(e.startTime), en: toMinutes(e.endTime) })),
    ...absenceIvs.map((iv) => ({ s: iv.start, en: iv.end })),
  ].sort((a, b) => a.s - b.s);
  const gaps: Gap[] = [];
  let cursor: number | null = null;
  for (const iv of covered) {
    if (cursor !== null && iv.s > cursor) {
      gaps.push({ startTime: minutesToHHMM(cursor), endTime: minutesToHHMM(iv.s), minutes: iv.s - cursor });
    }
    cursor = cursor === null ? iv.en : Math.max(cursor, iv.en);
  }

  // Fravær reducerer det tidsrum der forventes dækket af arbejde (ikke løn/saldo).
  const missingMinutes = Math.max(0, expectedMinutes - workedMinutes - absenceMinutes);

  return { workedMinutes, breakMinutes, absenceMinutes, gaps, overlaps: overlapPairs, missingMinutes };
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
