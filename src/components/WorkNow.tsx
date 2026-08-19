import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Coffee, CheckCircle2, Pencil, Clock } from "lucide-react";
import {
  CATEGORIES,
  getCategory,
  getSubcategory,
  isBreakCategory,
} from "../data/categories";
import { store, newId, nowIso } from "../lib/storage";
import { getTaskStart, setTaskStart, clearTaskStart, isoToHHMM } from "../lib/currentTaskStart";
import { formatDuration, floorTo15, ceilTo15, toMinutes } from "../lib/time";
import { todayIso } from "../lib/dates";
import {
  applySegmentAction,
  entryFromTimes,
  segmentBlockReason,
  type SegmentDraft,
} from "../lib/currentSegment";
import type { CurrentTask, TimeEntry } from "../types";
import CategoryPicker from "./CategoryPicker";
import TimeSelect from "./TimeSelect";

interface Props {
  employeeId: string;
  /** Dagens historik (til at genoptage seneste arbejdsopgave efter pause). */
  entries: TimeEntry[];
  /** Kald efter en handling, så historikken genindlæses. */
  onChanged: () => void;
}

type FormMode = null | "switch" | "edit" | "resume" | "finish";

function emptyDraft(): SegmentDraft {
  return {
    categoryId: CATEGORIES[0].id,
    subcategoryId: CATEGORIES[0].subcategories[0]?.id ?? null,
    orderNumber: "",
    note: "",
  };
}

function draftFromTask(t: CurrentTask): SegmentDraft {
  return {
    categoryId: t.categoryId,
    subcategoryId: t.subcategoryId,
    orderNumber: t.orderNumber ?? "",
    note: t.note ?? "",
  };
}

// Seneste arbejdsopgave i dagens historik (til genoptag efter pause).
function lastWorkDraft(entries: TimeEntry[]): SegmentDraft | null {
  const work = entries
    .filter((e) => !(e.isBreak || isBreakCategory(e.categoryId)))
    .sort((a, b) => b.endTime.localeCompare(a.endTime));
  const last = work[0];
  if (!last) return null;
  return {
    categoryId: last.categoryId,
    subcategoryId: last.subcategoryId,
    orderNumber: last.customer,
    note: last.note,
  };
}

// Medarbejderens primærskærm: "Hvad arbejder jeg på nu?" Handlingerne bygger
// tidslinjen automatisk (luk aktivt segment → historik-linje).
export default function WorkNow({ employeeId, entries, onChanged }: Props) {
  const [task, setTask] = useState<CurrentTask | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [draft, setDraft] = useState<SegmentDraft>(emptyDraft());
  const [finishTimes, setFinishTimes] = useState<{ startTime: string; endTime: string }>({
    startTime: "07:30",
    endTime: "08:00",
  });
  const [tick, setTick] = useState(0); // opdaterer løbende tid
  // Synkron guard mod dobbeltklik/re-entry (busy-state opdateres for langsomt).
  const submittingRef = useRef(false);

  async function refresh() {
    setTask(await store().getCurrentTask(employeeId));
    setStartedAt(getTaskStart(employeeId));
  }
  useEffect(() => {
    setFormMode(null);
    setDraft(emptyDraft());
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Løbende tid — opdatér hvert 30. sekund (minut-granularitet er nok til H:MM).
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const atLunch = !!task && isBreakCategory(task.categoryId);
  const staleStart =
    !!startedAt && startedAt.slice(0, 10) !== nowIso().slice(0, 10);

  const startHHMM = startedAt ? isoToHHMM(startedAt) : task ? isoToHHMM(task.updatedAt) : null;
  const elapsedText = (() => {
    if (!startedAt) return null;
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 60000));
    void tick; // afhængighed så teksten genberegnes ved hvert tick
    return formatDuration(mins);
  })();

  async function dispatch(action: Parameters<typeof applySegmentAction>[1]) {
    if (submittingRef.current) return; // synkron guard mod dobbeltklik/re-entry
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = applySegmentAction(
        { task, startedAtIso: startedAt },
        action,
        { employeeId, nowIso: nowIso(), workDate: todayIso(), newId }
      );
      if (r.entry) {
        // Dublet-/overlap-beskyttelse: opret ikke samme/overlappende linje igen.
        const block = segmentBlockReason(r.entry, entries);
        if (block) {
          setError(
            block === "duplicate"
              ? "Registreringen findes allerede — intet nyt oprettet."
              : "Tidsrummet overlapper en eksisterende registrering — intet oprettet."
          );
          return;
        }
        await store().addEntries([r.entry]);
      }
      if (r.nextTask) {
        await store().setCurrentTask(r.nextTask);
        setTaskStart(employeeId, r.nextStartIso!);
      } else {
        await store().clearCurrentTask(employeeId);
        clearTaskStart(employeeId);
      }
      setFormMode(null);
      await refresh();
      onChanged();
    } catch {
      setError("Kunne ikke gemme. Er databasen opdateret?");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  // "Ret aktiv opgave": opdatér felterne UDEN at lukke segmentet (starttid bevares).
  async function saveEdit() {
    if (!task) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
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
      setFormMode(null);
      await refresh();
      onChanged();
    } catch {
      setError("Kunne ikke gemme ændringen.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  // "Tilbage til arbejde": forudfyld seneste arbejdsopgave, men lad medarbejderen
  // bekræfte/tilpasse i formularen før arbejdssegmentet starter.
  function startResume() {
    setDraft(lastWorkDraft(entries) ?? emptyDraft());
    setFormMode("resume");
  }

  // "Afslut opgave": åbn kort bekræftelses-flow med foreslået (rettelig) start/slut.
  function startFinish() {
    const start = floorTo15(isoToHHMM(startedAt ?? task?.updatedAt ?? nowIso()));
    let end = ceilTo15(isoToHHMM(nowIso()));
    if (toMinutes(end) <= toMinutes(start)) end = start;
    setFinishTimes({ startTime: start, endTime: end });
    setFormMode("finish");
  }

  // Gem afsluttet opgave med de bekræftede/rettede tider → historik + ryd aktiv.
  async function saveFinish() {
    if (!task) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const entry = entryFromTimes(task, finishTimes.startTime, finishTimes.endTime, {
        employeeId,
        nowIso: nowIso(),
        workDate: todayIso(),
        newId,
      });
      const block = segmentBlockReason(entry, entries);
      if (block) {
        setError(
          block === "duplicate"
            ? "Registreringen findes allerede — intet nyt oprettet."
            : "Tidsrummet overlapper en eksisterende registrering — intet oprettet."
        );
        return;
      }
      await store().addEntries([entry]);
      await store().clearCurrentTask(employeeId);
      clearTaskStart(employeeId);
      setFormMode(null);
      await refresh();
      onChanged();
    } catch {
      setError("Kunne ikke gemme. Er databasen opdateret?");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const finishValid = toMinutes(finishTimes.endTime) > toMinutes(finishTimes.startTime);

  // ---------- render ----------
  const fields = (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <CategoryPicker
          categoryId={draft.categoryId}
          subcategoryId={draft.subcategoryId}
          onChange={(cat, sub) => setDraft((d) => ({ ...d, categoryId: cat, subcategoryId: sub }))}
        />
      </div>
      <div className="row-2">
        <div className="field">
          <label>Ordre / sag / kunde</label>
          <input
            className="smu-input"
            type="text"
            placeholder="Fx 54277, SMU-0042 eller kundenavn"
            value={draft.orderNumber}
            onChange={(e) => setDraft((d) => ({ ...d, orderNumber: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Note</label>
          <input
            className="smu-input"
            type="text"
            placeholder="Valgfri — hvad arbejder du på"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
        </div>
      </div>
    </>
  );

  const accentCls = formMode ? "" : !task ? "" : atLunch ? " is-pause" : " is-working";

  return (
    <div className={"work-now smu-card" + accentCls}>
      {error && <div className="msg error">{error}</div>}
      {staleStart && (
        <div className="msg warn">
          Du har en aktiv opgave fra en tidligere dag. Afslut den — leder kan rette tiderne bagefter.
        </div>
      )}

      {formMode === "finish" ? (
        /* AFSLUT OPGAVE — bekræft/ret start og slut (ikke den gamle editor) */
        <>
          <div className="wn-title">Afslut opgave</div>
          <div className="wn-task" style={{ marginBottom: 12 }}>
            <span className="wn-cat">{getCategory(task?.categoryId ?? "")?.name ?? "—"}</span>
            {task && getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="wn-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task?.orderNumber && <span className="wn-order"> · {task.orderNumber}</span>}
          </div>
          <div className="row-2">
            <div className="field">
              <label>Start</label>
              <TimeSelect
                value={finishTimes.startTime}
                onChange={(v) => setFinishTimes((t) => ({ ...t, startTime: v }))}
              />
            </div>
            <div className="field">
              <label>Slut</label>
              <TimeSelect
                value={finishTimes.endTime}
                onChange={(v) => setFinishTimes((t) => ({ ...t, endTime: v }))}
              />
            </div>
          </div>
          {!finishValid && <div className="msg error">Slut skal være efter start.</div>}
          <div className="wn-actions">
            <button
              className="smu-btn-primary wn-primary"
              onClick={saveFinish}
              disabled={busy || !finishValid}
            >
              <CheckCircle2 size={16} /> Gem afsluttet opgave
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "resume" ? (
        /* TILBAGE TIL ARBEJDE — bekræft/tilpas seneste opgave */
        <>
          <div className="wn-title">Tilbage til arbejde</div>
          {fields}
          <div className="wn-actions">
            <button
              className="smu-btn-primary wn-primary"
              onClick={() => dispatch({ type: "resume", draft })}
              disabled={busy}
            >
              <Play size={16} /> Tilbage til arbejde
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "switch" || formMode === "edit" ? (
        /* SKIFT eller RET — form */
        <>
          <div className="wn-title">
            {formMode === "switch" ? "Skift opgave" : "Ret aktiv opgave"}
          </div>
          {fields}
          <div className="wn-actions">
            <button
              className="smu-btn-primary wn-primary"
              onClick={() => (formMode === "switch" ? dispatch({ type: "switch", draft }) : saveEdit())}
              disabled={busy}
            >
              {formMode === "switch" ? "Start ny opgave" : "Gem"}
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : !task ? (
        /* IDLE: ingen aktiv opgave → start-form */
        <>
          <div className="wn-title">Hvad arbejder du på nu?</div>
          {fields}
          <div className="wn-actions">
            <button
              className="smu-btn-primary wn-primary"
              onClick={() => dispatch({ type: "start", draft })}
              disabled={busy}
            >
              <Play size={16} /> Start opgave
            </button>
          </div>
        </>
      ) : atLunch ? (
        /* PAUSE */
        <>
          <div className="wn-state">
            <Coffee size={16} /> På pause
          </div>
          {startHHMM && (
            <div className="wn-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText}` : ""}
            </div>
          )}
          <div className="wn-actions">
            <button className="smu-btn-primary wn-primary" onClick={startResume} disabled={busy}>
              <Play size={16} /> Tilbage til arbejde
            </button>
          </div>
        </>
      ) : (
        /* ARBEJDE — aktiv opgave */
        <>
          <div className="wn-live">
            <span className="wn-dot" /> I gang nu
          </div>
          <div className="wn-task">
            <span className="wn-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="wn-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task.orderNumber && <span className="wn-order"> · {task.orderNumber}</span>}
          </div>
          {task.note && <div className="wn-note">{task.note}</div>}
          {startHHMM && (
            <div className="wn-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText} i gang` : ""}
            </div>
          )}
          <div className="wn-actions">
            <button
              className="smu-btn-primary wn-primary"
              onClick={startFinish}
              disabled={busy}
            >
              <CheckCircle2 size={16} /> Afslut opgave
            </button>
            <button
              className="smu-btn-secondary"
              onClick={() => {
                setDraft(emptyDraft());
                setFormMode("switch");
              }}
              disabled={busy}
            >
              <RefreshCw size={15} /> Skift opgave
            </button>
          </div>
          {/* Pause er en tydelig hovedhandling — ikke gemt væk */}
          <button
            className="smu-btn-secondary wn-pause"
            onClick={() => dispatch({ type: "pause" })}
            disabled={busy}
          >
            <Coffee size={16} /> Start pause
          </button>
          <div className="wn-secondary">
            <button
              className="smu-btn-ghost"
              onClick={() => {
                setDraft(draftFromTask(task));
                setFormMode("edit");
              }}
              disabled={busy}
            >
              <Pencil size={14} /> Ret aktiv opgave
            </button>
          </div>
        </>
      )}
    </div>
  );
}
