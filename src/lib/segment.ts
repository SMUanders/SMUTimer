// SMU Tid — enkel segment-logik. Ren og testbar, ingen UI.
//
// SMU Tid er manuel arbejdstidsregistrering, ikke et stempelur (Pakke 1.1, Anders 23. okt.
// 2026). Medarbejderen afslutter med frit valgte tider; systemet foreslår kun.
//
// Regelsæt:
//  1. Forslag: faktiske tider rundet NED til 5 min. Et forslag ligger aldrig efter nu —
//     undtagen når starten selv ligger efter nu (se 2); så foreslås næste 5-minutters
//     tidspunkt efter starten. Medarbejderens manuelle tider har forrang — også en sluttid
//     efter nu (til og med 23:59).
//  2. Næste opgave foreslås fra seneste registrerede sluttid, også når den ligger efter nu.
//  3. Slut ligger altid efter start; varer noget under 5 min, bruges de faktiske minutter.
//  4. Den start, kortet viser, er præcis den start, afslutningen foreslår.
//  5. Faktiske pauser, hjælp og omgøring forskydes ALDRIG automatisk. Rammer de ind i en
//     registrering, der slutter senere, vises en konflikt, og medarbejderen vælger selv:
//     afkort forrige registrering, start fra den registrerede sluttid, eller annuller.
//  6. Overlap med andre registreringer afvises ved gem. Intet ændres automatisk.
//  7. Hjælp er et stopur med præcise minutter og intet minimum.
//
// Alle funktioner tager "nu" som "HH:MM" (lokal tid), så de er tidszone-uafhængige at teste.

import type { TimeEntry } from "../types";
import { isBreakCategory } from "../data/categories";
import { durationMinutes, toMinutes, toHHMM, floorTo5, ceilTo5Min } from "./time";
import { isoToHHMM } from "./currentTaskStart";

export interface FinishTimes {
  startTime: string;
  endTime: string;
}

/** Seneste mulige sluttid på registreringsdagen. */
export const DAGENS_SIDSTE = "23:59";

const m = toMinutes;
const senesteAf = (a: string, b: string) => (m(a) >= m(b) ? a : b);
const tidligsteAf = (a: string, b: string) => (m(a) <= m(b) ? a : b);

/**
 * Startforslag: tidspunktet rundet NED til 5 min (aldrig efter nu), men aldrig før
 * seneste registrerede sluttid — heller ikke når den ligger efter nu (løsning A).
 */
export function suggestStart(atHHMM: string, nowHHMM: string, lastEndHHMM?: string | null): string {
  const s = floorTo5(tidligsteAf(atHHMM, nowHHMM));
  return lastEndHHMM ? senesteAf(s, lastEndHHMM) : s;
}

/**
 * Slutforslag: nu rundet NED til 5 min. Varer opgaven under 5 minutter, bruges det
 * faktiske minut, så en kort opgave hverken forsvinder eller krymper. Ligger starten
 * efter nu (næste opgave efter en registrering, der slutter senere), foreslås næste
 * 5-minutters tidspunkt efter starten. Er der ikke gået et helt minut, er slut = start.
 */
export function suggestEnd(startHHMM: string, nowHHMM: string): string {
  if (m(nowHHMM) < m(startHHMM)) {
    if (m(startHHMM) >= m(DAGENS_SIDSTE)) return startHHMM;
    // Regn i minutter, så et forslag tæt på midnat ikke ruller over til 00:00.
    return toHHMM(Math.min(ceilTo5Min(m(startHHMM) + 1), m(DAGENS_SIDSTE)));
  }
  if (m(nowHHMM) - m(startHHMM) < 5) return nowHHMM;
  const f = floorTo5(nowHHMM);
  return m(f) > m(startHHMM) ? f : nowHHMM;
}

/**
 * Den aktive opgaves start — præcis den værdi kortet viser OG afslutningen foreslår.
 * Den gemte start (sat da opgaven startede) bruges uændret; mangler den (fx anden
 * enhed), afledes et forslag af updatedAt. Aldrig før seneste registrerede sluttid.
 */
export function activeStartHHMM(
  storedStartIso: string | null,
  fallbackIso: string,
  nowHHMM: string,
  lastEndHHMM?: string | null
): string {
  const base = storedStartIso ? isoToHHMM(storedStartIso) : suggestStart(isoToHHMM(fallbackIso), nowHHMM);
  return lastEndHHMM ? senesteAf(base, lastEndHHMM) : base;
}

/**
 * Luk den EGNE opgave ved et skifte (pause/hjælp/omgøring). Returnerer null, hvis der
 * ikke er gået et helt minut (eller opgavens start ligger efter skiftet) — så fabrikeres
 * ingen tom eller baguddateret linje.
 */
export function ownCloseUntil(ownStartHHMM: string, switchHHMM: string): FinishTimes | null {
  if (m(switchHHMM) <= m(ownStartHHMM)) return null;
  return { startTime: ownStartHHMM, endTime: switchHHMM };
}

/**
 * Faktisk skiftetidspunkt for pause/omgøring fra en aktiv opgave: 5-min-forslag efter
 * opgavens start. Er opgavens start endnu ikke nået, er skiftet det faktiske minut —
 * aldrig forskudt.
 */
export function suggestSwitchAt(ownStartHHMM: string, nowHHMM: string): string {
  return m(nowHHMM) > m(ownStartHHMM) ? suggestEnd(ownStartHHMM, nowHHMM) : nowHHMM;
}

/** Hjælp starter på det faktiske minut (stopur) — aldrig forskudt. */
export function helpStartHHMM(nowHHMM: string): string {
  return nowHHMM;
}

/**
 * Hjælp slutter på det faktiske minut — intet minimum, ingen afrunding.
 * Har medarbejderen selv valgt at starte hjælpen fra en senere registreret sluttid,
 * placeres den faktiske varighed (`faktiskeMinutter`) efter den valgte start.
 * Returnerer null, hvis hjælpen varede under ét minut (ingen hjælp-linje).
 */
export function helpEndHHMM(startHHMM: string, nowHHMM: string, faktiskeMinutter?: number): string | null {
  if (m(nowHHMM) > m(startHHMM)) return nowHHMM;
  if (faktiskeMinutter === undefined || faktiskeMinutter < 1) return null;
  const slut = Math.min(m(startHHMM) + faktiskeMinutter, m(DAGENS_SIDSTE));
  return slut > m(startHHMM) ? toHHMM(slut) : null;
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

/** Dagens seneste registrering (højeste sluttid) — samme definition som databasen bruger. */
export function senesteRegistrering(entries: TimeEntry[]): TimeEntry | null {
  const aktive = entries.filter((e) => !e.slettet);
  if (aktive.length === 0) return null;
  return aktive.reduce((a, b) => (m(b.endTime) > m(a.endTime) ? b : a));
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
 * slut = nu efter samme regel.
 */
export function suggestFinishTimes(startedAtIso: string, nowIso: string): FinishTimes {
  const now = isoToHHMM(nowIso);
  const startTime = suggestStart(isoToHHMM(startedAtIso), now);
  return { startTime, endTime: suggestEnd(startTime, now) };
}

/** Første ikke-slettede registrering, som intervallet overlapper, eller null. */
export function findOverlap(startHHMM: string, endHHMM: string, others: TimeEntry[]): TimeEntry | null {
  return (
    others.filter((e) => !e.slettet).find((e) => m(startHHMM) < m(e.endTime) && m(e.startTime) < m(endHHMM)) ?? null
  );
}

/**
 * Validering af en afslutning, før den gemmes. Returnerer en fejltekst eller null.
 * Slut må gerne ligge efter nu (manuel registrering), men skal ligge efter start og
 * må ikke overlappe en anden (ikke-slettet) registrering samme dag.
 */
export function finishError(startHHMM: string, endHHMM: string, others: TimeEntry[]): string | null {
  if (m(endHHMM) <= m(startHHMM)) return "Slut skal være efter start.";
  const o = findOverlap(startHHMM, endHHMM, others);
  if (o) return `Overlapper registreringen ${o.startTime}–${o.endTime}.`;
  return null;
}

/**
 * Konflikt: en aktivitet, der starter `tidspunkt`, rammer ind i dagens seneste
 * registrering (eller fravær), som slutter senere. Medarbejderen vælger selv løsningen.
 *  - `afkort`: den registrering, der må afkortes til `tidspunkt` — kun dagens seneste,
 *    ikke delt omkring frokost, startet før `tidspunkt`, og ingen anden registrering
 *    rækker ud over `tidspunkt` (samme afgrænsning som databasefunktionen).
 *  - `registreretSlut`: alternativet "start fra den registrerede sluttid".
 */
export interface Konflikt {
  tidspunkt: string;
  registreretSlut: string;
  afkort: TimeEntry | null;
}

export function konfliktVed(tidspunkt: string, entries: TimeEntry[], lastEndHHMM: string | null): Konflikt | null {
  if (!lastEndHHMM || m(tidspunkt) >= m(lastEndHHMM)) return null;
  const seneste = senesteRegistrering(entries);
  const kanAfkorte =
    !!seneste &&
    seneste.endTime === lastEndHHMM &&
    !seneste.splitGroupId &&
    m(seneste.startTime) < m(tidspunkt) &&
    entries.every((e) => e.slettet || e.id === seneste.id || m(e.endTime) <= m(tidspunkt));
  return { tidspunkt, registreretSlut: lastEndHHMM, afkort: kanAfkorte ? seneste : null };
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
