import { useEffect, useState } from "react";
import { CATEGORIES, getCategory, getSubcategory } from "../data/categories";
import { store, nowIso } from "../lib/storage";
import { getTaskStart, setTaskStart, clearTaskStart, isoToHHMM } from "../lib/currentTaskStart";
import type { CurrentTask } from "../types";
import CategoryPicker from "./CategoryPicker";

interface Props {
  employeeId: string;
  /** Bumpes udefra (fx efter gem af tid) for at tvinge genindlæsning. */
  refreshSignal?: number;
  /** "Afslut og registrér tid": åbn normal editor forudfyldt fra aktuel opgave. */
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

// "Aktuel opgave" = hjælpe-stempelur / kladde. Det er IKKE tidsregistrering:
// tæller aldrig som arbejdstid. Tiden bliver først rigtig, når man trykker
// "Afslut og registrér tid" og GEMMER i den normale editor.
export default function CurrentTaskCard({ employeeId, refreshSignal, onRegister }: Props) {
  const [task, setTask] = useState<CurrentTask | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  async function refresh() {
    setTask(await store().getCurrentTask(employeeId));
    setStartedAt(getTaskStart(employeeId));
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
    setDraft(
      task
        ? {
            categoryId: task.categoryId,
            subcategoryId: task.subcategoryId,
            orderNumber: task.orderNumber ?? "",
            note: task.note ?? "",
          }
        : emptyDraft()
    );
    setEditing(true);
  }

  // Gem aktuel opgave. isStart=true → sæt også cirka-starttidspunkt (nyt stempel).
  async function persist(isStart: boolean) {
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
      if (isStart) setTaskStart(employeeId, nowIso());
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
      clearTaskStart(employeeId);
      await refresh();
    } catch {
      setError("Kunne ikke rydde aktuel opgave.");
    } finally {
      setBusy(false);
    }
  }

  const startText = startedAt
    ? isoToHHMM(startedAt)
    : task
    ? isoToHHMM(task.updatedAt)
    : null;

  return (
    <div className="current-task">
      <div className="ct-title">Aktuel opgave</div>
      <div className="ct-help">
        Aktuel opgave er kun en status. Når du vil registrere tid, opretter du selv en
        registrering med start og slut.
      </div>
      {error && <div className="msg error">{error}</div>}

      {editing || !task ? (
        <>
          {!task && !editing && <div className="ct-lead">Hvad arbejder du på nu?</div>}
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
                placeholder="Fx 54277 eller SMU-0042"
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
            <button className="smu-btn-primary" onClick={() => persist(!task)} disabled={busy}>
              {task ? "Gem" : "Start aktuel opgave"}
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
          <div className="ct-lead">Du arbejder på</div>
          <div className="ct-view">
            <span className="ct-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ct-sub"> / {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task.orderNumber && <span className="ct-order"> · {task.orderNumber}</span>}
          </div>
          {task.note && <div className="ct-note">{task.note}</div>}
          {startText && <div className="ct-started">Startet ca. {startText}</div>}
          <div className="ct-actions">
            {onRegister && (
              <button className="smu-btn-primary" onClick={() => onRegister(task)} disabled={busy}>
                Afslut og registrér tid
              </button>
            )}
            <button className="smu-btn-ghost" onClick={startEdit} disabled={busy}>
              Ret aktuel opgave
            </button>
            <button className="smu-btn-ghost ct-clear" onClick={clear} disabled={busy}>
              Ryd
            </button>
          </div>
        </>
      )}
    </div>
  );
}
