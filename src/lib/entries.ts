// Samler TimeEntry-objekter ud fra en draft. Håndterer frokost-split ved at
// bruge splitAroundLunch(). id/tidsstempel-fabrikker kan injiceres (test).

import type { EntryDraft, TimeEntry } from "../types";
import { BREAK_CATEGORY_ID, LUNCH_SUBCATEGORY_ID } from "../data/categories";
import { durationMinutes } from "./time";
import { splitAroundLunch, type LunchWindow } from "./lunch";

export interface BuildOptions {
  /** Medarbejderen linjerne tilhører. */
  employeeId: string;
  /** Frokostvindue hvis der skal splittes; ellers null = gem som én linje. */
  lunch: LunchWindow | null;
  newId: () => string;
  now: () => string;
}

/**
 * Byg de linjer der skal gemmes for en draft på en given dato.
 * - lunch == null → én linje (evt. "arbejdede gennem frokost").
 * - lunch != null → op til tre linjer (arbejde / pause / arbejde) med fælles
 *   splitGroupId. Pause-linjen får kategori Pause / Frokost.
 */
export function buildEntries(
  draft: EntryDraft,
  workDate: string,
  opts: BuildOptions
): TimeEntry[] {
  const now = opts.now();

  if (!opts.lunch) {
    return [makeWorkEntry(draft, workDate, draft.startTime, draft.endTime, null, opts, now)];
  }

  const parts = splitAroundLunch(draft.startTime, draft.endTime, opts.lunch);
  // Ingen reel split (fx ramte kun grænsen) → én linje.
  if (parts.length === 1 && !parts[0].isBreak) {
    return [makeWorkEntry(draft, workDate, draft.startTime, draft.endTime, null, opts, now)];
  }

  const splitGroupId = opts.newId();
  return parts.map((p) =>
    p.isBreak
      ? makeBreakEntry(workDate, p.startTime, p.endTime, splitGroupId, opts, now)
      : makeWorkEntry(draft, workDate, p.startTime, p.endTime, splitGroupId, opts, now)
  );
}

function makeWorkEntry(
  draft: EntryDraft,
  workDate: string,
  startTime: string,
  endTime: string,
  splitGroupId: string | null,
  opts: BuildOptions,
  now: string
): TimeEntry {
  return {
    id: opts.newId(),
    employeeId: opts.employeeId,
    workDate,
    startTime,
    endTime,
    durationMinutes: durationMinutes(startTime, endTime),
    categoryId: draft.categoryId,
    subcategoryId: draft.subcategoryId,
    customer: draft.customer.trim(),
    note: draft.note.trim(),
    isBreak: false,
    isRedo: draft.isRedo,
    redoReason: draft.isRedo ? draft.redoReason : null,
    redoNote: draft.isRedo ? draft.redoNote.trim() : "",
    splitGroupId,
    createdAt: now,
    updatedAt: now,
  };
}

function makeBreakEntry(
  workDate: string,
  startTime: string,
  endTime: string,
  splitGroupId: string,
  opts: BuildOptions,
  now: string
): TimeEntry {
  return {
    id: opts.newId(),
    employeeId: opts.employeeId,
    workDate,
    startTime,
    endTime,
    durationMinutes: durationMinutes(startTime, endTime),
    categoryId: BREAK_CATEGORY_ID,
    subcategoryId: LUNCH_SUBCATEGORY_ID,
    customer: "",
    note: "",
    isBreak: true,
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId,
    createdAt: now,
    updatedAt: now,
  };
}
