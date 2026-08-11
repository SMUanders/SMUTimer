// Pr. medarbejder pr. dag: nøgletal + status til admin-overblik. Ren TS.

import type { TimeEntry } from "../types";
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
  isoDate: string
): EmployeeDaySummary {
  const expected = expectedWorkMinutes(isoDate);
  const s = summarizeDay(entries, expected);
  const worked = s.workedMinutes;
  const overtime = Math.max(0, worked - expected);

  let status: DayStatus;
  if (expected === 0) status = "fri";
  else if (worked === 0) status = "ikke-startet";
  else if (worked > expected) status = "overarbejde";
  else if (worked >= expected) status = "udfyldt";
  else status = "delvist";

  const lastUpdated = entries.reduce<string | null>(
    (max, e) => (max === null || e.updatedAt > max ? e.updatedAt : max),
    null
  );

  return {
    employeeId,
    workedMinutes: worked,
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

// Status -> label + farver (SMU-palette). Bruges af både dag- og ugeoverblik.
export const STATUS_META: Record<
  DayStatus,
  { label: string; fg: string; bg: string }
> = {
  udfyldt: { label: "Udfyldt", fg: "#ffffff", bg: "#006140" }, // grøn
  overarbejde: { label: "Overarbejde", fg: "#ffffff", bg: "#2e9bd4" }, // blå
  delvist: { label: "Delvist", fg: "#5a4300", bg: "#ffd874" }, // gul/amber
  "ikke-startet": { label: "Ikke startet", fg: "#4a5568", bg: "#e3e6eb" }, // grå
  fri: { label: "Fri", fg: "#6b7688", bg: "#f0f2f5" }, // neutral
};
