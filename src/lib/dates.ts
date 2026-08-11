// Delte dato-hjælpere (bruges af dagsseddel og admin). Dato-only strenge
// "YYYY-MM-DD" håndteres tz-sikkert via UTC, så der ikke sker døgn-skæv.

export const WEEKDAYS_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
export const MONTHS_SHORT = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return [y, m, d];
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/** 0=søndag .. 6=lørdag (tz-sikker). */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "tir. 11. aug 2026" */
export function formatDanishDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${WEEKDAYS_SHORT[weekdayIndex(iso)]}. ${d}. ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "11. aug" (uden ugedag/år) — til kompakte cellevisninger. */
export function formatShortDate(iso: string): string {
  const [, m, d] = parts(iso);
  return `${d}. ${MONTHS_SHORT[m - 1]}`;
}

/** Mandagen i samme uge som iso. */
export function mondayOf(iso: string): string {
  const wd = weekdayIndex(iso); // 0 søn .. 6 lør
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(iso, delta);
}

/** Man–fre for ugen som iso indgår i. */
export function workWeek(iso: string): string[] {
  const mon = mondayOf(iso);
  return [0, 1, 2, 3, 4].map((n) => addDays(mon, n));
}

/** ISO-ugenummer (1..53). */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Torsdag i denne uge bestemmer året/ugen.
  const day = (date.getUTCDay() + 6) % 7; // man=0
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}
