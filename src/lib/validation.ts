// Basisvalidering af en registrering. Ren TS.
//
//  - Sluttid skal være efter starttid (blokerende fejl).
//  - Start- og sluttid skal være gyldige tider (blokerende fejl).
//  - Overlap med eksisterende linjer for samme medarbejder/dato: BLOKÉR.
//    (Omgøring er et tilvalg på en linje — ikke en separat overlappende linje —
//     så vi behøver ikke tillade overlap.)

import type { TimeEntry } from "../types";
import { isValidTime, toMinutes, overlaps } from "./time";

export interface ValidationResult {
  /** Blokerende fejl — gem skal forhindres. */
  errors: string[];
  /** Ikke-blokerende advarsler — gem er tilladt. */
  warnings: string[];
}

export function validateEntry(
  startTime: string,
  endTime: string,
  categoryId: string,
  existing: TimeEntry[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startOk = isValidTime(startTime);
  const endOk = isValidTime(endTime);
  if (!startOk) errors.push("Starttid er ugyldig (brug HH:MM).");
  if (!endOk) errors.push("Sluttid er ugyldig (brug HH:MM).");

  if (!categoryId) errors.push("Vælg en kategori.");

  if (startOk && endOk) {
    const s = toMinutes(startTime);
    const e = toMinutes(endTime);
    if (e <= s) {
      errors.push("Sluttid skal være efter starttid.");
    } else {
      const iv = { start: s, end: e };
      const clash = existing.some((x) =>
        overlaps(iv, { start: toMinutes(x.startTime), end: toMinutes(x.endTime) })
      );
      if (clash) {
        errors.push("Der er allerede registreret tid i dette tidsrum.");
      }
    }
  }

  return { errors, warnings };
}

export function hasBlockingError(result: ValidationResult): boolean {
  return result.errors.length > 0;
}
