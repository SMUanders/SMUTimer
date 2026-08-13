import { useEffect, useState } from "react";
import { CATEGORIES, getCategory, getSubcategory } from "../data/categories";
import { store, nowIso } from "../lib/storage";
import type { CurrentTask } from "../types";
import CategoryPicker from "./CategoryPicker";

interface Props {
  employeeId: string;
  /** Bumpes udefra (fx når editoren sætter aktuel opgave) for at tvinge genindlæsning. */
  refreshSignal?: number;
  /** Åbn ny registrering forudfyldt fra den aktuelle opgave. */
  onRegister?: (task: CurrentTask) => void;
}

interface Draft {
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string;
  note: string;
}

function emptyDraft(): Draft {
  return {
    categoryId: CATEGORIES[0].id,
    subcategoryId: CATEGORIES[0].subcategories[0]?.id ?? null,
    orderNumber: "",
    note: "",
  };
}

// "Aktuel opgave" — status, IKKE tidsregistrering. Opretter ingen time_entries.
export default function CurrentTaskCard({ employeeId, refreshSignal, onRegister }: Props) {
  const [task, setTask] = useState<CurrentTask | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  async function refresh() {
    setTask(await store().getCurrentTask(employeeId));
  }
  useEffect(() => {
    setEditing(false);
    setDraft(emptyDraft());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Genindlæs (uden at nulstille redigering) når signalet bumpes udefra.
  useEffect(() => {
    if (refreshSignal === undefined) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  function startEdit() {
    if (task) {
      setDraft({
        categoryId: task.categoryId,
        subcategoryId: task.subcategoryId,
        orderNumber: task.orderNumber ?? "",
        note: task.note ?? "",
      });
    } else {
      setDraft(emptyDraft());
    }
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.orderNumber.trim() || null,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setEditing(false);
      await refresh();
    } catch {
      setError("Kunne ikke gemme aktuel opgave. Er databasen opdateret?");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await store().clearCurrentTask(employeeId);
      await refresh();
    } catch {
      setError("Kunne ikke rydde aktuel opgave.");
    } finally {
      setBusy(false);
    }
  }

  const showForm = editing || !task;

  return (
    <div className="current-task smu-card">
      <div className="ct-title">
        {task && !editing ? "Aktuel opgave lige nu" : "Aktuel opgave"}
      </div>
      {error && <div className="msg error">{error}</div>}

      {showForm ? (
        <>
          <div className="field" style={{ marginBottom: 12 }}>
            <CategoryPicker
              categoryId={draft.categoryId}
              subcategoryId={draft.subcategoryId}
              onChange={(cat, sub) =>
                setDraft((d) => ({ ...d, categoryId: cat, subcategoryId: sub }))
              }
            />
          </div>
          <div className="row-2">
            <div className="field">
              <label>Ordre / sag</label>
              <input
                className="smu-input"
                type="text"
                placeholder="fx 12345"
                value={draft.orderNumber}
                onChange={(e) => setDraft((d) => ({ ...d, orderNumber: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Note</label>
              <input
                className="smu-input"
                type="text"
                placeholder="Valgfri"
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </div>
          </div>
          <div className="ct-actions">
            <button className="smu-btn-primary" onClick={save} disabled={busy}>
              {task ? "Opdater" : "Sæt som aktuel opgave"}
            </button>
            {task && (
              <button className="smu-btn-secondary" onClick={() => setEditing(false)} disabled={busy}>
                Annuller
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="ct-view">
            <span className="ct-cat">{getCategory(task!.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task!.categoryId, task!.subcategoryId) && (
              <span className="ct-sub"> / {getSubcategory(task!.categoryId, task!.subcategoryId)?.name}</span>
            )}
            {task!.orderNumber && <span className="ct-order"> · {task!.orderNumber}</span>}
          </div>
          {task!.note && <div className="ct-note">{task!.note}</div>}
          <div className="ct-actions">
            {onRegister && (
              <button className="smu-btn-primary" onClick={() => onRegister(task!)} disabled={busy}>
                Registrer tid på denne opgave
              </button>
            )}
            <button className="smu-btn-secondary" onClick={startEdit} disabled={busy}>
              Opdater
            </button>
            <button className="smu-btn-ghost ct-clear" onClick={clear} disabled={busy}>
              Ryd aktuel opgave
            </button>
          </div>
        </>
      )}
    </div>
  );
}
