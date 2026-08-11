// Foreslå start/slut for en NY registrering: næste ledige tidspunkt.
// Ren TS, ingen UI.
//
// - Ingen registreringer → dagens start (default 07:30).
// - Ellers første ledige hul fra dagens start: fx 07:30–11:00 findes → 11:00;
//   07:30–09:00 og 10:00–12:00 findes → hullet 09:00–10:00.
// - Sluttid = start + defaultDur, dog aldrig ind i næste registrering eller
//   forbi dagens slut.

import type { TimeEntry } from "../types";
import { toMinutes, toHHMM } from "./time";

export const DAY_START = "07:30";
export const DAY_END = "18:00";
export const DEFAULT_DURATION = 30;

export interface Slot {
  startTime: string;
  endTime: string;
}

export function suggestNextSlot(
  entries: TimeEntry[],
  dayStart = DAY_START,
  dayEnd = DAY_END,
  defaultDur = DEFAULT_DURATION
): Slot {
  const startMin = toMinutes(dayStart);
  const endMin = toMinutes(dayEnd);

  // Optagne intervaller (alle linjer, også pauser) sorteret på start.
  const busy = entries
    .map((e) => ({ start: toMinutes(e.startTime), end: toMinutes(e.endTime) }))
    .sort((a, b) => a.start - b.start);

  let cursor = startMin;
  for (const iv of busy) {
    if (iv.end <= cursor) continue; // helt før cursor
    if (iv.start > cursor) {
      // Første ledige hul [cursor, iv.start] → foreslå hele hullet.
      return slot(cursor, iv.start, endMin, defaultDur);
    }
    // Overlap/tilstødende → ryk cursor forbi denne.
    cursor = Math.max(cursor, iv.end);
  }

  // Ingen efterfølgende registrering → åbent hul, foreslå defaultDur (30 min).
  return slot(cursor, cursor + defaultDur, endMin, defaultDur);
}

function slot(start: number, end: number, dayEnd: number, defaultDur: number): Slot {
  // Hold forslaget inden for dagens slut; sørg for gyldigt interval (slut > start).
  let s = Math.min(start, dayEnd - defaultDur);
  if (s < 0) s = start;
  let e = Math.max(end, s + 1);
  if (e > dayEnd) e = dayEnd;
  if (e <= s) e = s + defaultDur;
  return { startTime: toHHMM(s), endTime: toHHMM(e) };
}
