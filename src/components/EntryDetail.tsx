import { Coffee, Users, RotateCcw } from "lucide-react";
import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, getRedoReason, isBreakCategory } from "../data/categories";
import { isHelpNote, HELP_NOTE } from "../lib/helpContext";
import { formatDuration } from "../lib/time";

// READ-ONLY detaljevisning af en afsluttet registrering i "Min dag".
// v2.1: KUN visning — ingen redigering, sletning eller kategori-/sag-ændring.
// Strukturen holder plads til en senere "Rediger note" (egen note) uden redesign.

interface Props {
  entry: TimeEntry;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

export default function EntryDetail({ entry, onClose }: Props) {
  const cat = getCategory(entry.categoryId);
  const sub = getSubcategory(entry.categoryId, entry.subcategoryId);
  const help = isHelpNote(entry.note);
  const isPause = entry.isBreak || isBreakCategory(entry.categoryId);
  // Hjælpe-linjens note starter med HELP_NOTE — vis kun en evt. brugertilføjet del.
  const helpUserNote = help ? entry.note.slice(HELP_NOTE.length).replace(/^\s*—\s*/, "").trim() : "";

  const kind = entry.isRedo ? (
    <span className="detail-tag detail-tag-redo">
      <RotateCcw size={12} /> Omgøring
    </span>
  ) : help ? (
    <span className="detail-tag detail-tag-help">
      <Users size={12} /> Hjælp på anden opgave
    </span>
  ) : isPause ? (
    <span className="detail-tag detail-tag-pause">
      <Coffee size={12} /> Pause
    </span>
  ) : null;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-header">Detaljer</div>

        <div className="sheet-body">
          {kind && <div className="detail-kind">{kind}</div>}

          <Row
            label="Tid"
            value={
              <>
                {entry.startTime}–{entry.endTime} · {formatDuration(entry.durationMinutes)}
              </>
            }
          />
          <Row label="Kategori" value={cat?.name ?? "—"} />
          {sub && <Row label="Aktivitet" value={sub.name} />}
          {!isPause &&
            (entry.sagId ? (
              <Row label="SMU-sag" value={entry.sagSmuNummer || entry.customer?.trim() || "—"} />
            ) : (
              <Row label="Ordre / sag / kunde" value={entry.customer?.trim() || "—"} />
            ))}

          {entry.isRedo && (
            <Row label="Omgøring årsag" value={getRedoReason(entry.redoReason)?.name ?? entry.redoReason ?? "—"} />
          )}
          {entry.isRedo && entry.redoNote?.trim() && <Row label="Omgøring note" value={entry.redoNote.trim()} />}

          {/* Note: for hjælpe-linjer vises kun den brugertilføjede del (ikke selve "Hjælp…"-mærket). */}
          {help
            ? helpUserNote && <Row label="Note" value={helpUserNote} />
            : entry.note?.trim() && <Row label="Note" value={entry.note.trim()} />}
        </div>

        {/* v2.1: kun Luk. Her kan senere tilføjes "Rediger note" (kun egen note). */}
        <div className="sheet-footer">
          <button className="smu-btn-primary" onClick={onClose}>
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}
