// Rene tids-hjælpere. Ingen UI, ingen afhængigheder — let at teste.
// Tider repræsenteres som "HH:MM" og som minutter-siden-midnat (0..1439).

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(hhmm: string): boolean {
  return TIME_RE.test(hhmm.trim());
}

/** "HH:MM" -> minutter siden midnat. Kaster hvis ugyldig. */
export function toMinutes(hhmm: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) throw new Error(`Ugyldig tid: ${hhmm}`);
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** minutter siden midnat -> "HH:MM" (zero-padded). */
export function toHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Varighed i minutter mellem to tider (slut skal være efter start). */
export function durationMinutes(startTime: string, endTime: string): number {
  return toMinutes(endTime) - toMinutes(startTime);
}

// ----- 15-minutters afrunding (til foreslåede tider; brugeren kan altid rette) -----
export function floorTo15Min(min: number): number {
  return min - ((min % 15) + 15) % 15;
}
export function ceilTo15Min(min: number): number {
  const r = ((min % 15) + 15) % 15;
  return r === 0 ? min : min + (15 - r);
}
/** Rund "HH:MM" NED til nærmeste kvarter (fx 09:07 → 09:00). */
export function floorTo15(hhmm: string): string {
  return toHHMM(floorTo15Min(toMinutes(hhmm)));
}
/** Rund "HH:MM" OP til nærmeste kvarter (fx 10:22 → 10:30). */
export function ceilTo15(hhmm: string): string {
  return toHHMM(ceilTo15Min(toMinutes(hhmm)));
}
/** Rund minutter til NÆRMESTE kvarter (samme regel på start+slut → back-to-back
 *  segmenter rører hinanden i stedet for at overlappe). */
export function roundTo15Min(min: number): number {
  return Math.round(min / 15) * 15;
}
/** Rund "HH:MM" til nærmeste kvarter (fx 09:07 → 09:00, 10:22 → 10:15). */
export function roundTo15(hhmm: string): string {
  return toHHMM(roundTo15Min(toMinutes(hhmm)));
}

// ----- 5-minutters afrunding (til "Hjælp på anden opgave"-stopuret) -----
export function roundTo5Min(min: number): number {
  return Math.round(min / 5) * 5;
}
export function ceilTo5Min(min: number): number {
  const r = ((min % 5) + 5) % 5;
  return r === 0 ? min : min + (5 - r);
}
/** Rund "HH:MM" til nærmeste 5 min (fx 10:33 → 10:35). */
export function roundTo5(hhmm: string): string {
  return toHHMM(roundTo5Min(toMinutes(hhmm)));
}
/** Rund "HH:MM" OP til næste 5 min (fx 10:46 → 10:50, 10:45 → 10:45). */
export function ceilTo5(hhmm: string): string {
  return toHHMM(ceilTo5Min(toMinutes(hhmm)));
}

/** Formatér minutter som "t:mm" til visning, fx 90 -> "1:30". */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}:${String(mm).padStart(2, "0")}`;
}

export interface Interval {
  start: number; // minutter
  end: number; // minutter
}

/** Ægte overlap mellem to intervaller (berøring i endepunkt tæller ikke). */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Antal minutter to intervaller overlapper (0 hvis intet overlap). */
export function overlapMinutes(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Ugedag for "YYYY-MM-DD": 0=søndag .. 6=lørdag. UTC for at undgå tz-skæv. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(isoDate: string): boolean {
  const wd = weekdayOf(isoDate);
  return wd === 0 || wd === 6;
}
