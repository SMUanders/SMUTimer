import { useEffect, useRef, useState } from "react";
import { Play, Coffee, CheckCircle2, Pencil, Clock, Square, RotateCcw, Users, UserMinus } from "lucide-react";
import {
  CATEGORIES,
  getCategory,
  getSubcategory,
  isBreakCategory,
  BREAK_CATEGORY_ID,
  LUNCH_SUBCATEGORY_ID,
  REDO_REASONS,
  getRedoReason,
} from "../data/categories";
import { store, newId, nowIso } from "../lib/storage";
import { getTaskStart, setTaskStart, clearTaskStart, isoToHHMM } from "../lib/currentTaskStart";
import { formatDuration, toMinutes } from "../lib/time";
import { todayIso } from "../lib/dates";
import { isDayEnded, setDayEnded } from "../lib/dayEnded";
import { getHelp, setHelp, clearHelp, helpNote } from "../lib/helpContext";
import type { OwnTask } from "../lib/helpContext";
import { getPause, setPause, clearPause } from "../lib/pauseContext";
import { getRedo, setRedo, clearRedo } from "../lib/redoContext";
import type { RedoContext } from "../lib/redoContext";
import { ABSENCE_TYPES, absenceTypeName } from "../data/absences";
import { activeAbsence, lastAbsenceEndHHMM } from "../lib/absence";
import { getPersonName } from "../lib/people";
import {
  hhmmToIsoToday,
  buildEntry,
  isExactDuplicate,
  suggestStart,
  suggestEnd,
  suggestSwitchAt,
  activeStartHHMM,
  ownCloseUntil,
  helpStartHHMM,
  helpEndHHMM,
  lastEntryEndHHMM,
  finishError,
  switchError,
} from "../lib/segment";
import type { CurrentTask, TimeEntry, Absence } from "../types";
import CategoryPicker from "./CategoryPicker";
import TimeSelect from "./TimeSelect";
import SagPicker from "./SagPicker";
import EnhedPicker from "./EnhedPicker";

interface Props {
  employeeId: string;
  entries: TimeEntry[]; // dagens historik (til eksakt-dublet-tjek)
  onChanged: () => void;
}

interface WorkDraft {
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string;
  /** Stabil SMU-sag-reference, hvis valgt via SagPicker (ellers null = fri reference). */
  sagId: string | null;
  sagSmuNummer: string | null;
  /** Blød reference til OS-enhed (TR-088); null = sagsniveau/intern tid. */
  enhedId: string | null;
  /** Display-snapshot af enheden ("#3 · beskrivelse · reg.nr"). */
  enhedVisning: string | null;
  note: string;
}

type FormMode =
  | null
  | "startWork"
  | "startPause"
  | "finishWork"
  | "finishPause"
  | "editWork"
  | "startHelp"
  | "finishHelp"
  | "startRedo"
  | "finishRedo"
  | "registerAbsence";

const PAUSE_TYPES = getCategory(BREAK_CATEGORY_ID)?.subcategories ?? [];

function emptyDraft(): WorkDraft {
  return {
    categoryId: CATEGORIES[0].id,
    subcategoryId: CATEGORIES[0].subcategories[0]?.id ?? null,
    orderNumber: "",
    sagId: null,
    sagSmuNummer: null,
    enhedId: null,
    enhedVisning: null,
    note: "",
  };
}
function draftFromTask(t: CurrentTask): WorkDraft {
  return {
    categoryId: t.categoryId,
    subcategoryId: t.subcategoryId,
    orderNumber: t.orderNumber ?? "",
    sagId: t.sagId ?? null,
    sagSmuNummer: t.sagSmuNummer ?? null,
    enhedId: t.enhedId ?? null,
    enhedVisning: t.enhedVisning ?? null,
    note: t.note ?? "",
  };
}

export default function DayScreen({ employeeId, entries, onChanged }: Props) {
  const [task, setTask] = useState<CurrentTask | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [dayEnded, setDayEndedState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft());
  const [pauseType, setPauseType] = useState<string>(LUNCH_SUBCATEGORY_ID);
  const [pauseStart, setPauseStart] = useState<string>("12:00");
  const [finish, setFinish] = useState<{ startTime: string; endTime: string; note: string; pauseType: string }>({
    startTime: "07:30",
    endTime: "08:00",
    note: "",
    pauseType: LUNCH_SUBCATEGORY_ID,
  });
  const [tick, setTick] = useState(0);
  // "Hjælp på anden opgave": den EGNE opgave der kan genoptages bagefter.
  const [helpOwn, setHelpOwn] = useState<OwnTask | null>(null);
  // "Pause fra aktiv opgave": den oprindelige opgave der genoptages efter pausen.
  const [pauseOwn, setPauseOwn] = useState<OwnTask | null>(null);
  // Kollegaers aktive opgaver lige nu (forslag når man vælger hjælp-opgave).
  const [colleagues, setColleagues] = useState<CurrentTask[]>([]);
  // "Omgøring": oprindelig opgave (til genoptag) + valgt årsag.
  const [redoCtx, setRedoCtx] = useState<RedoContext | null>(null);
  const [redoReason, setRedoReason] = useState<string>(REDO_REASONS[0].id);
  const [redoNote, setRedoNote] = useState<string>("");
  // true = selvstændig omgøring fra "Hvad nu?" (vælg opgave); false = fra aktiv opgave.
  const [redoStandalone, setRedoStandalone] = useState<boolean>(false);
  // Fravær i arbejdsdagen (delt status via tid_absences).
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absType, setAbsType] = useState<string>(ABSENCE_TYPES[0].id);
  const [absFrom, setAbsFrom] = useState<string>("09:00");
  const [absTo, setAbsTo] = useState<string>("");
  const [absNote, setAbsNote] = useState<string>("");
  const submittingRef = useRef(false);

  const today = todayIso();

  async function refresh() {
    setTask(await store().getCurrentTask(employeeId));
    setStartedAt(getTaskStart(employeeId));
    setDayEndedState(isDayEnded(employeeId, today));
    setHelpOwn(getHelp(employeeId));
    setPauseOwn(getPause(employeeId));
    setRedoCtx(getRedo(employeeId));
    setAbsences(await store().getAbsencesForDate(employeeId, today));
  }
  useEffect(() => {
    setFormMode(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const isPause = !!task && isBreakCategory(task.categoryId);
  // Aktiv omgøring = husket omgøring-kontekst + aktiv (ikke-pause) opgave.
  const isRedoActive = !!redoCtx && !!task && !isPause;
  // Aktiv hjælp = husket egen opgave + aktiv (ikke-pause) opgave, og IKKE omgøring.
  const isHelp = !!helpOwn && !redoCtx && !!task && !isPause;
  // Aktivt fravær (ude nu) — vises i stedet for "Hvad nu?".
  const activeAbs = activeAbsence(absences);
  // Seneste registrerings ELLER fraværs sluttid samme dag. Forslag starter aldrig før
  // denne (intet overlap); i segment-reglerne klampes den til nu.
  const lastEnd = (() => {
    const e = lastEntryEndHHMM(entries);
    const a = lastAbsenceEndHHMM(absences);
    if (e && a) return Number(e.replace(":", "")) >= Number(a.replace(":", "")) ? e : a;
    return e ?? a;
  })();
  // "Nu" som HH:MM (genberegnes ved hvert tick). Alle tidsforslag tager udgangspunkt i det.
  void tick;
  const nowHM = isoToHHMM(nowIso());
  // Den aktive opgaves start: præcis det kortet viser OG det afslutningen foreslår.
  const startHHMM = task ? activeStartHHMM(startedAt, task.updatedAt, nowHM, lastEnd) : null;
  const elapsedText = (() => {
    if (!startedAt) return null;
    void tick;
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 60000));
    return formatDuration(mins);
  })();

  // ---- handlinger (alle med synkron guard mod dobbeltklik) ----
  async function guarded(run: () => Promise<void>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch {
      setError("Kunne ikke gemme. Er databasen opdateret?");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  // Friske tider i selve handlingen (ikke fra sidste render).
  const nu = () => isoToHHMM(nowIso());
  const egenStart = (t: CurrentTask) => activeStartHHMM(startedAt, t.updatedAt, nu(), lastEnd);

  function startWorkSubmit() {
    guarded(async () => {
      const n = nu();
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.orderNumber.trim() || null,
        sagId: draft.sagId,
        sagSmuNummer: draft.sagSmuNummer,
        enhedId: draft.enhedId,
        enhedVisning: draft.enhedVisning,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      // Start = nu rundet ned til 5 min, aldrig før seneste sluttid. Kortet viser præcis denne.
      setTaskStart(employeeId, hhmmToIsoToday(suggestStart(n, n, lastEnd)));
      setDayEnded(employeeId, today, false);
      clearHelp(employeeId); // en ny/ genoptaget normal opgave er ikke en hjælp-session
      clearRedo(employeeId); // …og ikke en omgøring
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  function startPauseSubmit() {
    const fejl = switchError(pauseStart, nu(), lastEnd);
    if (fejl) {
      setError(fejl);
      return;
    }
    guarded(async () => {
      // Pause tilbydes kun fra en NORMAL aktiv opgave eller fra "Hvad nu?" (task=null).
      // Er der en normal opgave aktiv, lukkes den til historik og huskes til genoptag.
      const resume = task && !isBreakCategory(task.categoryId) ? task : null;
      if (resume) {
        // Luk den normale opgave frem til pausestart (rører, aldrig overlap). Null = under
        // ét minut, eller pausen er sat før opgavens start → ingen egen-linje.
        const own = ownCloseUntil(egenStart(resume), pauseStart);
        if (own) {
          const ownClose = buildEntry({
            employeeId,
            workDate: today,
            startTime: own.startTime,
            endTime: own.endTime,
            categoryId: resume.categoryId,
            subcategoryId: resume.subcategoryId,
            orderNumber: resume.orderNumber ?? "",
            sagId: resume.sagId,
            sagSmuNummer: resume.sagSmuNummer,
            enhedId: resume.enhedId,
            enhedVisning: resume.enhedVisning,
            note: resume.note ?? "",
            newId,
            nowIso: nowIso(),
          });
          if (!isExactDuplicate(ownClose, entries)) {
            await store().addEntries([ownClose]);
          }
        }
        // Husk opgaven, så den genoptages automatisk når pausen slutter.
        setPause(employeeId, {
          categoryId: resume.categoryId,
          subcategoryId: resume.subcategoryId,
          orderNumber: resume.orderNumber ?? "",
          sagId: resume.sagId,
          sagSmuNummer: resume.sagSmuNummer,
          enhedId: resume.enhedId,
          enhedVisning: resume.enhedVisning,
          note: resume.note ?? "",
        });
      } else {
        clearPause(employeeId); // standalone pause fra "Hvad nu?" — ingen genoptag
      }
      await store().setCurrentTask({
        employeeId,
        categoryId: BREAK_CATEGORY_ID,
        subcategoryId: pauseType,
        orderNumber: null,
        sagId: null,
        sagSmuNummer: null,
        enhedId: null,
        enhedVisning: null,
        note: null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setTaskStart(employeeId, hhmmToIsoToday(pauseStart));
      setDayEnded(employeeId, today, false);
      clearHelp(employeeId); // en pause er ikke en hjælp-session
      clearRedo(employeeId); // …og ikke en omgøring
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  function saveEditWork() {
    if (!task) return;
    guarded(async () => {
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.orderNumber.trim() || null,
        sagId: draft.sagId,
        sagSmuNummer: draft.sagSmuNummer,
        enhedId: draft.enhedId,
        enhedVisning: draft.enhedVisning,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  function finishWorkSubmit() {
    if (!task) return;
    guarded(async () => {
      const entry = buildEntry({
        employeeId,
        workDate: today,
        startTime: finish.startTime,
        endTime: finish.endTime,
        categoryId: task.categoryId,
        subcategoryId: task.subcategoryId,
        orderNumber: task.orderNumber ?? "",
        sagId: task.sagId,
        sagSmuNummer: task.sagSmuNummer,
        enhedId: task.enhedId,
        enhedVisning: task.enhedVisning,
        note: finish.note,
        newId,
        nowIso: nowIso(),
      });
      if (isExactDuplicate(entry, entries)) {
        setError("Registreringen findes allerede — intet nyt oprettet.");
        return;
      }
      await store().addEntries([entry]);
      await store().clearCurrentTask(employeeId);
      clearTaskStart(employeeId);
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  function finishPauseSubmit() {
    if (!task) return;
    guarded(async () => {
      const entry = buildEntry({
        employeeId,
        workDate: today,
        startTime: finish.startTime,
        endTime: finish.endTime,
        categoryId: BREAK_CATEGORY_ID,
        subcategoryId: finish.pauseType,
        orderNumber: "",
        note: "",
        newId,
        nowIso: nowIso(),
      });
      if (isExactDuplicate(entry, entries)) {
        setError("Pausen findes allerede — intet nyt oprettet.");
        return;
      }
      await store().addEntries([entry]);
      if (pauseOwn) {
        // Pause startet fra en aktiv opgave → genoptag den automatisk fra pausens sluttid.
        await store().setCurrentTask({
          employeeId,
          categoryId: pauseOwn.categoryId,
          subcategoryId: pauseOwn.subcategoryId,
          orderNumber: pauseOwn.orderNumber.trim() || null,
          sagId: pauseOwn.sagId ?? null,
          sagSmuNummer: pauseOwn.sagSmuNummer ?? null,
          enhedId: pauseOwn.enhedId ?? null,
          enhedVisning: pauseOwn.enhedVisning ?? null,
          note: pauseOwn.note.trim() || null,
          updatedAt: nowIso(),
          updatedBy: null,
        });
        setTaskStart(employeeId, hhmmToIsoToday(finish.endTime));
        clearPause(employeeId);
      } else {
        // Standalone pause → tilbage til "Hvad nu?".
        await store().clearCurrentTask(employeeId);
        clearTaskStart(employeeId);
      }
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // ---- Hjælp på anden opgave ----
  // Start hjælp: luk den EGNE opgave som historiklinje frem til nu, husk den til
  // genoptag, og gør hjælp-opgaven aktiv. Kun ÉN aktiv registrering ad gangen.
  function startHelpSubmit() {
    if (!task) return;
    guarded(async () => {
      // Hjælp er et stopur: start på det faktiske minut (aldrig før seneste sluttid).
      const hs = helpStartHHMM(nu(), lastEnd);
      // Luk egen opgave frem til hjælpens start (rører, aldrig overlap). Null = egen
      // opgave var aktiv under ét minut → ingen egen-linje.
      const own = ownCloseUntil(egenStart(task), hs);
      if (own) {
        const ownClose = buildEntry({
          employeeId,
          workDate: today,
          startTime: own.startTime,
          endTime: own.endTime,
          categoryId: task.categoryId,
          subcategoryId: task.subcategoryId,
          orderNumber: task.orderNumber ?? "",
          sagId: task.sagId,
          sagSmuNummer: task.sagSmuNummer,
          enhedId: task.enhedId,
          enhedVisning: task.enhedVisning,
          note: task.note ?? "",
          newId,
          nowIso: nowIso(),
        });
        if (!isExactDuplicate(ownClose, entries)) {
          await store().addEntries([ownClose]);
        }
      }
      // Husk den egne opgave (til at genoptage bagefter) — inkl. sag-reference.
      setHelp(employeeId, {
        categoryId: task.categoryId,
        subcategoryId: task.subcategoryId,
        orderNumber: task.orderNumber ?? "",
        sagId: task.sagId,
        sagSmuNummer: task.sagSmuNummer,
        enhedId: task.enhedId,
        enhedVisning: task.enhedVisning,
        note: task.note ?? "",
      });
      // Hjælp-opgaven bliver den aktive opgave; gem HS som starttidspunkt.
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.orderNumber.trim() || null,
        sagId: draft.sagId,
        sagSmuNummer: draft.sagSmuNummer,
        enhedId: draft.enhedId,
        enhedVisning: draft.enhedVisning,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setTaskStart(employeeId, hhmmToIsoToday(hs));
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // Mini-stopur: ét tryk stopper hjælpen og genoptager egen opgave automatisk.
  // Ingen afslut-form, ingen ekstra "Start opgave"-tryk.
  function stopHelp() {
    if (!task || !helpOwn) return;
    guarded(async () => {
      const hs = egenStart(task);
      // Præcise minutter, intet minimum: 3 min hjælp = 3 min. Under ét minut → ingen linje.
      const he = helpEndHHMM(hs, nu());
      if (he) {
        const entry = buildEntry({
          employeeId,
          workDate: today,
          startTime: hs,
          endTime: he,
          categoryId: task.categoryId,
          subcategoryId: task.subcategoryId,
          orderNumber: task.orderNumber ?? "",
          sagId: task.sagId,
          sagSmuNummer: task.sagSmuNummer,
          enhedId: task.enhedId,
          enhedVisning: task.enhedVisning,
          // Hjælp-mærket + medarbejderens egen note fra hjælp-formularen (tidligere tabt).
          note: helpNote(task.note ?? ""),
          newId,
          nowIso: nowIso(),
        });
        if (!isExactDuplicate(entry, entries)) {
          await store().addEntries([entry]);
        }
      }
      // Genoptag egen opgave automatisk fra hjælpens sluttid (intet overlap).
      await store().setCurrentTask({
        employeeId,
        categoryId: helpOwn.categoryId,
        subcategoryId: helpOwn.subcategoryId,
        orderNumber: helpOwn.orderNumber.trim() || null,
        sagId: helpOwn.sagId ?? null,
        sagSmuNummer: helpOwn.sagSmuNummer ?? null,
        enhedId: helpOwn.enhedId ?? null,
        enhedVisning: helpOwn.enhedVisning ?? null,
        note: helpOwn.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setTaskStart(employeeId, hhmmToIsoToday(he ?? hs));
      clearHelp(employeeId);
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // ---- Omgøring (to veje) ----
  // A: fra AKTIV opgave → omgøring på SAMME opgave, luk normal opgave frem til
  //    omgøringens start, husk den til auto-genoptag.
  // B: fra "Hvad nu?" (ingen aktiv opgave) → SELVSTÆNDIG omgøring på en valgt
  //    opgave, ingen normal opgave at lukke, ingen genoptagelse.
  function startRedoSubmit() {
    guarded(async () => {
      // Vej A: skiftet sker nu (5-min-forslag efter egen start). Vej B: start som en ny
      // opgave. Begge aldrig før seneste sluttid og aldrig efter nu.
      const n = nu();
      const rs = task ? suggestSwitchAt(egenStart(task), n) : suggestStart(n, n, lastEnd);
      let ownTask: OwnTask | null = null;
      if (task) {
        // Vej A: luk den aktive opgave frem til omgøringens start (rører, intet overlap).
        const own = ownCloseUntil(egenStart(task), rs);
        if (own) {
          const ownClose = buildEntry({
            employeeId,
            workDate: today,
            startTime: own.startTime,
            endTime: own.endTime,
            categoryId: task.categoryId,
            subcategoryId: task.subcategoryId,
            orderNumber: task.orderNumber ?? "",
            sagId: task.sagId,
            sagSmuNummer: task.sagSmuNummer,
            enhedId: task.enhedId,
            enhedVisning: task.enhedVisning,
            note: task.note ?? "",
            newId,
            nowIso: nowIso(),
          });
          if (!isExactDuplicate(ownClose, entries)) {
            await store().addEntries([ownClose]);
          }
        }
        ownTask = {
          categoryId: task.categoryId,
          subcategoryId: task.subcategoryId,
          orderNumber: task.orderNumber ?? "",
          sagId: task.sagId,
          sagSmuNummer: task.sagSmuNummer,
          enhedId: task.enhedId,
          enhedVisning: task.enhedVisning,
          note: task.note ?? "",
        };
      }
      // Husk omgørings-kontekst (ownTask=null ⇒ selvstændig, ingen genoptag).
      setRedo(employeeId, { ownTask, reason: redoReason, note: redoNote.trim() });
      // Omgøringen bliver den aktive opgave (A: samme opgave; B: valgt opgave).
      await store().setCurrentTask({
        employeeId,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        orderNumber: draft.orderNumber.trim() || null,
        sagId: draft.sagId,
        sagSmuNummer: draft.sagSmuNummer,
        enhedId: draft.enhedId,
        enhedVisning: draft.enhedVisning,
        note: draft.note.trim() || null,
        updatedAt: nowIso(),
        updatedBy: null,
      });
      setTaskStart(employeeId, hhmmToIsoToday(rs));
      clearHelp(employeeId); // omgøring er ikke en hjælp-session
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // Afslut omgøring: gem struktureret omgøring (isRedo + årsag + note). Vej A →
  // auto-genoptag oprindelig opgave fra sluttid; vej B → tilbage til "Hvad nu?".
  function finishRedoSubmit() {
    if (!task || !redoCtx) return;
    guarded(async () => {
      const entry = buildEntry({
        employeeId,
        workDate: today,
        startTime: finish.startTime,
        endTime: finish.endTime,
        categoryId: task.categoryId,
        subcategoryId: task.subcategoryId,
        orderNumber: task.orderNumber ?? "",
        sagId: task.sagId,
        sagSmuNummer: task.sagSmuNummer,
        enhedId: task.enhedId,
        enhedVisning: task.enhedVisning,
        note: "",
        isRedo: true,
        redoReason,
        redoNote: finish.note,
        newId,
        nowIso: nowIso(),
      });
      if (isExactDuplicate(entry, entries)) {
        setError("Omgøringen findes allerede — intet nyt oprettet.");
        return;
      }
      await store().addEntries([entry]);
      if (redoCtx.ownTask) {
        // Vej A: genoptag oprindelig opgave automatisk fra omgøringens sluttid.
        await store().setCurrentTask({
          employeeId,
          categoryId: redoCtx.ownTask.categoryId,
          subcategoryId: redoCtx.ownTask.subcategoryId,
          orderNumber: redoCtx.ownTask.orderNumber.trim() || null,
          sagId: redoCtx.ownTask.sagId ?? null,
          sagSmuNummer: redoCtx.ownTask.sagSmuNummer ?? null,
          enhedId: redoCtx.ownTask.enhedId ?? null,
          enhedVisning: redoCtx.ownTask.enhedVisning ?? null,
          note: redoCtx.ownTask.note.trim() || null,
          updatedAt: nowIso(),
          updatedBy: null,
        });
        setTaskStart(employeeId, hhmmToIsoToday(finish.endTime));
      } else {
        // Vej B: ingen tidligere opgave → tilbage til "Hvad nu?".
        await store().clearCurrentTask(employeeId);
        clearTaskStart(employeeId);
      }
      clearRedo(employeeId);
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // ---- Fravær i arbejdsdagen ----
  // Registrér fravær: opret delt fraværsstatus. Ingen arbejdsopgave aktiv;
  // fraværet tæller ALDRIG som arbejdstid/pause.
  function registerAbsenceSubmit() {
    guarded(async () => {
      const absence: Absence = {
        id: newId(),
        employeeId,
        workDate: today,
        startTime: absFrom,
        expectedEnd: absTo.trim() || null, // tom = "tilbage senere" (ukendt)
        ended: null, // stadig ude = aktivt
        absenceType: absType,
        note: absNote.trim(),
        slettet: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await store().addAbsence(absence);
      setDayEnded(employeeId, today, false);
      setFormMode(null);
      await refresh();
      onChanged();
    });
  }

  // "Jeg er tilbage": afslut fraværet på faktisk tidspunkt. Opretter INGEN
  // arbejdsregistrering — næste opgave startes normalt bagefter.
  function returnFromAbsence() {
    if (!activeAbs) return;
    guarded(async () => {
      // Tilbage = nu (rundet ned til 5 min, aldrig efter nu). Startede fraværet først
      // nu/senere, afsluttes det på sin starttid — aldrig på en fremtidig "forventet" tid.
      const n = nu();
      const rt = toMinutes(n) > toMinutes(activeAbs.startTime) ? suggestEnd(activeAbs.startTime, n) : activeAbs.startTime;
      await store().endAbsence(activeAbs.id, rt);
      await refresh();
      onChanged();
    });
  }

  function endDay() {
    setDayEnded(employeeId, today, true);
    setDayEndedState(true);
  }
  function resumeDay() {
    setDayEnded(employeeId, today, false);
    setDayEndedState(false);
  }

  // ---- form-åbnere ----
  function openStartWork() {
    setDraft(emptyDraft());
    setFormMode("startWork");
  }
  function openStartPause(fromActive = false) {
    setPauseType(LUNCH_SUBCATEGORY_ID);
    // Fra aktiv opgave: pausen starter nu (rundet ned til 5 min efter opgavens start) —
    // den aktive opgave lukkes frem til dette tidspunkt. Fra "Hvad nu?": nu rundet ned,
    // aldrig før seneste sluttid. Medarbejderen kan rette tidspunktet i formen.
    const n = nu();
    setPauseStart(fromActive && task ? suggestSwitchAt(egenStart(task), n) : suggestStart(n, n, lastEnd));
    setFormMode("startPause");
  }
  function openEditWork() {
    if (task) setDraft(draftFromTask(task));
    setFormMode("editWork");
  }
  // Afslutningsforslag: start = præcis den start kortet viser; slut = nu rundet ned til
  // 5 min (det faktiske minut, hvis opgaven er kortere) — aldrig efter nu.
  function finishSuggestion(): { startTime: string; endTime: string } {
    const n = nu();
    const start = task ? egenStart(task) : suggestStart(n, n, lastEnd);
    return { startTime: start, endTime: suggestEnd(start, n) };
  }
  function openFinishWork() {
    const t = finishSuggestion();
    setFinish((f) => ({ ...f, startTime: t.startTime, endTime: t.endTime, note: task?.note ?? "" }));
    setFormMode("finishWork");
  }
  function openFinishPause() {
    const t = finishSuggestion();
    setFinish((f) => ({
      ...f,
      startTime: t.startTime,
      endTime: t.endTime,
      pauseType: task?.subcategoryId ?? LUNCH_SUBCATEGORY_ID,
    }));
    setFormMode("finishPause");
  }
  async function openStartHelp() {
    setDraft(emptyDraft());
    // Forslag: kollegaers aktive (ikke-pause) opgaver lige nu. Hvis ingen findes,
    // vises kun den tomme "Anden opgave"-formular.
    try {
      const all = await store().getAllCurrentTasks();
      setColleagues(all.filter((c) => c.employeeId !== employeeId && !isBreakCategory(c.categoryId)));
    } catch {
      setColleagues([]);
    }
    setFormMode("startHelp");
  }
  // Klik på en aktiv opgave i listen prefiller arbejdsreference + aktivitet.
  // Listen er KUN en genvej — man kan altid indtaste referencen manuelt nedenfor.
  function prefillFromTask(c: CurrentTask) {
    setDraft({
      categoryId: c.categoryId,
      subcategoryId: c.subcategoryId,
      orderNumber: c.orderNumber ?? "",
      sagId: c.sagId ?? null,
      sagSmuNummer: c.sagSmuNummer ?? null,
      enhedId: c.enhedId ?? null,
      enhedVisning: c.enhedVisning ?? null,
      note: c.note ?? "",
    });
  }
  // Vej A: omgøring fra AKTIV opgave — gælder ALTID den aktuelle opgave (arves).
  function openStartRedoFromActive() {
    if (!task) return;
    setRedoStandalone(false);
    setDraft(draftFromTask(task)); // arves fra aktiv opgave (vises read-only)
    setRedoReason(REDO_REASONS[0].id);
    setRedoNote("");
    setFormMode("startRedo");
  }
  // Vej B: selvstændig omgøring fra "Hvad nu?" — medarbejderen vælger opgaven.
  function openStartRedoStandalone() {
    setRedoStandalone(true);
    setDraft(emptyDraft());
    setRedoReason(REDO_REASONS[0].id);
    setRedoNote("");
    setFormMode("startRedo");
  }
  function openFinishRedo() {
    // Samme start som kortet viser (tidligere rundet igen til kvarter → overlap/hul).
    const t = finishSuggestion();
    setFinish((f) => ({ ...f, startTime: t.startTime, endTime: t.endTime, note: redoCtx?.note ?? "" }));
    setRedoReason(redoCtx?.reason ?? REDO_REASONS[0].id);
    setFormMode("finishRedo");
  }
  function openRegisterAbsence() {
    setAbsType(ABSENCE_TYPES[0].id);
    const n = nu();
    setAbsFrom(suggestStart(n, n, lastEnd)); // fra = nu rundet ned, aldrig før seneste sluttid
    setAbsTo("");
    setAbsNote("");
    setFormMode("registerAbsence");
  }

  // Validering af afslutningen: slut efter start, ikke efter nu, intet overlap.
  const finishFejl = finishError(finish.startTime, finish.endTime, nowHM, entries);
  const finishValid = finishFejl === null;
  // Pausens starttid: ikke efter nu, ikke før seneste sluttid.
  const pauseFejl = formMode === "startPause" ? switchError(pauseStart, nowHM, lastEnd) : null;

  // ---- gentaget UI ----
  const workFields = (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <CategoryPicker
          categoryId={draft.categoryId}
          subcategoryId={draft.subcategoryId}
          onChange={(cat, sub) => setDraft((d) => ({ ...d, categoryId: cat, subcategoryId: sub }))}
        />
      </div>
      <SagPicker
        customer={draft.orderNumber}
        sagId={draft.sagId}
        sagSmuNummer={draft.sagSmuNummer}
        onChange={(n) =>
          setDraft((d) => ({
            ...d,
            orderNumber: n.customer,
            sagId: n.sagId,
            sagSmuNummer: n.sagSmuNummer,
            enhedId: null, // ny/ryddet sag → nulstil enhed
            enhedVisning: null,
          }))
        }
      />
      <EnhedPicker
        sagId={draft.sagId}
        categoryId={draft.categoryId}
        enhedId={draft.enhedId}
        enhedVisning={draft.enhedVisning}
        onChange={(n) => setDraft((d) => ({ ...d, enhedId: n.enhedId, enhedVisning: n.enhedVisning }))}
      />
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
    </>
  );

  const timePair = (
    <div className="row-2">
      <div className="field">
        <label>Start</label>
        <TimeSelect value={finish.startTime} onChange={(v) => setFinish((f) => ({ ...f, startTime: v }))} />
      </div>
      <div className="field">
        <label>Slut</label>
        <TimeSelect value={finish.endTime} onChange={(v) => setFinish((f) => ({ ...f, endTime: v }))} />
      </div>
    </div>
  );

  const accentCls = formMode
    ? ""
    : activeAbs
    ? " is-fravaer"
    : !task
    ? ""
    : isPause
    ? " is-pause"
    : isRedoActive
    ? " is-redo"
    : isHelp
    ? " is-help"
    : " is-work";
  const redoReasonSelect = (
    <div className="field">
      <label>Årsag</label>
      <select className="smu-input" value={redoReason} onChange={(e) => setRedoReason(e.target.value)}>
        {REDO_REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={"day-screen smu-card" + accentCls}>
      {error && <div className="msg error">{error}</div>}

      {/* ---------- FORMER ---------- */}
      {formMode === "startWork" ? (
        <>
          <div className="ds-title">Start opgave</div>
          {workFields}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={startWorkSubmit} disabled={busy}>
              <Play size={16} /> Start opgave
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "startPause" ? (
        <>
          <div className="ds-title">Start pause</div>
          <div className="row-2">
            <div className="field">
              <label>Pausetype</label>
              <select className="smu-input" value={pauseType} onChange={(e) => setPauseType(e.target.value)}>
                {PAUSE_TYPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Starttid</label>
              <TimeSelect value={pauseStart} onChange={setPauseStart} />
            </div>
          </div>
          {pauseFejl && <div className="msg error">{pauseFejl}</div>}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={startPauseSubmit} disabled={busy || !!pauseFejl}>
              <Coffee size={16} /> Start pause
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "editWork" ? (
        <>
          <div className="ds-title">
            {isRedoActive ? "Ret aktiv omgøring" : isHelp ? "Ret aktiv hjælp" : "Ret aktiv opgave"}
          </div>
          {workFields}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={saveEditWork} disabled={busy}>
              Gem
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "finishWork" ? (
        <>
          <div className="ds-title">Afslut opgave</div>
          <div className="ds-task" style={{ marginBottom: 12 }}>
            <span className="ds-cat">{getCategory(task?.categoryId ?? "")?.name ?? "—"}</span>
            {task && getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task?.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
            {task?.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
          </div>
          {timePair}
          <div className="field">
            <label>Note</label>
            <input
              className="smu-input"
              type="text"
              value={finish.note}
              onChange={(e) => setFinish((f) => ({ ...f, note: e.target.value }))}
              placeholder="Valgfri"
            />
          </div>
          {finishFejl && <div className="msg error">{finishFejl}</div>}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={finishWorkSubmit} disabled={busy || !finishValid}>
              <CheckCircle2 size={16} /> Gem afsluttet opgave
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "finishPause" ? (
        <>
          <div className="ds-title">Afslut pause</div>
          <div className="field">
            <label>Pausetype</label>
            <select
              className="smu-input"
              value={finish.pauseType}
              onChange={(e) => setFinish((f) => ({ ...f, pauseType: e.target.value }))}
            >
              {PAUSE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {timePair}
          {finishFejl && <div className="msg error">{finishFejl}</div>}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={finishPauseSubmit} disabled={busy || !finishValid}>
              <CheckCircle2 size={16} /> Gem pause
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "startHelp" ? (
        /* ---------- START HJÆLP PÅ ANDEN OPGAVE ---------- */
        <>
          <div className="ds-title">Hjælp på anden opgave</div>
          {task && (
            <div className="ds-help">
              Din nuværende opgave:{" "}
              <strong>
                {getCategory(task.categoryId)?.name}
                {task.orderNumber ? ` · ${task.orderNumber}` : ""}
              </strong>{" "}
              lukkes nu og kan genoptages bagefter.
            </div>
          )}
          {colleagues.length > 0 && (
            <div className="ds-suggest">
              <div className="ds-suggest-label">Opgaver i gang lige nu</div>
              {colleagues.map((c) => {
                const ref = c.orderNumber?.trim();
                const cat = getCategory(c.categoryId)?.name ?? "—";
                const sub = getSubcategory(c.categoryId, c.subcategoryId)?.name;
                const activity = cat + (sub ? ` · ${sub}` : "");
                return (
                  <button
                    key={c.employeeId}
                    type="button"
                    className="ds-taskcard"
                    onClick={() => prefillFromTask(c)}
                  >
                    <span className="ds-taskcard-ref">{ref || activity}</span>
                    {ref && <span className="ds-taskcard-act">{activity}</span>}
                    <span className="ds-taskcard-emp">
                      <Users size={12} /> {getPersonName(c.employeeId)} arbejder på opgaven
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="ds-suggest-label">Opgave du hjælper på</div>
          <div className="ds-field-hint" style={{ marginBottom: 10 }}>
            Vælg fra listen ovenfor, eller indtast selv arbejdsreferencen (fx SMU-sag,
            ordrenummer, stelnummer eller kunde).
          </div>
          {workFields}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={startHelpSubmit} disabled={busy}>
              <Users size={16} /> Start hjælp
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "startRedo" ? (
        /* ---------- START OMGØRING (A: aktiv opgave · B: selvstændig) ---------- */
        <>
          <div className="ds-title">Start omgøring</div>
          {!redoStandalone && task ? (
            /* Vej A: gælder ALTID den aktive opgave (arves, read-only). Ingen toggle. */
            <>
              <div className="ds-suggest-label">Opgave</div>
              <div className="ds-task" style={{ marginBottom: 8 }}>
                <span className="ds-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
                {getSubcategory(task.categoryId, task.subcategoryId) && (
                  <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
                )}
                {task.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
                {task.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
              </div>
              <div className="ds-help">
                Den aktive opgave lukkes og genoptages automatisk efter omgøringen.
              </div>
            </>
          ) : (
            /* Vej B: selvstændig omgøring — vælg selv opgave/kategori/underpunkt. */
            <>
              <div className="ds-suggest-label">Opgave du laver om</div>
              <div className="field" style={{ marginBottom: 12 }}>
                <CategoryPicker
                  categoryId={draft.categoryId}
                  subcategoryId={draft.subcategoryId}
                  onChange={(cat, sub) => setDraft((d) => ({ ...d, categoryId: cat, subcategoryId: sub }))}
                />
              </div>
              <SagPicker
                customer={draft.orderNumber}
                sagId={draft.sagId}
                sagSmuNummer={draft.sagSmuNummer}
                onChange={(n) =>
                  setDraft((d) => ({
                    ...d,
                    orderNumber: n.customer,
                    sagId: n.sagId,
                    sagSmuNummer: n.sagSmuNummer,
                    enhedId: null, // ny/ryddet sag → nulstil enhed
                    enhedVisning: null,
                  }))
                }
              />
              <EnhedPicker
                sagId={draft.sagId}
                categoryId={draft.categoryId}
                enhedId={draft.enhedId}
                enhedVisning={draft.enhedVisning}
                onChange={(n) => setDraft((d) => ({ ...d, enhedId: n.enhedId, enhedVisning: n.enhedVisning }))}
              />
            </>
          )}
          {redoReasonSelect}
          <div className="field">
            <label>Note (valgfri)</label>
            <input
              className="smu-input"
              type="text"
              value={redoNote}
              onChange={(e) => setRedoNote(e.target.value)}
              placeholder="Valgfri"
            />
          </div>
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={startRedoSubmit} disabled={busy}>
              <RotateCcw size={16} /> Start omgøring
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "finishRedo" ? (
        /* ---------- AFSLUT OMGØRING ---------- */
        <>
          <div className="ds-title">Afslut omgøring</div>
          <div className="ds-task" style={{ marginBottom: 12 }}>
            <span className="ds-cat">{getCategory(task?.categoryId ?? "")?.name ?? "—"}</span>
            {task && getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task?.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
            {task?.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
          </div>
          {timePair}
          {redoReasonSelect}
          <div className="field">
            <label>Note</label>
            <input
              className="smu-input"
              type="text"
              value={finish.note}
              onChange={(e) => setFinish((f) => ({ ...f, note: e.target.value }))}
              placeholder="Valgfri"
            />
          </div>
          {finishFejl && <div className="msg error">{finishFejl}</div>}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={finishRedoSubmit} disabled={busy || !finishValid}>
              <CheckCircle2 size={16} /> Gem omgøring
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : formMode === "registerAbsence" ? (
        /* ---------- REGISTRÉR FRAVÆR ---------- */
        <>
          <div className="ds-title">Registrér fravær</div>
          <div className="field">
            <label>Type</label>
            <select className="smu-input" value={absType} onChange={(e) => setAbsType(e.target.value)}>
              {ABSENCE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row-2">
            <div className="field">
              <label>Fra</label>
              <TimeSelect value={absFrom} onChange={setAbsFrom} />
            </div>
            <div className="field">
              <label>Forventet tilbage (valgfri)</label>
              <TimeSelect value={absTo} onChange={setAbsTo} />
              <span className="ds-field-hint">Tom = tilbage senere</span>
            </div>
          </div>
          <div className="field">
            <label>Note</label>
            <input
              className="smu-input"
              type="text"
              value={absNote}
              onChange={(e) => setAbsNote(e.target.value)}
              placeholder="Valgfri"
            />
          </div>
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={registerAbsenceSubmit} disabled={busy}>
              <UserMinus size={16} /> Registrér fravær
            </button>
            <button className="smu-btn-secondary" onClick={() => setFormMode(null)} disabled={busy}>
              Annuller
            </button>
          </div>
        </>
      ) : activeAbs ? (
        /* ---------- FRAVÆR (aktiv) ---------- */
        <>
          <div className="ds-live ds-live-fravaer">
            <UserMinus size={15} /> Fravær
          </div>
          <div className="ds-task">
            <span className="ds-cat">{absenceTypeName(activeAbs.absenceType)}</span>
          </div>
          <div className="ds-timer">
            <Clock size={14} /> Siden {activeAbs.startTime}
            {activeAbs.expectedEnd ? ` · forventet tilbage ${activeAbs.expectedEnd}` : " · tilbage senere"}
          </div>
          {activeAbs.note && <div className="ds-note">{activeAbs.note}</div>}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={returnFromAbsence} disabled={busy}>
              <Play size={16} /> Jeg er tilbage
            </button>
          </div>
        </>
      ) : !task ? (
        /* ---------- HVAD NU? (ingen aktiv handling) ---------- */
        dayEnded ? (
          <>
            <div className="ds-title">Arbejdsdagen er afsluttet</div>
            <div className="ds-help">Du kan starte en ny handling, hvis du er tilbage.</div>
            <div className="ds-actions">
              <button className="smu-btn-secondary ds-primary" onClick={resumeDay} disabled={busy}>
                <Play size={16} /> Ny handling
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ds-title">Hvad nu?</div>
            <div className="ds-hvadnu">
              <button className="smu-btn-primary ds-big" onClick={openStartWork} disabled={busy}>
                <Play size={16} /> Start opgave
              </button>
              <button className="smu-btn-secondary ds-big" onClick={openStartRedoStandalone} disabled={busy}>
                <RotateCcw size={16} /> Start omgøring
              </button>
              <button className="smu-btn-secondary ds-big ds-pause" onClick={() => openStartPause()} disabled={busy}>
                <Coffee size={16} /> Start pause
              </button>
              <button className="smu-btn-secondary ds-big" onClick={openRegisterAbsence} disabled={busy}>
                <UserMinus size={16} /> Registrér fravær
              </button>
              <button className="smu-btn-secondary ds-big" onClick={endDay} disabled={busy}>
                <Square size={15} /> Slut arbejdsdag
              </button>
            </div>
          </>
        )
      ) : isPause ? (
        /* ---------- PÅ PAUSE ---------- */
        <>
          <div className="ds-state">
            <Coffee size={16} /> På pause
          </div>
          <div className="ds-task">
            <span className="ds-cat">{getSubcategory(task.categoryId, task.subcategoryId)?.name ?? "Pause"}</span>
          </div>
          {startHHMM && (
            <div className="ds-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText}` : ""}
            </div>
          )}
          {pauseOwn && (
            <div className="ds-resume-hint">
              <RotateCcw size={13} /> Genoptages efter pausen:{" "}
              <strong>
                {getCategory(pauseOwn.categoryId)?.name}
                {pauseOwn.orderNumber ? ` · ${pauseOwn.orderNumber}` : ""}
              </strong>
            </div>
          )}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={openFinishPause} disabled={busy}>
              {pauseOwn ? (
                <>
                  <RotateCcw size={16} /> Genoptag{" "}
                  {pauseOwn.orderNumber || getCategory(pauseOwn.categoryId)?.name || "opgave"}
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Afslut pause
                </>
              )}
            </button>
          </div>
        </>
      ) : isHelp ? (
        /* ---------- HJÆLP PÅ ANDEN OPGAVE (aktiv) ---------- */
        <>
          <div className="ds-live ds-live-help">
            <Users size={15} /> Hjælp på anden opgave
          </div>
          <div className="ds-task">
            <span className="ds-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
            {task.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
          </div>
          {task.note && <div className="ds-note">{task.note}</div>}
          {startHHMM && (
            <div className="ds-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText} i gang` : ""}
            </div>
          )}
          {helpOwn && (
            <div className="ds-resume-hint">
              <RotateCcw size={13} /> Din egen opgave genoptages bagefter:{" "}
              <strong>
                {getCategory(helpOwn.categoryId)?.name}
                {helpOwn.orderNumber ? ` · ${helpOwn.orderNumber}` : ""}
              </strong>
            </div>
          )}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary ds-big" onClick={stopHelp} disabled={busy}>
              <RotateCcw size={16} /> Stop hjælp og genoptag min opgave
            </button>
          </div>
          <div className="ds-secondary">
            <button className="smu-btn-ghost" onClick={openEditWork} disabled={busy}>
              <Pencil size={14} /> Ret aktiv hjælp
            </button>
          </div>
        </>
      ) : isRedoActive ? (
        /* ---------- OMGØRING I GANG (aktiv) ---------- */
        <>
          <div className="ds-live ds-live-redo">
            <RotateCcw size={15} /> Omgøring i gang
          </div>
          <div className="ds-task">
            <span className="ds-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
            {task.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
          </div>
          {redoCtx && (
            <div className="ds-reason">Årsag: {getRedoReason(redoCtx.reason)?.name ?? redoCtx.reason}</div>
          )}
          {task.note && <div className="ds-note">{task.note}</div>}
          {startHHMM && (
            <div className="ds-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText} i gang` : ""}
            </div>
          )}
          {redoCtx?.ownTask && (
            <div className="ds-resume-hint">
              <RotateCcw size={13} /> Din oprindelige opgave genoptages bagefter:{" "}
              <strong>
                {getCategory(redoCtx.ownTask.categoryId)?.name}
                {redoCtx.ownTask.orderNumber ? ` · ${redoCtx.ownTask.orderNumber}` : ""}
              </strong>
            </div>
          )}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={openFinishRedo} disabled={busy}>
              <CheckCircle2 size={16} /> Afslut omgøring
            </button>
          </div>
          <div className="ds-secondary">
            <button className="smu-btn-ghost" onClick={openEditWork} disabled={busy}>
              <Pencil size={14} /> Ret aktiv omgøring
            </button>
          </div>
        </>
      ) : (
        /* ---------- I GANG NU (aktiv opgave) ---------- */
        <>
          <div className="ds-live">
            <span className="ds-dot" /> I gang nu
          </div>
          <div className="ds-task">
            <span className="ds-cat">{getCategory(task.categoryId)?.name ?? "—"}</span>
            {getSubcategory(task.categoryId, task.subcategoryId) && (
              <span className="ds-sub"> · {getSubcategory(task.categoryId, task.subcategoryId)?.name}</span>
            )}
            {task.orderNumber && <span className="ds-order"> · {task.orderNumber}</span>}
            {task.enhedVisning && <span className="ds-order"> · {task.enhedVisning}</span>}
          </div>
          {task.note && <div className="ds-note">{task.note}</div>}
          {startHHMM && (
            <div className="ds-timer">
              <Clock size={14} /> Startet {startHHMM}
              {elapsedText ? ` · ${elapsedText} i gang` : ""}
            </div>
          )}
          <div className="ds-actions">
            <button className="smu-btn-primary ds-primary" onClick={openFinishWork} disabled={busy}>
              <CheckCircle2 size={16} /> Gå til afslutning
            </button>
            <button className="smu-btn-secondary ds-pause" onClick={() => openStartPause(true)} disabled={busy}>
              <Coffee size={15} /> Pause
            </button>
            <button className="smu-btn-secondary" onClick={openStartHelp} disabled={busy}>
              <Users size={15} /> Hjælp på anden opgave
            </button>
            <button className="smu-btn-secondary" onClick={openStartRedoFromActive} disabled={busy}>
              <RotateCcw size={15} /> Start omgøring
            </button>
          </div>
          <div className="ds-secondary">
            <button className="smu-btn-ghost" onClick={openEditWork} disabled={busy}>
              <Pencil size={14} /> Ret aktiv opgave
            </button>
          </div>
        </>
      )}
    </div>
  );
}
