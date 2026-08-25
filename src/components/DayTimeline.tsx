import { AlertTriangle, Coffee, Users, RotateCcw, UserMinus } from "lucide-react";
import type { TimelineBlock } from "../lib/dayTimeline";
import { getCategory, getSubcategory, getRedoReason } from "../data/categories";
import { absenceTypeName } from "../data/absences";
import { formatDuration } from "../lib/time";

// Lodret dags-tidslinje ("Min dag"). READ-ONLY: ingen Rediger/Slet/Ny/Udfyld.
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

export default function DayTimeline({ blocks }: { blocks: TimelineBlock[] }) {
  return (
    <div className="timeline">
      {blocks.map((b, i) => (
        <div key={i} className={`tl-row tl-${b.kind}${b.conflict ? " tl-conflict" : ""}`}>
          <div className="tl-time">
            {b.startTime}
            <small>{b.endTime}</small>
          </div>
          <div className="tl-block" style={{ minHeight: blockHeight(b.durationMin) }}>
            <BlockBody b={b} />
          </div>
        </div>
      ))}
    </div>
  );
}
