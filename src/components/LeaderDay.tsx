import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  LayoutGrid,
  ShieldCheck,
  Eye,
  Clock,
  StopCircle,
} from "lucide-react";
import type { CurrentTask, EntryDraft, TimeEntry, Absence } from "../types";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";
import { AppSwitcher } from "../platform-nav/AppSwitcher";
import { isBreakCategory, getCategory, getSubcategory } from "../data/categories";
import { getPerson, loadPeople } from "../lib/people";
import { initStore, store, newId, nowIso } from "../lib/storage";
import { buildEntries } from "../lib/entries";
import { suggestFinishTimes } from "../lib/segment";
import { buildDayTimeline } from "../lib/dayTimeline";
import { proposeLunchSplit, type LunchWindow } from "../lib/lunch";
import { summarizeDay, expectedWorkMinutes } from "../lib/summary";
import { suggestNextSlot } from "../lib/suggest";
import { getTaskStart, clearTaskStart, isoToHHMM } from "../lib/currentTaskStart";
import { durationMinutes } from "../lib/time";
import { todayIso, addDays, formatDanishDate } from "../lib/dates";
import { signOut } from "../lib/auth";
import { useTidRole, canLeaderCorrect } from "../lib/tidRole";
import DaySummary from "./DaySummary";
import DayTimeline from "./DayTimeline";
import EntryEditor, { emptyDraft } from "./EntryEditor";
import LunchSplitDialog from "./LunchSplitDialog";
import UpdateBanner from "./UpdateBanner";
import { appVersionShort } from "../lib/version";

// SMU Tid v2 — LEDER-VISNING af én medarbejders dag ("Andreas' dag").
//
// Dette er IKKE "registrér som medarbejderen". Viewer (den autentificerede leder/admin)
// beholder sin egen identitet; medarbejderen er blot SUBJECT for visningen. Skrivninger
// på subjectets dag lykkes kun fordi RLS tillader leder/admin at korrigere andre
// (smu-os-v2 20260828140001). Read-only for medarbejder/observatør (canLeaderCorrect).
//
// Nås via deep-link fra Overblik: ?medarbejder=<id>&dato=<YYYY-MM-DD>.

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

// Dansk ejefald: "Andreas' dag", "Idas dag".
function subjectDayTitle(name: string): string {
  return `${name}${/[sxzSXZ]$/.test(name) ? "'" : "s"} dag`;
}

interface EditorState {
  mode: "new" | "edit";
  editingId: string | null;
  initial: EntryDraft;
  hint?: string;
}
interface PendingSplit {
  draft: EntryDraft;
  lunch: LunchWindow;
  editingId: string | null;
}

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

export default function LeaderDay() {
  const link = readDeepLink();
  // SUBJECT = medarbejderen hvis dag vi ser. Kommer KUN fra deep-linket — aldrig fra
  // localStorage/vælger. Viewer-identiteten (auth) berøres ikke.
  const [employeeId, setEmployeeId] = useState<string | null>(link.employeeId);
  const [date, setDate] = useState<string>(link.date ?? todayIso());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, setPending] = useState<PendingSplit | null>(null);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");
  const [ready, setReady] = useState(false);
  // Sandt når editoren blev åbnet via "Afslut opgave" — ryd aktuel opgave efter gem.
  const [clearCurrentOnSave, setClearCurrentOnSave] = useState(false);

  const { role } = useTidRole(getSupabaseClient(), isSupabaseConfigured);
  const canCorrect = canLeaderCorrect({ supabaseConfigured: isSupabaseConfigured, role });

  async function refresh(emp = employeeId, d = date) {
    if (!emp) {
      setEntries([]);
      setAbsences([]);
      setCurrentTask(null);
      return;
    }
    setEntries(await store().getEntriesForDate(emp, d));
    setAbsences(await store().getAbsencesForDate(emp, d));
    try {
      setCurrentTask(await store().getCurrentTask(emp));
    } catch {
      setCurrentTask(null);
    }
  }

  useEffect(() => {
    (async () => {
      const name = await initStore();
      setStorageName(name);
      await loadPeople();
      // Kun et gyldigt subject fra profiler er brugbart (fx gammel slug → null).
      setEmployeeId((cur) => (cur && !getPerson(cur) ? null : cur));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) refresh(employeeId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, date, ready]);

  const summary = useMemo(
    () => summarizeDay(entries, expectedWorkMinutes(date), absences),
    [entries, absences, date]
  );
  const timeline = useMemo(() => buildDayTimeline(entries, absences), [entries, absences]);
  const employee = getPerson(employeeId);

  // ---------- gem-flow (leder-korrektion) ----------
  async function requestSave(draft: EntryDraft, editingId: string | null) {
    if (!employeeId) return;
    const editing = editingId ? entries.find((e) => e.id === editingId) ?? null : null;

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

  async function commit(draft: EntryDraft, lunch: LunchWindow | null, editingId: string | null) {
    if (!employeeId) return;
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e?.splitGroupId) await store().deleteSplitGroup(e.splitGroupId);
      else await store().deleteEntry(editingId);
    }
    const built = buildEntries(draft, date, { employeeId, lunch, newId, now: nowIso });
    await store().addEntries(built);

    // "Afslut opgave": nu hvor tiden ER gemt, ryddes medarbejderens aktuelle opgave.
    if (clearCurrentOnSave && !editingId) {
      try {
        await store().clearCurrentTask(employeeId);
      } catch {
        /* fejler blødt */
      }
      clearTaskStart(employeeId);
      setClearCurrentOnSave(false);
    }
    await finish();
  }

  async function finish() {
    setEditor(null);
    setPending(null);
    await refresh();
  }

  async function handleDelete(entry: TimeEntry): Promise<boolean> {
    if (entry.splitGroupId) {
      const ok = window.confirm(
        "Denne linje er en del af en frokost-opdeling. Dette sletter hele den splittede registrering (alle dele). Fortsæt?"
      );
      if (!ok) return false;
      await store().deleteSplitGroup(entry.splitGroupId);
    } else {
      const ok = window.confirm("Slet denne registrering?");
      if (!ok) return false;
      await store().deleteEntry(entry.id);
    }
    await refresh();
    return true;
  }

  async function deleteEditing() {
    const id = editor?.editingId;
    if (!id) return;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (await handleDelete(entry)) setEditor(null);
  }

  function openEdit(entry: TimeEntry) {
    setClearCurrentOnSave(false);
    setEditor({ mode: "edit", editingId: entry.id, initial: draftFromEntry(entry) });
  }

  function openNew(prefill?: Partial<EntryDraft>) {
    setClearCurrentOnSave(false);
    const slot = suggestNextSlot(entries);
    setEditor({
      mode: "new",
      editingId: null,
      initial: { ...emptyDraft(), startTime: slot.startTime, endTime: slot.endTime, ...prefill },
    });
  }

  // "Afslut opgave": åbn editor forudfyldt fra medarbejderens aktuelle opgave.
  // Start = cirka-start (task.updatedAt), slut = nu — begge redigerbare. Systemet
  // GÆTTER ikke et endeligt sluttidspunkt; lederen bekræfter/retter og gemmer.
  function endActiveTask(task: CurrentTask) {
    if (!employeeId) return;
    // Samme afrundingsregel som medarbejderens egen afslutning (nærmeste kvarter +
    // guard), via den fælles helper — så lederflow og medarbejderflow er konsistente.
    const startIso = getTaskStart(employeeId) ?? task.updatedAt;
    const { startTime, endTime } = suggestFinishTimes(startIso, nowIso());
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
      hint: "Bekræft eller ret start og slut. Intet gemmes før du trykker Gem — herefter fjernes den aktive opgave.",
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
    return (
      <div className="picker">
        <p className="picker-sub">
          Ingen medarbejder valgt. Gå til Overblik og klik på en medarbejder for at se dagen.
        </p>
        <a className="smu-btn-primary link-btn" href="/oversigt">
          <LayoutGrid size={15} /> Til Overblik
        </a>
      </div>
    );
  }

  const editingExisting = editor?.editingId
    ? entries.filter((e) => e.id !== editor.editingId)
    : entries;
  const activeTaskStart = currentTask ? isoToHHMM(currentTask.updatedAt) : null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">
            {subjectDayTitle(employee?.name ?? "Medarbejder")}{" "}
            <span className="storage-tag" title="Aktiv datalagring">
              {storageName === "supabase" ? "Supabase" : "Lokalt (dev)"}
            </span>
          </h1>
          <div className="who">
            {canCorrect ? (
              <span className="smu-badge smu-badge-blue">
                <ShieldCheck size={13} /> Leder-korrektion
              </span>
            ) : (
              <span className="smu-badge smu-badge-grey">
                <Eye size={13} /> Kun visning
              </span>
            )}
            <span className="who-sub">
              Du ser dagen for {employee?.name ?? "medarbejderen"} — din egen bruger ændres ikke.
            </span>
          </div>
        </div>
        <div className="header-actions">
          {getSupabaseClient() && (
            <AppSwitcher supabase={getSupabaseClient()!} currentAppKey="tid" />
          )}
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

      {/* Aktiv opgave (status). Vises hvis medarbejderen har en igangværende opgave. */}
      {currentTask && (
        <div className="current-task ld-active">
          <div className="ct-title">
            <Clock size={14} /> Aktiv opgave lige nu
          </div>
          <div className="ct-view">
            <span className="ct-cat">{getCategory(currentTask.categoryId)?.name ?? "—"}</span>
            {getSubcategory(currentTask.categoryId, currentTask.subcategoryId) && (
              <span className="ct-sub">
                {" / "}
                {getSubcategory(currentTask.categoryId, currentTask.subcategoryId)?.name}
              </span>
            )}
            {currentTask.orderNumber && <span className="ct-order"> · {currentTask.orderNumber}</span>}
          </div>
          {currentTask.note && <div className="ct-note">{currentTask.note}</div>}
          {activeTaskStart && <div className="ct-started">Startet ca. {activeTaskStart}</div>}
          {canCorrect && (
            <div className="ct-actions">
              <button className="smu-btn-primary" onClick={() => endActiveTask(currentTask)}>
                <StopCircle size={15} /> Afslut opgave (angiv sluttid)
              </button>
            </div>
          )}
        </div>
      )}

      <DaySummary summary={summary} />

      {timeline.length === 0 ? (
        <div className="empty">Ingen registreringer denne dag.</div>
      ) : (
        <DayTimeline
          blocks={timeline}
          onEditEntry={canCorrect ? openEdit : undefined}
          onFillGap={canCorrect ? (s, e) => openNew({ startTime: s, endTime: e }) : undefined}
        />
      )}

      {canCorrect && (
        <div className="add-bar">
          <button className="smu-btn-secondary" onClick={() => openNew()}>
            <Plus size={16} /> Tilføj registrering
          </button>
        </div>
      )}

      {editor && (
        <EntryEditor
          mode={editor.mode}
          workDate={date}
          initial={editor.initial}
          hint={editor.hint}
          existing={editingExisting}
          allowSetAsCurrent={false}
          onDelete={editor.mode === "edit" ? deleteEditing : undefined}
          onSave={(draft) => requestSave(draft, editor.editingId)}
          onClose={() => {
            setEditor(null);
            setClearCurrentOnSave(false);
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

      <div className="app-version">SMU Tid · v{appVersionShort()}</div>
      <UpdateBanner defer={!!editor || !!pending} />
    </div>
  );
}
