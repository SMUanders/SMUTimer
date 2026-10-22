// SMU Tid — enkel segment-logik. Ren og testbar, ingen UI.
//
// Model: man starter noget, afslutter det med BEKRÆFTEDE tider, og vælger så
// næste handling. Medarbejderen kan altid rette de foreslåede tider manuelt.
//
// Regelsæt for tidsforslag (Pakke 1, besluttet af Anders 22. okt. 2026):
//  1. Ét forslag: tidspunktet rundet NED til 5 minutter, ud fra de faktiske tider.
//  2. En sluttid foreslås aldrig efter nu.
//  3. En start foreslås aldrig før seneste sluttid (klampet til nu) → ingen overlap.
//  4. Slut ligger altid efter start: er der under 5 minutter, bruges det faktiske
//     minut, så korte opgaver ikke forsvinder.
//  5. Den start, der vises på kortet, er præcis den start, afslutningen foreslår.
//  6. Hjælp er et stopur med præcise minutter (3 min hjælp = 3 min) og intet minimum.
//
// Alle funktioner tager "nu" som "HH:MM" (lokal tid), så de er tidszone-uafhængige
// at teste.

import type { TimeEntry } from "../types";
import { isBreakCategory } from "../data/categories";
import { durationMinutes, toMinutes, floorTo5 } from "./time";
import { isoToHHMM } from "./currentTaskStart";

export interface FinishTimes {
  startTime: string;
  endTime: string;
}

const m = toMinutes;
const senesteAf = (a: string, b: string) => (m(a) >= m(b) ? a : b);
const tidligsteAf = (a: string, b: string) => (m(a) <= m(b) ? a : b);

/**
 * Seneste sluttid samme dag, men aldrig efter nu. En registrering, der (fejlagtigt)
 * slutter i fremtiden, må ikke skubbe alle senere forslag frem i tiden.
 */
export function lastEndNotAfterNow(lastEndHHMM: string | null | undefined, nowHHMM: string): string | null {
  if (!lastEndHHMM) return null;
  return tidligsteAf(lastEndHHMM, nowHHMM);
}

/**
 * Startforslag: tidspunktet rundet NED til 5 min — aldrig efter nu og aldrig før
 * seneste sluttid (rører forrige linje i stedet for at overlappe den).
 */
export function suggestStart(atHHMM: string, nowHHMM: string, lastEndHHMM?: string | null): string {
  const s = floorTo5(tidligsteAf(atHHMM, nowHHMM));
  const le = lastEndNotAfterNow(lastEndHHMM, nowHHMM);
  return le ? senesteAf(s, le) : s;
}

/**
 * Slutforslag: nu rundet NED til 5 min — aldrig efter nu. Varer opgaven under 5
 * minutter, bruges det faktiske minut, så en kort opgave (fx 3 min) hverken forsvinder
 * eller krymper. Er der ikke gået et helt minut, er slut = start (formen viser det
 * som ugyldigt).
 */
export function suggestEnd(startHHMM: string, nowHHMM: string): string {
  if (m(nowHHMM) - m(startHHMM) < 5) return senesteAf(nowHHMM, startHHMM);
  const f = floorTo5(nowHHMM);
  return m(f) > m(startHHMM) ? f : nowHHMM;
}

/**
 * Den aktive opgaves start — præcis den værdi kortet viser OG afslutningen foreslår.
 * Den gemte start (sat da opgaven startede) bruges uændret; mangler den (fx anden
 * enhed), afledes et forslag af updatedAt. Aldrig før seneste sluttid, aldrig efter nu.
 */
export function activeStartHHMM(
  storedStartIso: string | null,
  fallbackIso: string,
  nowHHMM: string,
  lastEndHHMM?: string | null
): string {
  const base = storedStartIso
    ? tidligsteAf(isoToHHMM(storedStartIso), nowHHMM)
    : suggestStart(isoToHHMM(fallbackIso), nowHHMM);
  const le = lastEndNotAfterNow(lastEndHHMM, nowHHMM);
  return le ? senesteAf(base, le) : base;
}

/**
 * Luk den EGNE opgave ved et skifte (pause/hjælp/omgøring). Returnerer null, hvis der
 * ikke er gået et helt minut — så fabrikeres ingen tom eller baguddateret linje.
 */
export function ownCloseUntil(ownStartHHMM: string, switchHHMM: string): FinishTimes | null {
  if (m(switchHHMM) <= m(ownStartHHMM)) return null;
  return { startTime: ownStartHHMM, endTime: switchHHMM };
}

/** Skiftetidspunkt for pause/omgøring fra en aktiv opgave (5-min-forslag, se suggestEnd). */
export function suggestSwitchAt(ownStartHHMM: string, nowHHMM: string): string {
  return suggestEnd(ownStartHHMM, nowHHMM);
}

/** Hjælp starter på det faktiske minut (stopur), aldrig før seneste sluttid. */
export function helpStartHHMM(nowHHMM: string, lastEndHHMM?: string | null): string {
  const le = lastEndNotAfterNow(lastEndHHMM, nowHHMM);
  return le ? senesteAf(nowHHMM, le) : nowHHMM;
}

/**
 * Hjælp slutter på det faktiske minut — intet minimum, ingen afrunding op.
 * Returnerer null, hvis hjælpen varede under ét minut (ingen hjælp-linje).
 */
export function helpEndHHMM(startHHMM: string, nowHHMM: string): string | null {
  return m(nowHHMM) > m(startHHMM) ? nowHHMM : null;
}

/**
 * Seneste registrerings sluttid samme dag. Slettede linjer ignoreres. Returnerer
 * null, hvis dagen er tom. Ændrer INGEN data — kun grundlag for forslag.
 */
export function lastEntryEndHHMM(entries: TimeEntry[]): string | null {
  const ends = entries.filter((e) => !e.slettet).map((e) => e.endTime);
  if (ends.length === 0) return null;
  return ends.reduce((max, e) => (m(e) > m(max) ? e : max));
}

/** ISO-tidsstempel for i dag på et "HH:MM" (til at gemme en valgt starttid). */
export function hhmmToIsoToday(hhmm: string): string {
  const [h, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h, mm, 0, 0);
  return d.toISOString();
}

/**
 * Forslag til lederens "Afslut opgave": start = opgavens start rundet ned til 5 min,
 * slut = nu efter samme regel (aldrig efter nu, altid efter start når muligt).
 */
export function suggestFinishTimes(startedAtIso: string, nowIso: string): FinishTimes {
  const now = isoToHHMM(nowIso);
  const startTime = suggestStart(isoToHHMM(startedAtIso), now);
  return { startTime, endTime: suggestEnd(startTime, now) };
}

/**
 * Validering af en afslutning, før den gemmes. Returnerer en fejltekst eller null.
 *  - slut skal ligge efter start
 *  - slut må ikke ligge efter nu (kun når registreringen gælder i dag; nowHHMM=null ellers)
 *  - må ikke overlappe en anden (ikke-slettet) registrering samme dag
 */
export function finishError(
  startHHMM: string,
  endHHMM: string,
  nowHHMM: string | null,
  others: TimeEntry[]
): string | null {
  if (m(endHHMM) <= m(startHHMM)) return "Slut skal være efter start.";
  if (nowHHMM && m(endHHMM) > m(nowHHMM)) return `Slut kan ikke ligge efter nu (${nowHHMM}).`;
  const konflikt = others
    .filter((e) => !e.slettet)
    .find((e) => m(startHHMM) < m(e.endTime) && m(e.startTime) < m(endHHMM));
  if (konflikt) return `Overlapper registreringen ${konflikt.startTime}–${konflikt.endTime}. Ret tiderne.`;
  return null;
}

/**
 * Validering af et skiftetidspunkt (fx pausens start): ikke efter nu og ikke før
 * seneste sluttid (ellers overlapper det en tidligere registrering).
 */
export function switchError(atHHMM: string, nowHHMM: string, lastEndHHMM?: string | null): string | null {
  if (m(atHHMM) > m(nowHHMM)) return `Starttiden kan ikke ligge efter nu (${nowHHMM}).`;
  const le = lastEndNotAfterNow(lastEndHHMM, nowHHMM);
  if (le && m(atHHMM) < m(le)) return `Starttiden overlapper seneste registrering, der slutter ${le}.`;
  return null;
}

export interface BuildParams {
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string;
  /** Stabil SMU-sag-reference, hvis valgt. */
  sagId?: string | null;
  sagSmuNummer?: string | null;
  /** Blød reference til OS-enhed (TR-088); null = sagsniveau/intern tid. */
  enhedId?: string | null;
  /** Display-snapshot af enheden ("#3 · beskrivelse · reg.nr"). */
  enhedVisning?: string | null;
  note: string;
  newId: () => string;
  nowIso: string;
  // Omgøring — markeres på selve historik-linjen (eksisterende felter, ingen DB-ændring).
  isRedo?: boolean;
  redoReason?: string | null;
  redoNote?: string;
}

/**
 * Byg en historik-linje med de bekræftede tider. is_break følger kategorien.
 * Slut skal ligge efter start — der lægges ALDRIG stille tid til (det gav tidligere
 * sluttider i fremtiden). Kaldere validerer først; dette er sidste værn.
 */
export function buildEntry(p: BuildParams): TimeEntry {
  const end = p.endTime;
  if (toMinutes(end) <= toMinutes(p.startTime)) {
    throw new Error(`Ugyldigt interval ${p.startTime}–${end}: slut skal være efter start`);
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
    sagId: p.sagId ?? null,
    sagSmuNummer: p.sagSmuNummer ?? null,
    enhedId: p.enhedId ?? null,
    enhedVisning: p.enhedVisning ?? null,
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
