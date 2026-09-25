import { useState } from "react";
import { Coffee, Users, RotateCcw, Pencil } from "lucide-react";
import type { TimeEntry } from "../types";
import { getCategory, getSubcategory, getRedoReason, isBreakCategory } from "../data/categories";
import { isHelpNote, HELP_NOTE, helpNote } from "../lib/helpContext";
import { formatDuration } from "../lib/time";

// Detaljevisning af en afsluttet registrering i "Min dag". READ-ONLY for alle felter,
// UNDTAGEN: hvis registreringen tilhører den indloggede medarbejder (onSaveNote givet),
// kan KUN noten redigeres (v2.1.1). Ingen ændring af tid/kategori/aktivitet/sag/omgøring
// /employee_id. Leder/admin-korrektion sker uændret i LeaderDay (ikke her).

interface Props {
  entry: TimeEntry;
  onClose: () => void;
  /** Sat KUN når entryen tilhører den indloggede bruger → tillader note-redigering. */
  onSaveNote?: (note: string) => Promise<void>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

export default function EntryDetail({ entry, onClose, onSaveNote }: Props) {
  const cat = getCategory(entry.categoryId);
  const sub = getSubcategory(entry.categoryId, entry.subcategoryId);
  const help = isHelpNote(entry.note);
  const isPause = entry.isBreak || isBreakCategory(entry.categoryId);
  // Hjælpe-linjens note starter med HELP_NOTE — vis/redigér kun den brugertilføjede del.
  const helpUserNote = help ? entry.note.slice(HELP_NOTE.length).replace(/^\s*—\s*/, "").trim() : "";
  // Den brugervendte note (uden hjælp-mærket).
  const shownNote = help ? helpUserNote : entry.note.trim();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(shownNote);
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!onSaveNote) return;
    setSaving(true);
    setError(null);
    try {
      // Bevar hjælp-mærket i den lagrede note, så Min dag stadig genkender hjælp-linjen.
      const raw = help ? helpNote(draft) : draft.trim();
      await onSaveNote(raw);
      setEditing(false);
    } catch {
      setError("Kunne ikke gemme noten. Prøv igen.");
    } finally {
      setSaving(false);
    }
  }

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
    <div className="overlay" onMouseDown={editing ? undefined : onClose}>
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

          {/* Note — read-only for andres entries; redigerbar (kun note) for egne. */}
          {onSaveNote ? (
            <div className="detail-note">
              <span className="detail-label">Note</span>
              {editing ? (
                <>
                  <textarea
                    className="smu-input"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Skriv en note…"
                  />
                  {error && <div className="msg error">{error}</div>}
                  <div className="detail-note-actions">
                    <button className="smu-btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                      Annuller
                    </button>
                    <button className="smu-btn-primary" onClick={save} disabled={saving}>
                      Gem note
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="detail-value detail-note-text">{shownNote || "Ingen note"}</span>
                  <button className="smu-btn-ghost detail-edit-note" onClick={startEdit}>
                    <Pencil size={14} /> Rediger note
                  </button>
                </>
              )}
            </div>
          ) : (
            shownNote && <Row label="Note" value={shownNote} />
          )}
        </div>

        <div className="sheet-footer">
          <button className="smu-btn-primary" onClick={onClose} disabled={saving}>
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}
