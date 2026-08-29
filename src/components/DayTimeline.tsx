import type React from "react";
import { AlertTriangle, Coffee, Users, RotateCcw, UserMinus, Pencil, Plus } from "lucide-react";
import type { TimeEntry } from "../types";
import type { TimelineBlock } from "../lib/dayTimeline";
import { getCategory, getSubcategory, getRedoReason } from "../data/categories";
import { absenceTypeName } from "../data/absences";
import { formatDuration } from "../lib/time";

// Lodret dags-tidslinje ("Min dag"). Samme visning for medarbejder og leder.
// Medarbejder: READ-ONLY (ingen handlers). Leder: hvis onEditEntry/onFillGap gives,
// bliver registrerings-blokke klikbare til korrektion og hul-blokke til "udfyld her".
// Blokke fylder fysisk efter varighed, så dagen kan læses som en tidsplan.
const PX_PER_MIN = 1.5;
const MIN_H = 34;

function blockHeight(mins: number): number {
  return Math.max(MIN_H, Math.round(mins * PX_PER_MIN));
}

function BlockBody({ b }: { b: TimelineBlock }) {
  const cat = b.entry ? getCategory(b.entry.categoryId) : null;
  const sub = b.entry ? getSubcategory(b.entry.categoryId, b.entry.subcategoryId) : null;

  if (b.kind === "gap") {
    return (
      <div className="tl-main">
        <span className="tl-gap-label">Hul · ikke registreret</span>
        <span className="tl-dur">{formatDuration(b.durationMin)}</span>
      </div>
    );
  }

  if (b.kind === "fravaer") {
    return (
      <div className="tl-main">
        <div className="tl-line1">
          <span className="tl-tag tl-tag-fravaer">
            <UserMinus size={12} /> Fravær
          </span>
          <span className="tl-cat">{absenceTypeName(b.absence?.absenceType ?? null)}</span>
          {!b.open && <span className="tl-dur">{formatDuration(b.durationMin)}</span>}
          {b.open && <span className="tl-dur">tilbage senere</span>}
        </div>
        {b.absence?.note && <div className="tl-order">{b.absence.note}</div>}
      </div>
    );
  }

  return (
    <div className="tl-main">
      <div className="tl-line1">
        {b.kind === "help" && (
          <span className="tl-tag tl-tag-help">
            <Users size={12} /> Hjælp
          </span>
        )}
        {b.kind === "redo" && (
          <span className="tl-tag tl-tag-redo">
            <RotateCcw size={12} /> Omgøring
          </span>
        )}
        {b.kind === "pause" && (
          <span className="tl-tag tl-tag-pause">
            <Coffee size={12} /> Pause
          </span>
        )}
        <span className="tl-cat">{cat?.name ?? "—"}</span>
        {sub && <span className="tl-sub"> · {sub.name}</span>}
        {b.conflict && (
          <span className="tl-tag tl-tag-conflict">
            <AlertTriangle size={12} /> Overlap
          </span>
        )}
        <span className="tl-dur">{formatDuration(b.durationMin)}</span>
      </div>
      {b.kind === "redo" && b.entry?.redoReason && (
        <div className="tl-reason">Årsag: {getRedoReason(b.entry.redoReason)?.name ?? b.entry.redoReason}</div>
      )}
      {b.entry?.customer && <div className="tl-order">{b.entry.customer}</div>}
    </div>
  );
}

interface Props {
  blocks: TimelineBlock[];
  /** Leder-korrektion: klik på en registrerings-blok for at rette den. */
  onEditEntry?: (entry: TimeEntry) => void;
  /** Leder-korrektion: klik på et hul for at udfylde det (start/slut prefilles). */
  onFillGap?: (startTime: string, endTime: string) => void;
}

export default function DayTimeline({ blocks, onEditEntry, onFillGap }: Props) {
  return (
    <div className="timeline">
      {blocks.map((b, i) => {
        const editable = !!onEditEntry && !!b.entry; // arbejde/hjælp/omgøring/pause
        const fillable = !!onFillGap && b.kind === "gap";
        const interactive = editable || fillable;
        const activate = () => {
          if (editable && b.entry) onEditEntry!(b.entry);
          else if (fillable) onFillGap!(b.startTime, b.endTime);
        };
        return (
          <div key={i} className={`tl-row tl-${b.kind}${b.conflict ? " tl-conflict" : ""}`}>
            <div className="tl-time">
              {b.startTime}
              <small>{b.endTime}</small>
            </div>
            <div
              className={`tl-block${interactive ? " tl-editable" : ""}`}
              style={{ minHeight: blockHeight(b.durationMin) }}
              {...(interactive
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: activate,
                    onKeyDown: (ev: React.KeyboardEvent) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        activate();
                      }
                    },
                    title: editable ? "Ret registrering" : "Udfyld hul",
                  }
                : {})}
            >
              <BlockBody b={b} />
              {editable && <Pencil className="tl-edit-ic" size={13} />}
              {fillable && <Plus className="tl-edit-ic" size={13} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
