import { Pencil, Trash2 } from "lucide-react";
import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, getRedoReason } from "../data/categories";

interface Props {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

export default function EntryRow({ entry, onEdit, onDelete }: Props) {
  const cat = getCategory(entry.categoryId);
  const sub = getSubcategory(entry.categoryId, entry.subcategoryId);

  return (
    <div className={"entry-row" + (entry.isBreak ? " is-break" : "")}>
      <div className="entry-time">
        {entry.startTime}
        <small>{entry.endTime}</small>
      </div>

      <div className="entry-main">
        <div>
          <span className="entry-cat">{cat?.name ?? "—"}</span>
          {sub && <span className="entry-sub"> / {sub.name}</span>}
        </div>
        {entry.customer && <div className="entry-customer">{entry.customer}</div>}
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

      {/* Fast højre kolonne — knapper bliver altid i rækken, uanset note-længde */}
      <div className="entry-actions">
        {!entry.isBreak && (
          <button onClick={() => onEdit(entry)}>
            <Pencil size={14} /> Rediger
          </button>
        )}
        <button className="del" onClick={() => onDelete(entry)}>
          <Trash2 size={14} /> Slet
        </button>
      </div>
    </div>
  );
}
