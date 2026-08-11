import { useEffect, useMemo, useState } from "react";
import type { EntryDraft, TimeEntry } from "./types";
import { isBreakCategory } from "./data/categories";
import { getEmployee } from "./data/employees";
import { initStore, store, newId, nowIso } from "./lib/storage";
import { buildEntries } from "./lib/entries";
import { proposeLunchSplit, type LunchWindow } from "./lib/lunch";
import { summarizeDay, expectedWorkMinutes } from "./lib/summary";
import { suggestNextSlot } from "./lib/suggest";
import { durationMinutes } from "./lib/time";
import { todayIso, addDays, formatDanishDate } from "./lib/dates";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { signOut } from "./lib/auth";
import DaySummary from "./components/DaySummary";
import EntryRow from "./components/EntryRow";
import EntryEditor, { emptyDraft } from "./components/EntryEditor";
import EmployeeSelect from "./components/EmployeeSelect";
import LunchSplitDialog from "./components/LunchSplitDialog";

const EMPLOYEE_KEY = "smu-tid.employee";

function draftFromEntry(e: TimeEntry): EntryDraft {
  return {
    startTime: e.startTime,
    endTime: e.endTime,
    categoryId: e.categoryId,
    subcategoryId: e.subcategoryId,
    customer: e.customer,
    note: e.note,
    isRedo: e.isRedo,
    redoReason: e.redoReason,
    redoNote: e.redoNote,
  };
}

interface EditorState {
  mode: "new" | "edit";
  editingId: string | null;
  initial: EntryDraft;
}

interface PendingSplit {
  draft: EntryDraft;
  lunch: LunchWindow;
  editingId: string | null;
}

// Deep-link: ?medarbejder=<id>&dato=<YYYY-MM-DD> (fx admin/ugeoverblik).
function readDeepLink(): { employeeId: string | null; date: string | null } {
  try {
    const p = new URLSearchParams(window.location.search);
    const emp = p.get("medarbejder");
    const dato = p.get("dato");
    return {
      employeeId: emp && getEmployee(emp) ? emp : null,
      date: dato && /^\d{4}-\d{2}-\d{2}$/.test(dato) ? dato : null,
    };
  } catch {
    return { employeeId: null, date: null };
  }
}

export default function App() {
  const link = readDeepLink();
  const [employeeId, setEmployeeId] = useState<string | null>(
    link.employeeId ?? localStorage.getItem(EMPLOYEE_KEY)
  );
  const [date, setDate] = useState<string>(link.date ?? todayIso());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, setPending] = useState<PendingSplit | null>(null);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");
  const [ready, setReady] = useState(false);

  async function refresh(emp = employeeId, d = date) {
    if (!emp) {
      setEntries([]);
      return;
    }
    setEntries(await store().getEntriesForDate(emp, d));
  }

  // Initialiser storage-backend én gang.
  useEffect(() => {
    initStore().then((name) => {
      setStorageName(name);
      setReady(true);
      refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Genindlæs når medarbejder eller dato ændres.
  useEffect(() => {
    if (ready) refresh(employeeId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, date, ready]);

  const summary = useMemo(
    () => summarizeDay(entries, expectedWorkMinutes(date)),
    [entries, date]
  );

  const employee = getEmployee(employeeId);

  // ---------- medarbejder ----------
  function selectEmployee(id: string) {
    localStorage.setItem(EMPLOYEE_KEY, id);
    setEmployeeId(id);
  }
  function switchEmployee() {
    setEditor(null);
    setPending(null);
    setEmployeeId(null);
  }

  // ---------- gem-flow ----------
  async function requestSave(draft: EntryDraft, editingId: string | null) {
    if (!employeeId) return;
    const editing = editingId ? entries.find((e) => e.id === editingId) ?? null : null;

    // Redigering af en enkelt del i en frokost-opdeling: opdatér kun den linje.
    if (editing && editing.splitGroupId) {
      await store().updateEntry(editing.id, {
        startTime: draft.startTime,
        endTime: draft.endTime,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        customer: draft.customer.trim(),
        note: draft.note.trim(),
        isRedo: draft.isRedo,
        redoReason: draft.isRedo ? draft.redoReason : null,
        redoNote: draft.isRedo ? draft.redoNote.trim() : "",
        durationMinutes: durationMinutes(draft.startTime, draft.endTime),
      });
      await finish();
      return;
    }

    const others = editing ? entries.filter((e) => e.id !== editing.id) : entries;
    const lunch = isBreakCategory(draft.categoryId)
      ? null
      : proposeLunchSplit(date, draft.startTime, draft.endTime, others);

    if (lunch) {
      setPending({ draft, lunch, editingId });
      setEditor(null);
    } else {
      await commit(draft, null, editingId);
    }
  }

  async function commit(
    draft: EntryDraft,
    lunch: LunchWindow | null,
    editingId: string | null
  ) {
    if (!employeeId) return;
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e?.splitGroupId) await store().deleteSplitGroup(e.splitGroupId);
      else await store().deleteEntry(editingId);
    }
    const built = buildEntries(draft, date, {
      employeeId,
      lunch,
      newId,
      now: nowIso,
    });
    await store().addEntries(built);
    await finish();
  }

  async function finish() {
    setEditor(null);
    setPending(null);
    await refresh();
  }

  // ---------- slet ----------
  async function handleDelete(entry: TimeEntry) {
    if (entry.splitGroupId) {
      const ok = window.confirm(
        "Denne linje er en del af en frokost-opdeling. Dette sletter hele den splittede registrering (alle dele). Fortsæt?"
      );
      if (!ok) return;
      await store().deleteSplitGroup(entry.splitGroupId);
    } else {
      const ok = window.confirm("Slet denne registrering?");
      if (!ok) return;
      await store().deleteEntry(entry.id);
    }
    await refresh();
  }

  function openNew() {
    // Foreslå næste ledige tidspunkt som start/slut.
    const slot = suggestNextSlot(entries);
    setEditor({
      mode: "new",
      editingId: null,
      initial: { ...emptyDraft(), startTime: slot.startTime, endTime: slot.endTime },
    });
  }

  // ---------- render ----------
  if (!employeeId) {
    return <EmployeeSelect onSelect={selectEmployee} />;
  }

  const editingExisting = editor?.editingId
    ? entries.filter((e) => e.id !== editor.editingId)
    : entries;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">
            SMU Tid{" "}
            <span className="storage-tag" title="Aktiv datalagring">
              {storageName === "supabase" ? "Supabase" : "Lokalt (dev)"}
            </span>
          </h1>
          <div className="who">
            Registrerer som: <strong>{employee?.name ?? employeeId}</strong>
            <button className="switch-btn" onClick={switchEmployee}>
              Skift
            </button>
          </div>
        </div>
        <div className="header-actions">
          <a className="link-btn" href="/oversigt">
            Overblik →
          </a>
          {isSupabaseConfigured && (
            <button className="logout-btn" onClick={() => signOut()}>
              Log ud
            </button>
          )}
        </div>
      </header>

      <div className="datebar">
        <button className="datebtn" aria-label="Forrige dag" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <div className="date-current">
          <div className="date-text">{formatDanishDate(date)}</div>
          <input
            type="date"
            aria-label="Vælg dato"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        <button className="datebtn" aria-label="Næste dag" onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
        <button className="today-btn" onClick={() => setDate(todayIso())}>
          I dag
        </button>
      </div>

      <DaySummary summary={summary} />

      <div className="entry-list">
        {entries.length === 0 ? (
          <div className="empty">Ingen registreringer endnu. Tryk “+ Ny registrering”.</div>
        ) : (
          entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onEdit={(entry) =>
                setEditor({
                  mode: "edit",
                  editingId: entry.id,
                  initial: draftFromEntry(entry),
                })
              }
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <div className="add-bar">
        <button className="btn-primary" onClick={openNew}>
          + Ny registrering
        </button>
      </div>

      {editor && (
        <EntryEditor
          mode={editor.mode}
          workDate={date}
          initial={editor.initial}
          existing={editingExisting}
          onSave={(draft) => requestSave(draft, editor.editingId)}
          onClose={() => setEditor(null)}
        />
      )}

      {pending && (
        <LunchSplitDialog
          draft={pending.draft}
          lunch={pending.lunch}
          onResolve={(split) =>
            commit(pending.draft, split ? pending.lunch : null, pending.editingId)
          }
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
