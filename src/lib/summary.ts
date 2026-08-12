// Dagsoverblik: registreret arbejdstid, pause, huller, overlap, manglende tid.
// Ren TS, ingen UI.

import type { TimeEntry } from "../types";
import { toMinutes, overlaps, isWeekend } from "./time";
import { isBreakCategory } from "../data/categories";

/**
 * En linje tæller som PAUSE (ikke arbejdstid) hvis den enten er markeret isBreak
 * (auto-frokost-split) ELLER har hovedkategori "Pause" (manuel registrering).
 * Robust mod at isBreak-flaget ikke er sat på ældre/manuelle pause-linjer.
 */
export function isPauseEntry(e: TimeEntry): boolean {
  return e.isBreak || isBreakCategory(e.categoryId);
}

/** Forventet arbejdstid på en hverdag (minutter). 7,5 t = 450 min. */
export const EXPECTED_WORK_MINUTES = 450;

/**
 * Forventet arbejdstid for en given dato. Mandag–fredag = 450 min.
 * Weekend forventer 0 (ingen automatisk forventning om 7,5 t).
 */
export function expectedWorkMinutes(isoDate: string): number {
  return isWeekend(isoDate) ? 0 : EXPECTED_WORK_MINUTES;
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
  gaps: Gap[];
  overlaps: OverlapPair[];
  /** Positiv = der mangler tid ift. forventet arbejdsdag. */
  missingMinutes: number;
}

export function summarizeDay(
  entries: TimeEntry[],
  expectedMinutes = EXPECTED_WORK_MINUTES
): DaySummary {
  const work = entries.filter((e) => !isPauseEntry(e));
  const breaks = entries.filter((e) => isPauseEntry(e));

  const workedMinutes = work.reduce((sum, e) => sum + e.durationMinutes, 0);
  const breakMinutes = breaks.reduce((sum, e) => sum + e.durationMinutes, 0);

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

  // Huller: uregistrerede mellemrum mellem på hinanden følgende linjer
  // (alle linjer inkl. pause tæller som "dækket" tid, så pause laver ikke hul).
  const sorted = [...entries].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );
  const gaps: Gap[] = [];
  let cursor: number | null = null;
  for (const e of sorted) {
    const s = toMinutes(e.startTime);
    const en = toMinutes(e.endTime);
    if (cursor !== null && s > cursor) {
      gaps.push({
        startTime: sorted.length ? minutesToHHMM(cursor) : e.startTime,
        endTime: e.startTime,
        minutes: s - cursor,
      });
    }
    cursor = cursor === null ? en : Math.max(cursor, en);
  }

  const missingMinutes = Math.max(0, expectedMinutes - workedMinutes);

  return { workedMinutes, breakMinutes, gaps, overlaps: overlapPairs, missingMinutes };
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
