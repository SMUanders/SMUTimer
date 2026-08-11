import { useState } from "react";
import type { EntryDraft, TimeEntry } from "../types";
import { CATEGORIES, REDO_REASONS } from "../data/categories";
import { validateEntry } from "../lib/validation";
import CategoryPicker from "./CategoryPicker";
import TimeSelect from "./TimeSelect";

interface Props {
  mode: "new" | "edit";
  workDate: string;
  initial: EntryDraft;
  /** Dagens øvrige linjer (den der redigeres er ekskluderet) — til overlap-tjek. */
  existing: TimeEntry[];
  onSave: (draft: EntryDraft) => void;
  onClose: () => void;
}

const emptyDraft = (): EntryDraft => ({
  startTime: "07:30",
  endTime: "08:00",
  categoryId: CATEGORIES[0].id,
  subcategoryId: CATEGORIES[0].subcategories[0]?.id ?? null,
  customer: "",
  note: "",
  isRedo: false,
  redoReason: null,
  redoNote: "",
});

export { emptyDraft };

export default function EntryEditor({
  mode,
  initial,
  existing,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<EntryDraft>(initial);
  const [touched, setTouched] = useState(false);

  const v = validateEntry(draft.startTime, draft.endTime, draft.categoryId, existing);
  const canSave = v.errors.length === 0;

  function set<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave() {
    setTouched(true);
    if (!canSave) return;
    onSave(draft);
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          {mode === "new" ? "Ny registrering" : "Rediger registrering"}
        </div>

        <div className="sheet-body">
          {touched && v.errors.length > 0 && (
            <div className="msg error">
              {v.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}
          {v.warnings.length > 0 && (
            <div className="msg warn">
              {v.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}

          <div className="row-2">
            <div className="field">
              <label>Start</label>
              <TimeSelect value={draft.startTime} onChange={(v) => set("startTime", v)} />
            </div>
            <div className="field">
              <label>Slut</label>
              <TimeSelect value={draft.endTime} onChange={(v) => set("endTime", v)} />
            </div>
          </div>

          <div className="field">
            <CategoryPicker
              categoryId={draft.categoryId}
              subcategoryId={draft.subcategoryId}
              onChange={(cat, sub) =>
                setDraft((d) => ({ ...d, categoryId: cat, subcategoryId: sub }))
              }
            />
          </div>

          <div className="field">
            <label>Kunde</label>
            <input
              className="smu-input"
              type="text"
              placeholder="fx Kunde X"
              value={draft.customer}
              onChange={(e) => set("customer", e.target.value)}
            />
          </div>

          <div className="field">
            <label>Note</label>
            <textarea
              className="smu-input"
              placeholder="Valgfri note…"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>

          <div className="field toggle">
            <input
              id="redo"
              type="checkbox"
              checked={draft.isRedo}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  isRedo: e.target.checked,
                  // Sæt en default-årsag ved markering; ryd ved fravalg.
                  redoReason: e.target.checked ? d.redoReason ?? REDO_REASONS[0].id : null,
                  redoNote: e.target.checked ? d.redoNote : "",
                }))
              }
            />
            <label htmlFor="redo" style={{ margin: 0 }}>
              Omgøring
            </label>
          </div>

          {draft.isRedo && (
            <div className="redo-panel">
              <div className="field">
                <label>Omgøring årsag</label>
                <select
                  className="smu-input"
                  value={draft.redoReason ?? REDO_REASONS[0].id}
                  onChange={(e) => set("redoReason", e.target.value)}
                >
                  {REDO_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Omgøring note</label>
                <textarea
                  className="smu-input"
                  placeholder="Beskriv omgøringen (intern opfølgning)…"
                  value={draft.redoNote}
                  onChange={(e) => set("redoNote", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer — Gem altid synlig, også ved lange formularer/små skærme */}
        <div className="sheet-footer">
          <button className="smu-btn-secondary" onClick={onClose} style={{ flex: "0 0 auto" }}>
            Annuller
          </button>
          <button
            className="smu-btn-primary"
            onClick={handleSave}
            disabled={touched && !canSave}
          >
            Gem
          </button>
        </div>
      </div>
    </div>
  );
}
