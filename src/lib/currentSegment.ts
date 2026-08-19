// Segment-logik for medarbejderflow v2 (ren, testbar — ingen UI, ingen store).
//
// Model: det AKTIVE segment = den nuværende opgave (arbejde eller pause) med et
// starttidspunkt. Hver handling LUKKER det aktive segment til en historik-linje
// (time entry) og sætter næste tilstand. Reduceren nedenfor er ren: den beslutter
// HVAD der skal ske; en tynd wrapper i UI'et skriver til storage.
//
// Ingen migration: starttidspunktet kommer fra currentTaskStart (localStorage).

import type { TimeEntry, CurrentTask } from "../types";
import { BREAK_CATEGORY_ID, LUNCH_SUBCATEGORY_ID, isBreakCategory } from "../data/categories";
import { durationMinutes, floorTo15, ceilTo15, toMinutes, toHHMM, overlapMinutes } from "./time";
import { isoToHHMM } from "./currentTaskStart";

/** Felter medarbejderen udfylder for en opgave. */
export interface SegmentDraft {
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string; // ordre / sag / kunde (fri tekst i v2)
  note: string;
}

export interface SegmentState {
  task: CurrentTask | null;
  startedAtIso: string | null;
}

export type SegmentAction =
  | { type: "start"; draft: SegmentDraft } // idle → arbejde
  | { type: "switch"; draft: SegmentDraft } // luk nuværende + start ny arbejde
  | { type: "pause" } // luk arbejde + start pause
  | { type: "resume"; draft: SegmentDraft } // luk pause + genoptag arbejde
  | { type: "close" }; // "Afslut opgave": luk nuværende + ryd (ingen aktiv opgave)

export interface SegmentResult {
  /** Historik-linje der skal oprettes (eller null hvis intet lukkes). */
  entry: TimeEntry | null;
  /** Ny aktuel opgave (eller null = ryddet). */
  nextTask: CurrentTask | null;
  /** Nyt starttidspunkt for det nye segment (eller null). */
  nextStartIso: string | null;
}

interface Ctx {
  employeeId: string;
  nowIso: string;
  workDate: string;
  newId: () => string;
}

/**
 * Byg en historik-linje for en opgave med EKSPLICITTE tider (fx bekræftet/rettet
 * i afslut-flowet). Sikrer slut > start. is_break sættes ud fra kategorien.
 */
export function entryFromTimes(
  task: CurrentTask,
  startTime: string,
  endTime: string,
  ctx: Ctx
): TimeEntry {
  let end = endTime;
  if (toMinutes(end) <= toMinutes(startTime)) {
    end = toHHMM(toMinutes(startTime) + 15); // minimum ét kvarter
  }
  return {
    id: ctx.newId(),
    employeeId: ctx.employeeId,
    workDate: ctx.workDate,
    startTime,
    endTime: end,
    durationMinutes: durationMinutes(startTime, end),
    categoryId: task.categoryId,
    subcategoryId: task.subcategoryId,
    customer: task.orderNumber ?? "",
    note: task.note ?? "",
    isBreak: isBreakCategory(task.categoryId),
    isRedo: false,
    redoReason: null,
    redoNote: "",
    splitGroupId: null,
    slettet: false,
    createdAt: ctx.nowIso,
    updatedAt: ctx.nowIso,
  };
}

/**
 * Byg en historik-linje fra et lukket segment.
 * Start rundes NED, slut rundes OP til nærmeste kvarter (leder kan korrigere).
 */
export function closeSegmentToEntry(
  task: CurrentTask,
  startedAtIso: string,
  ctx: Ctx
): TimeEntry {
  return entryFromTimes(
    task,
    floorTo15(isoToHHMM(startedAtIso)),
    ceilTo15(isoToHHMM(ctx.nowIso)),
    ctx
  );
}

// Grænse-overlap fra kvarter-afrunding: to på hinanden følgende segmenter kan i
// normalflow overlappe med op til ét kvarter (ceil(t) − floor(t) ≤ 15). Kun
// overlap UD OVER dette betragtes som en ægte dublet/dobbeltluk.
const ROUNDING_OVERLAP_TOLERANCE = 15;

/**
 * Dublet-/overlap-beskyttelse FØR en historik-linje oprettes. Generel beskyttelse
 * af segmentlogikken (ikke hardcodet til testdata).
 * - "duplicate": nøjagtig samme medarbejder + start + slut + kategori/underpunkt + ordre/sag.
 * - "overlap": ægte overlap ud over kvarter-afrundingens grænse (> 15 min).
 * Returnerer null hvis linjen er sikker at oprette.
 */
export function segmentBlockReason(
  entry: TimeEntry,
  existing: TimeEntry[]
): null | "duplicate" | "overlap" {
  const live = existing.filter((e) => !e.slettet);

  const isDuplicate = live.some(
    (e) =>
      e.employeeId === entry.employeeId &&
      e.startTime === entry.startTime &&
      e.endTime === entry.endTime &&
      e.categoryId === entry.categoryId &&
      e.subcategoryId === entry.subcategoryId &&
      (e.customer ?? "") === (entry.customer ?? "")
  );
  if (isDuplicate) return "duplicate";

  const iv = { start: toMinutes(entry.startTime), end: toMinutes(entry.endTime) };
  const realOverlap = live.some((e) => {
    const ov = overlapMinutes(iv, {
      start: toMinutes(e.startTime),
      end: toMinutes(e.endTime),
    });
    return ov > ROUNDING_OVERLAP_TOLERANCE;
  });
  if (realOverlap) return "overlap";

  return null;
}

function workTask(draft: SegmentDraft, ctx: Ctx): CurrentTask {
  return {
    employeeId: ctx.employeeId,
    categoryId: draft.categoryId,
    subcategoryId: draft.subcategoryId,
    orderNumber: draft.orderNumber.trim() || null,
    note: draft.note.trim() || null,
    updatedAt: ctx.nowIso,
    updatedBy: null,
  };
}

function pauseTask(ctx: Ctx): CurrentTask {
  return {
    employeeId: ctx.employeeId,
    categoryId: BREAK_CATEGORY_ID,
    subcategoryId: LUNCH_SUBCATEGORY_ID,
    orderNumber: null,
    note: null,
    updatedAt: ctx.nowIso,
    updatedBy: null,
  };
}

function closeCurrent(state: SegmentState, ctx: Ctx): TimeEntry | null {
  if (!state.task) return null;
  // Manglende starttid (edge): brug nu som start → guardet til min. ét kvarter.
  const started = state.startedAtIso ?? ctx.nowIso;
  return closeSegmentToEntry(state.task, started, ctx);
}

/**
 * Ren beslutning: hvad sker der ved en handling. Skriver INTET — UI'et anvender
 * resultatet på storage (addEntries / setCurrentTask / clearCurrentTask).
 */
export function applySegmentAction(
  state: SegmentState,
  action: SegmentAction,
  ctx: Ctx
): SegmentResult {
  switch (action.type) {
    case "start":
      // Kun gyldig fra idle; opretter INGEN historik-linje.
      return { entry: null, nextTask: workTask(action.draft, ctx), nextStartIso: ctx.nowIso };

    case "switch":
      return {
        entry: closeCurrent(state, ctx),
        nextTask: workTask(action.draft, ctx),
        nextStartIso: ctx.nowIso,
      };

    case "pause":
      return {
        entry: closeCurrent(state, ctx),
        nextTask: pauseTask(ctx),
        nextStartIso: ctx.nowIso,
      };

    case "resume":
      return {
        entry: closeCurrent(state, ctx),
        nextTask: workTask(action.draft, ctx),
        nextStartIso: ctx.nowIso,
      };

    case "close":
      return { entry: closeCurrent(state, ctx), nextTask: null, nextStartIso: null };
  }
}
