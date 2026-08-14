import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, LogOut, LayoutGrid } from "lucide-react";
import type { CurrentTask, EntryDraft, TimeEntry } from "./types";
import { isBreakCategory } from "./data/categories";
import { getPerson, loadPeople } from "./lib/people";
import { initStore, store, newId, nowIso } from "./lib/storage";
import { buildEntries } from "./lib/entries";
import { proposeLunchSplit, expectedLunchPlaceholder, type LunchWindow } from "./lib/lunch";
import { summarizeDay, expectedWorkMinutes } from "./lib/summary";
import { suggestNextSlot } from "./lib/suggest";
import { getTaskStart, clearTaskStart, isoToHHMM } from "./lib/currentTaskStart";
import { durationMinutes, toMinutes } from "./lib/time";
import { todayIso, addDays, formatDanishDate } from "./lib/dates";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { signOut } from "./lib/auth";
import DaySummary from "./components/DaySummary";
import EntryRow from "./components/EntryRow";
import EntryEditor, { emptyDraft } from "./components/EntryEditor";
import EmployeeSelect from "./components/EmployeeSelect";
import LunchSplitDialog from "./components/LunchSplitDialog";
import LunchPlaceholderRow from "./components/LunchPlaceholderRow";
import CurrentTaskCard from "./components/CurrentTaskCard";

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
  /** Valgfri hjælpetekst i editoren (fx ved "Afslut og registrér tid"). */
  hint?: string;
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
      employeeId: emp || null, // valideres mod profiler efter load
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
  // Bumpes når aktuel opgave sættes fra editoren, så CurrentTaskCard genindlæser.
  const [currentTaskVersion, setCurrentTaskVersion] = useState(0);
  // Sandt når editoren blev åbnet via "Afslut og registrér tid" — så ryddes
  // aktuel opgave efter et vellykket gem (men ikke ved Annuller).
  const [clearCurrentOnSave, setClearCurrentOnSave] = useState(false);

  async function refresh(emp = employeeId, d = date) {
    if (!emp) {
      setEntries([]);
      return;
    }
    setEntries(await store().getEntriesForDate(emp, d));
  }

  // Initialiser storage + hent medarbejdere (profiler) én gang.
  useEffect(() => {
    (async () => {
      const name = await initStore();
      setStorageName(name);
      await loadPeople();
      // Ryd et gemt/deep-linket valg der ikke findes i profiler (fx gammel slug).
      setEmployeeId((cur) => (cur && !getPerson(cur) ? null : cur));
      setReady(true);
    })();
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

  // Dagssedlens rækker: registreringer + en evt. "forventet frokost"-placeholder,
  // sorteret efter starttid. Placeholderen er rent visuel (ingen sum, ingen DB).
  type DayRow =
    | { kind: "entry"; start: number; entry: TimeEntry }
    | { kind: "lunch"; start: number; lunch: LunchWindow };
  const dayRows = useMemo<DayRow[]>(() => {
    const rows: DayRow[] = entries.map((e) => ({
      kind: "entry",
      start: toMinutes(e.startTime),
      entry: e,
    }));
    const lunch = expectedLunchPlaceholder(date, entries);
    if (lunch) rows.push({ kind: "lunch", start: toMinutes(lunch.startTime), lunch });
    return rows.sort((a, b) => a.start - b.start);
  }, [entries, date]);

  const employee = getPerson(employeeId);

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
  // Aktuel opgave = STATUS, ikke tidsregistrering. Sætter kun en separat række
  // i tid_current_tasks — rører aldrig time_entries eller nogen beregning.
  async function applyCurrentTask(draft: EntryDraft) {
    if (!employeeId) return;
    try {
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.customer.trim() || null,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setCurrentTaskVersion((v) => v + 1);
    } catch {
      // Fejler blødt (tabellen mangler måske endnu) — blokerer ikke gem af tid.
    }
  }

  async function requestSave(
    draft: EntryDraft,
    editingId: string | null,
    setAsCurrent = false
  ) {
    if (!employeeId) return;
    if (setAsCurrent) {
      await applyCurrentTask(draft);
      setClearCurrentOnSave(false); // sæt-også vinder over ryd-efter-gem
    }
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

    // "Afslut og registrér tid": nu hvor tiden ER gemt, ryddes aktuel opgave.
    if (clearCurrentOnSave && !editingId) {
      try {
        await store().clearCurrentTask(employeeId);
      } catch {
        // fejler blødt
      }
      clearTaskStart(employeeId);
      setClearCurrentOnSave(false);
      setCurrentTaskVersion((v) => v + 1);
    }

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

  function openNew(prefill?: Partial<EntryDraft>) {
    // Normal "Ny registrering": rører ikke aktuel opgave.
    setClearCurrentOnSave(false);
    const slot = suggestNextSlot(entries);
    setEditor({
      mode: "new",
      editingId: null,
      initial: {
        ...emptyDraft(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        ...prefill,
      },
    });
  }

  // "Afslut og registrér tid": åbn normal editor forudfyldt fra aktuel opgave.
  // Start = cirka-starttidspunktet, Slut = nu. Intet gemmes før brugeren trykker
  // Gem; ved gem ryddes aktuel opgave (clearCurrentOnSave).
  function registerFromCurrentTask(task: CurrentTask) {
    if (!employeeId) return;
    const startIso = getTaskStart(employeeId) ?? task.updatedAt;
    const startTime = isoToHHMM(startIso);
    const nowHHMM = isoToHHMM(nowIso());
    // Slut skal være efter start; ellers falder vi tilbage til foreslået slot.
    const endTime = nowHHMM > startTime ? nowHHMM : suggestNextSlot(entries).endTime;

    setClearCurrentOnSave(true);
    setEditor({
      mode: "new",
      editingId: null,
      initial: {
        ...emptyDraft(),
        startTime,
        endTime,
        categoryId: task.categoryId,
        subcategoryId: task.subcategoryId,
        customer: task.orderNumber ?? "",
        note: task.note ?? "",
      },
      hint: "Ret tiderne hvis de ikke passer, før du gemmer.",
    });
  }

  // ---------- render ----------
  if (!ready) {
    return (
      <div className="picker">
        <p className="picker-sub">Indlæser…</p>
      </div>
    );
  }
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
            Du registrerer nu som: <strong>{employee?.name ?? employeeId}</strong>
            <button className="smu-btn-ghost" onClick={switchEmployee}>
              Skift
            </button>
          </div>
        </div>
        <div className="header-actions">
          <a className="smu-btn-secondary link-btn" href="/oversigt">
            <LayoutGrid size={15} /> Overblik
          </a>
          {isSupabaseConfigured && (
            <button className="smu-btn-secondary link-btn" onClick={() => signOut()}>
              <LogOut size={15} /> Log ud
            </button>
          )}
        </div>
      </header>

      <div className="datebar">
        <button className="icon-btn" aria-label="Forrige dag" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={20} />
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
        <button className="icon-btn" aria-label="Næste dag" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={20} />
        </button>
        <button className="smu-btn-secondary" onClick={() => setDate(todayIso())}>
          I dag
        </button>
      </div>

      <CurrentTaskCard
        employeeId={employeeId}
        refreshSignal={currentTaskVersion}
        onRegister={registerFromCurrentTask}
      />

      <DaySummary summary={summary} />

      <div className="entry-list">
        {dayRows.length === 0 ? (
          <div className="empty">Ingen registreringer endnu. Tryk “+ Ny registrering”.</div>
        ) : (
          dayRows.map((r) =>
            r.kind === "entry" ? (
              <EntryRow
                key={r.entry.id}
                entry={r.entry}
                onEdit={(entry) =>
                  setEditor({
                    mode: "edit",
                    editingId: entry.id,
                    initial: draftFromEntry(entry),
                  })
                }
                onDelete={handleDelete}
              />
            ) : (
              <LunchPlaceholderRow key="lunch-placeholder" window={r.lunch} />
            )
          )
        )}
      </div>

      <div className="add-bar">
        <button className="smu-btn-primary" onClick={() => openNew()}>
          <Plus size={18} /> Ny registrering
        </button>
      </div>

      {editor && (
        <EntryEditor
          mode={editor.mode}
          workDate={date}
          initial={editor.initial}
          hint={editor.hint}
          existing={editingExisting}
          onSave={(draft, setAsCurrent) =>
            requestSave(draft, editor.editingId, setAsCurrent)
          }
          onClose={() => {
            setEditor(null);
            setClearCurrentOnSave(false); // Annuller → aktuel opgave bevares
          }}
        />
      )}

      {pending && (
        <LunchSplitDialog
          draft={pending.draft}
          lunch={pending.lunch}
          onResolve={(lunch) => commit(pending.draft, lunch, pending.editingId)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
