import type { TimeEntry } from "../types";
import { getCategory, getSubcategory } from "../data/categories";
import { durationMinutes, formatDuration } from "../lib/time";
import { HELP_NOTE, isHelpNote } from "../lib/helpContext";

// Read-only historik-linje ("Min dag"). Ingen Rediger/Slet — medarbejderen har
// ingen redigeringsbeføjelser på historik.
export default function HistoryRow({ entry }: { entry: TimeEntry }) {
  const cat = getCategory(entry.categoryId);
  const sub = getSubcategory(entry.categoryId, entry.subcategoryId);
  const dur = formatDuration(durationMinutes(entry.startTime, entry.endTime));
  const help = isHelpNote(entry.note);
  // Vis kun brugerens egen del af noten (marker-teksten vises som badge).
  const restNote = help ? entry.note!.slice(HELP_NOTE.length).replace(/^\s*—\s*/, "").trim() : entry.note;

  return (
    <div className={"hist-row" + (entry.isBreak ? " is-break" : "") + (help ? " is-help" : "")}>
      <div className="hist-time">
        {entry.startTime}–{entry.endTime}
        <span className="hist-dur">{dur}</span>
      </div>
      <div className="hist-main">
        <div>
          {help && <span className="hist-help-tag">Hjælp</span>}
          <span className="hist-cat">{cat?.name ?? "—"}</span>
          {sub && <span className="hist-sub"> · {sub.name}</span>}
        </div>
        {entry.customer && <div className="hist-order">{entry.customer}</div>}
        {restNote && <div className="hist-note">{restNote}</div>}
      </div>
    </div>
  );
}
