// Personlige hurtigvalg (Trucking V1) — ren logik.
//
// Den enkelte medarbejders mest brugte aktiviteter de seneste dage bliver til ét-tryks-knapper
// i "Min dag" (start med det samme, aktuel tid). Intet er hardkodet til en person: den, der ofte
// trucker, får "Trucking"; den, der ofte vasker, får "Vask". Kun aktivitet — aldrig sag/enhed,
// som skifter fra gang til gang. Pause, omgøring og hjælp er ikke hurtigvalg (de har egne knapper).

import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, isBreakCategory } from "../data/categories";
import { isHelpNote } from "./helpContext";

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
