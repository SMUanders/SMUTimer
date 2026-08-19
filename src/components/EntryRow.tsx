import { Pencil, Trash2 } from "lucide-react";
import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, getRedoReason } from "../data/categories";
import { durationMinutes, formatDuration } from "../lib/time";

interface Props {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

export default function EntryRow({ entry, onEdit, onDelete }: Props) {
  const cat = getCategory(entry.categoryId);
  const sub = getSubcategory(entry.categoryId, entry.subcategoryId);
  const dur = formatDuration(durationMinutes(entry.startTime, entry.endTime));

  return (
    <div className={"entry-row" + (entry.isBreak ? " is-break" : "")}>
      <div className="entry-body">
        {/* Tidsinterval + varighed samlet på én linje */}
        <div className="entry-line">
          <span className="entry-interval">{entry.startTime}–{entry.endTime}</span>
          <span className="entry-dur">· {dur}</span>
        </div>

        <div className="entry-catline">
          <span className="entry-cat">{cat?.name ?? "—"}</span>
          {sub && <span className="entry-sub"> · {sub.name}</span>}
        </div>

        {entry.customer && <div className="entry-meta">{entry.customer}</div>}
        {entry.note && <div className="entry-note">{entry.note}</div>}

        {(entry.isRedo || entry.splitGroupId) && (
          <div className="entry-badges">
            {entry.isRedo && (
              <span className="smu-badge smu-badge-violet">
                Omgøring
                {entry.redoReason ? `: ${getRedoReason(entry.redoReason)?.name}` : ""}
              </span>
            )}
            {entry.splitGroupId && (
              <span className="smu-badge smu-badge-grey">Frokost-opdelt</span>
            )}
          </div>
        )}
        {entry.isRedo && entry.redoNote && (
          <div className="entry-note">{entry.redoNote}</div>
        )}
      </div>

      {/* Afdæmpede handlinger — dominerer ikke linjen */}
      <div className="entry-actions">
        {!entry.isBreak && (
          <button onClick={() => onEdit(entry)} aria-label="Rediger">
            <Pencil size={13} /> Rediger
          </button>
        )}
        <button className="del" onClick={() => onDelete(entry)} aria-label="Slet">
          <Trash2 size={13} /> Slet
        </button>
      </div>
    </div>
  );
}
