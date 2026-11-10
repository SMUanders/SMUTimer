// Personlige hurtigvalg (Trucking V1) — ren logik.
//
// Den enkelte medarbejders mest brugte aktiviteter de seneste dage bliver til ét-tryks-knapper
// i "Min dag" (start med det samme, aktuel tid). Intet er hardkodet til en person: den, der ofte
// trucker, får "Trucking"; den, der ofte vasker, får "Vask". Kun aktivitet — aldrig sag/enhed,
// som skifter fra gang til gang. Pause, omgøring og hjælp er ikke hurtigvalg (de har egne knapper).

import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, isBreakCategory } from "../data/categories";
import { isHelpNote } from "./helpContext";
import type { FastHurtigvalg } from "./storage/types";

export interface Hurtigvalg {
  categoryId: string;
  subcategoryId: string | null;
  navn: string;
  antal: number;
}

/** Antal dage tilbage, der tælles med. */
export const HURTIGVALG_DAGE = 14;
/** En aktivitet skal være brugt mindst så mange gange for at blive et hurtigvalg. */
export const HURTIGVALG_MIN_ANTAL = 3;
export const HURTIGVALG_MAX = 3;

/**
 * Hurtigvalg ud fra medarbejderens EGNE registreringer (kaldes med allerede afgrænsede rækker).
 * Mest brugte først; ved lige antal den senest brugte først. Frokost-delte dele tælles én gang.
 */
export function hurtigvalg(entries: TimeEntry[], employeeId: string): Hurtigvalg[] {
  const m = new Map<string, Hurtigvalg & { senest: string; grupper: Set<string> }>();
  for (const e of entries) {
    if (e.slettet || e.employeeId !== employeeId || e.isBreak || isBreakCategory(e.categoryId) || e.isRedo) continue;
    if (isHelpNote(e.note)) continue; // hjælp-linjer er ikke egne aktiviteter
    if (!getCategory(e.categoryId)) continue;
    const key = `${e.categoryId}|${e.subcategoryId ?? ""}`;
    let h = m.get(key);
    if (!h) {
      const sub = getSubcategory(e.categoryId, e.subcategoryId);
      h = {
        categoryId: e.categoryId,
        subcategoryId: e.subcategoryId,
        navn: sub?.name ?? getCategory(e.categoryId)!.name,
        antal: 0,
        senest: "",
        grupper: new Set(),
      };
      m.set(key, h);
    }
    const gruppe = e.splitGroupId ?? e.id;
    if (h.grupper.has(gruppe)) continue;
    h.grupper.add(gruppe);
    h.antal++;
    const t = `${e.workDate} ${e.startTime}`;
    if (t > h.senest) h.senest = t;
  }
  return [...m.values()]
    .filter((h) => h.antal >= HURTIGVALG_MIN_ANTAL)
    .sort((a, b) => b.antal - a.antal || b.senest.localeCompare(a.senest))
    .slice(0, HURTIGVALG_MAX)
    .map(({ categoryId, subcategoryId, navn, antal }) => ({ categoryId, subcategoryId, navn, antal }));
}

/** Et hurtigvalg, som det vises: fastgjort (id sat) eller automatisk forslag. */
export interface VistHurtigvalg {
  categoryId: string;
  subcategoryId: string | null;
  navn: string;
  /** Sat for fastgjorte (til "fjern"). */
  fastId: string | null;
}

export const HURTIGVALG_MAX_FASTGJORTE = 8;

const noegle = (c: string, s: string | null) => `${c}|${s ?? ""}`;

/** Navn på en aktivitet fra Tids katalog; null, hvis den ikke (længere) findes. */
export function aktivitetNavn(categoryId: string, subcategoryId: string | null): string | null {
  const cat = getCategory(categoryId);
  if (!cat) return null;
  if (!subcategoryId) return cat.name;
  return getSubcategory(categoryId, subcategoryId)?.name ?? null;
}

/**
 * Fastgjorte først (i den rækkefølge, de blev fastgjort), derefter de automatiske forslag, der ikke
 * allerede er fastgjort — aldrig dubletter. Fastgjorte aktiviteter, der er udgået af kataloget, vises ikke.
 */
export function vistHurtigvalg(fastgjorte: FastHurtigvalg[], forslag: Hurtigvalg[]): { fastgjorte: VistHurtigvalg[]; forslag: VistHurtigvalg[] } {
  const set = new Set<string>();
  const fast: VistHurtigvalg[] = [];
  for (const f of fastgjorte) {
    const navn = aktivitetNavn(f.categoryId, f.subcategoryId);
    const k = noegle(f.categoryId, f.subcategoryId);
    if (!navn || set.has(k)) continue;
    set.add(k);
    fast.push({ categoryId: f.categoryId, subcategoryId: f.subcategoryId, navn, fastId: f.id });
  }
  const fors = forslag
    .filter((h) => !set.has(noegle(h.categoryId, h.subcategoryId)))
    .map((h) => ({ categoryId: h.categoryId, subcategoryId: h.subcategoryId, navn: h.navn, fastId: null }));
  return { fastgjorte: fast, forslag: fors };
}

/** Det fastgjorte hurtigvalg for en aktivitet, hvis den er fastgjort. */
export function fastgjortFor(fastgjorte: FastHurtigvalg[], categoryId: string, subcategoryId: string | null): FastHurtigvalg | null {
  return fastgjorte.find((f) => f.categoryId === categoryId && (f.subcategoryId ?? null) === (subcategoryId ?? null)) ?? null;
}
