// Opsummering af registreret tid på ÉN SMU-sag. Ren, testbar logik — ingen UI,
// ingen datahentning. Hver registrering tælles nøjagtig én gang (ingen dobbeltoptælling).
// Input er allerede filtreret til sagens registreringer (autoritativ sag_id) af storage.

import type { TimeEntry } from "../types";

export interface SagEmployeeGroup {
  employeeId: string;
  minutes: number;
  count: number;
}
export interface SagCategoryGroup {
  categoryId: string;
  subcategoryId: string | null;
  minutes: number;
  count: number;
}
export interface SagSummary {
  totalMinutes: number;
  entryCount: number;
  byEmployee: SagEmployeeGroup[];
  byCategory: SagCategoryGroup[];
}

/**
 * Summér registreret tid på en sag. Slettede linjer tælles ikke med.
 * Alle tid_time_entries er afsluttede registreringer (aktivt arbejde ligger i
 * tid_current_tasks og indgår bevidst IKKE her → holdes adskilt i UI).
 */
export function summarizeSag(entries: TimeEntry[]): SagSummary {
  const live = entries.filter((e) => !e.slettet);
  const totalMinutes = live.reduce((sum, e) => sum + e.durationMinutes, 0);

  const emp = new Map<string, SagEmployeeGroup>();
  for (const e of live) {
    const g = emp.get(e.employeeId) ?? { employeeId: e.employeeId, minutes: 0, count: 0 };
    g.minutes += e.durationMinutes;
    g.count += 1;
    emp.set(e.employeeId, g);
  }

  const cat = new Map<string, SagCategoryGroup>();
  for (const e of live) {
    const key = `${e.categoryId}||${e.subcategoryId ?? ""}`;
    const g =
      cat.get(key) ?? { categoryId: e.categoryId, subcategoryId: e.subcategoryId, minutes: 0, count: 0 };
    g.minutes += e.durationMinutes;
    g.count += 1;
    cat.set(key, g);
  }

  return {
    totalMinutes,
    entryCount: live.length,
    byEmployee: [...emp.values()].sort((a, b) => b.minutes - a.minutes),
    byCategory: [...cat.values()].sort((a, b) => b.minutes - a.minutes),
  };
}
