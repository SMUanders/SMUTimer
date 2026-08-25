// "Min dag" som tidslinje — ren, testbar præsentationslogik. INGEN dataændring,
// ingen automatisk rettelse: den grupperer blot dagens registreringer i
// kronologiske blokke og markerer huller + overlap, så en dag kan læses som en
// tidsplan i stedet for en kortbunke.

import type { TimeEntry, Absence } from "../types";
import { toMinutes, toHHMM } from "./time";
import { isBreakCategory } from "../data/categories";
import { isHelpNote } from "./helpContext";
import { effectiveEnd } from "./absence";

export type BlockKind = "work" | "pause" | "help" | "redo" | "fravaer" | "gap";

export interface TimelineBlock {
  kind: BlockKind;
  startMin: number; // minutter siden midnat
  endMin: number;
  startTime: string; // "HH:MM"
  endTime: string;
  durationMin: number;
  conflict: boolean; // overlapper mindst én anden registrering
  entry: TimeEntry | null; // null for hul-/fraværs-blokke
  absence: Absence | null; // sat for fravær-blokke
  open: boolean; // fravær uden kendt sluttid ("tilbage senere")
}

function kindOf(e: TimeEntry): BlockKind {
  if (e.isRedo) return "redo";
  if (isHelpNote(e.note)) return "help";
  if (e.isBreak || isBreakCategory(e.categoryId)) return "pause";
  return "work";
}

function gapBlock(startMin: number, endMin: number): TimelineBlock {
  return {
    kind: "gap",
    startMin,
    endMin,
    startTime: toHHMM(startMin),
    endTime: toHHMM(endMin),
    durationMin: endMin - startMin,
    conflict: false,
    entry: null,
    absence: null,
    open: false,
  };
}

/**
 * Byg dagens tidslinje af registreringer + fravær:
 *  - sorterer kronologisk (start, derefter slut)
 *  - markerer overlap som konflikt (berøring i endepunkt tæller IKKE)
 *  - indsætter hul-blokke mellem dækkede tidsrum (fravær tæller som dækket → intet hul)
 *
 * Slettede linjer ignoreres. Gamle overlap/testdata blokerer intet — de vises
 * blot som read-only konflikt. Aktiv opgave vises i topkortet (ikke her i v1).
 */
export function buildDayTimeline(entries: TimeEntry[], absences: Absence[] = []): TimelineBlock[] {
  const workBlocks: TimelineBlock[] = entries
    .filter((e) => !e.slettet)
    .map((e) => {
      const startMin = toMinutes(e.startTime);
      const endMin = toMinutes(e.endTime);
      return {
        kind: kindOf(e),
        startMin,
        endMin,
        startTime: e.startTime,
        endTime: e.endTime,
        durationMin: Math.max(0, endMin - startMin),
        conflict: false,
        entry: e,
        absence: null,
        open: false,
      };
    });

  const absenceBlocks: TimelineBlock[] = absences
    .filter((a) => !a.slettet)
    .map((a) => {
      const startMin = toMinutes(a.startTime);
      const end = effectiveEnd(a); // faktisk retur, ellers forventet
      const open = a.ended === null; // stadig ude
      const endMin = end ? toMinutes(end) : startMin;
      return {
        kind: "fravaer" as BlockKind,
        startMin,
        endMin,
        startTime: a.startTime,
        endTime: end ?? "",
        durationMin: Math.max(0, endMin - startMin),
        conflict: false,
        entry: null,
        absence: a,
        open,
      };
    });

  const regs = [...workBlocks, ...absenceBlocks].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
  );

  // Overlap-detektion (streng): a.start < b.slut OG b.start < a.slut.
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) {
      if (regs[i].startMin < regs[j].endMin && regs[j].startMin < regs[i].endMin) {
        regs[i].conflict = true;
        regs[j].conflict = true;
      }
    }
  }

  // Byg kronologisk sekvens med hul-blokke mellem dækkede tidsrum.
  const out: TimelineBlock[] = [];
  let coveredUntil: number | null = null;
  for (const b of regs) {
    if (coveredUntil !== null && b.startMin > coveredUntil) {
      out.push(gapBlock(coveredUntil, b.startMin));
    }
    out.push(b);
    coveredUntil = coveredUntil === null ? b.endMin : Math.max(coveredUntil, b.endMin);
  }
  return out;
}
