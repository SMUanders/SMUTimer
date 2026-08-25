// Pr. medarbejder pr. dag: nøgletal + status til admin-overblik. Ren TS.

import type { TimeEntry, Absence } from "../types";
import { summarizeDay, expectedWorkMinutes } from "./summary";

export type DayStatus =
  | "fri" // weekend/fridag: forventet = 0
  | "ikke-startet" // hverdag, 0 registreret
  | "delvist" // > 0 men < forventet
  | "udfyldt" // >= forventet, intet overarbejde
  | "overarbejde"; // > forventet

export interface EmployeeDaySummary {
  employeeId: string;
  workedMinutes: number;
  breakMinutes: number;
  absenceMinutes: number;
  absenceTypes: string[];
  expectedMinutes: number;
  missingMinutes: number;
  overtimeMinutes: number;
  status: DayStatus;
  gapsMinutes: number;
  gapsCount: number;
  overlaps: number;
  redoCount: number;
  lastUpdated: string | null;
  hasEntries: boolean;
}

export function employeeDaySummary(
  employeeId: string,
  entries: TimeEntry[],
  isoDate: string,
  absences: Absence[] = []
): EmployeeDaySummary {
  const expected = expectedWorkMinutes(isoDate);
  const s = summarizeDay(entries, expected, absences);
  const worked = s.workedMinutes;
  const overtime = Math.max(0, worked - expected);

  let status: DayStatus;
  if (expected === 0) status = "fri";
  else if (worked === 0) status = "ikke-startet";
  else if (worked > expected) status = "overarbejde";
  else if (worked >= expected) status = "udfyldt";
  else status = "delvist";

  const absenceTypes = [...new Set(absences.filter((a) => !a.slettet).map((a) => a.absenceType))];

  const lastUpdated = entries.reduce<string | null>(
    (max, e) => (max === null || e.updatedAt > max ? e.updatedAt : max),
    null
  );

  return {
    employeeId,
    workedMinutes: worked,
    breakMinutes: s.breakMinutes,
    absenceMinutes: s.absenceMinutes,
    absenceTypes,
    expectedMinutes: expected,
    missingMinutes: s.missingMinutes,
    overtimeMinutes: overtime,
    status,
    gapsMinutes: s.gaps.reduce((sum, g) => sum + g.minutes, 0),
    gapsCount: s.gaps.length,
    overlaps: s.overlaps.length,
    redoCount: entries.filter((e) => e.isRedo).length,
    lastUpdated,
    hasEntries: entries.length > 0,
  };
}

// Status -> label + SMU-designsystem-klasser (ingen rå hex i komponenter).
//  badge = pille i dagsoverblik · cell = flade i ugeceller + legende-swatch.
export const STATUS_META: Record<
  DayStatus,
  { label: string; badge: string; cell: string }
> = {
  udfyldt: { label: "Udfyldt", badge: "smu-badge-green", cell: "wc-udfyldt" },
  overarbejde: { label: "Overarbejde", badge: "smu-badge-blue", cell: "wc-overarbejde" },
  delvist: { label: "Delvist", badge: "smu-badge-orange", cell: "wc-delvist" },
  "ikke-startet": { label: "Ikke startet", badge: "smu-badge-grey", cell: "wc-ikke-startet" },
  fri: { label: "Fri", badge: "smu-badge-grey", cell: "wc-fri" },
};
