import { useEffect, useMemo, useState } from "react";
import { LogOut, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeEntry, Absence, EntryDraft } from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";
import { AppSwitcher } from "../platform-nav/AppSwitcher";
import { getPerson, loadPeople } from "../lib/people";
import { resolveEmployeeIdentity } from "../lib/identity";
import { initStore, store, newId, nowIso } from "../lib/storage";
import { summarizeDay, expectedWorkMinutes } from "../lib/summary";
import { todayIso, addDays, formatDanishDate, datoFraSoegning } from "../lib/dates";
import { formatDuration } from "../lib/time";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import EmployeeSelect from "./EmployeeSelect";
import DayScreen from "./DayScreen";
import DayTimeline from "./DayTimeline";
import EntryEditor from "./EntryEditor";
import AbsenceEditor, { absenceDraftFrom } from "./AbsenceEditor";
import type { AbsenceDraft } from "../lib/absence";
import { HELP_NOTE, helpNote, isHelpNote } from "../lib/helpContext";
import { isoToHHMM } from "../lib/currentTaskStart";
import { buildDayTimeline } from "../lib/dayTimeline";
import { UpdateBanner } from "../platform-update/UpdateBanner";
import { appBuildIdShort } from "../platform-update/buildId";
import { appProductVersion } from "../lib/version";

const EMPLOYEE_KEY = "smu-tid.employee";

// SMU Tid vNext — medarbejderskærm. Default-route. Den gamle dagsseddel (App)
// bevares til leder-detalje/korrektion via deep-link ?medarbejder=…
export default function EmployeeApp() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  // I produktion bindes medarbejderen til den AUTENTIFICEREDE bruger (auth.uid =
  // profiler.id). Så kan man kun registrere på sig selv (håndhæves også af RLS).
  // Kun i lokal dev (ingen Supabase) bruges medarbejder-vælgeren som fallback.
  const [authBound, setAuthBound] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");

  const today = todayIso();
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]); // til DayScreen (dublet-tjek)
  // Valgt dato i Min dag bevares i adressen (?dato=), så genindlæsning viser samme dag.
  const [historyDate, setHistoryDate] = useState<string>(() => datoFraSoegning(window.location.search) ?? today);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (historyDate === today) p.delete("dato");
      else p.set("dato", historyDate);
      const q = p.toString();
      const ny = `${window.location.pathname}${q ? `?${q}` : ""}`;
      if (ny !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, "", ny);
      }
    } catch {
      /* adressen er en bekvemmelighed — visningen virker uden */
    }
  }, [historyDate, today]);
  const [historyEntries, setHistoryEntries] = useState<TimeEntry[]>([]);
  const [historyAbsences, setHistoryAbsences] = useState<Absence[]>([]);
  // Rettelser i "Min dag": medarbejderen retter/sletter selv egne registreringer og eget fravær.
  const [retter, setRetter] = useState<TimeEntry | null>(null);
  const [fravaer, setFravaer] = useState<{ absence: Absence | null } | null>(null);
  const [gemFejl, setGemFejl] = useState<string | null>(null);
  // Fortæller DayScreen, at dagens data er ændret her (fx fravær), så den genindlæser.
  const [dagVersion, setDagVersion] = useState(0);

  async function loadToday(emp = employeeId) {
    setTodayEntries(emp ? await store().getEntriesForDate(emp, today) : []);
  }
  async function loadHistory(emp = employeeId, d = historyDate) {
    setHistoryEntries(emp ? await store().getEntriesForDate(emp, d) : []);
    setHistoryAbsences(emp ? await store().getAbsencesForDate(emp, d) : []);
  }

  useEffect(() => {
    (async () => {
      const name = await initStore();
      setStorageName(name);
      await loadPeople();
      const client = getSupabaseClient();
      const authUserId =
        isSupabaseConfigured && client ? (await client.auth.getUser()).data.user?.id ?? null : null;
      const legacyStored = localStorage.getItem(EMPLOYEE_KEY);
      const id = resolveEmployeeIdentity({
        supabaseConfigured: isSupabaseConfigured && !!client,
        authUserId,
        legacyStored,
      });
      // Produktion: ryd legacy-værdi så gamle browserværdier aldrig kan skrive som en anden.
      if (id.clearLegacy) localStorage.removeItem(EMPLOYEE_KEY);
      // I dev: kun behold gemt id hvis det peger på en kendt person.
      const resolved =
        id.pickerAllowed && id.employeeId && !getPerson(id.employeeId) ? null : id.employeeId;
      setEmployeeId(resolved);
      setAuthBound(!id.pickerAllowed);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) {
      loadToday(employeeId);
      loadHistory(employeeId, historyDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, ready]);

  useEffect(() => {
    if (ready) loadHistory(employeeId, historyDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDate]);

  async function onChanged() {
    await loadToday(employeeId);
    if (historyDate === today) await loadHistory(employeeId, today);
  }

  // ---- Medarbejderen retter selv (egne registreringer og eget fravær, alle datoer) ----
  // Registreringer går gennem databasefunktioner med ejer-, overlap- og samtidighedskontrol
  // og historik (tid_ret_egen_registrering / tid_slet_egen_registrering). Fravær går via
  // eksisterende owner-scope og afvises, hvis det er ændret i mellemtiden.
  const fejltekst = (e: unknown) =>
    e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Kunne ikke gemme. Prøv igen.";

  async function efterRettelse() {
    setRetter(null);
    setFravaer(null);
    setGemFejl(null);
    await loadHistory(employeeId, historyDate);
    await loadToday(employeeId);
    setDagVersion((v) => v + 1);
  }

  function aabnRegistrering(e: TimeEntry) {
    setGemFejl(null);
    setRetter(e);
  }
  async function gemRegistrering(d: EntryDraft) {
    if (!retter) return;
    try {
      await store().updateOwnEntry(retter, {
        startTime: d.startTime,
        endTime: d.endTime,
        categoryId: d.categoryId,
        subcategoryId: d.subcategoryId,
        // Hjælp-linjer beholder deres mærke foran medarbejderens egen note.
        note: isHelpNote(retter.note) ? helpNote(d.note) : d.note.trim(),
      });
      await efterRettelse();
    } catch (e) {
      setGemFejl(fejltekst(e));
    }
  }
  async function sletRegistrering() {
    if (!retter || !window.confirm("Slet denne registrering?")) return;
    try {
      await store().deleteOwnEntry(retter);
      await efterRettelse();
    } catch (e) {
      setGemFejl(fejltekst(e));
    }
  }

  async function gemFravaer(d: AbsenceDraft) {
    if (!employeeId || !fravaer) return;
    try {
      if (fravaer.absence) {
        await store().updateAbsence(fravaer.absence, {
          absenceType: d.absenceType,
          startTime: d.startTime,
          expectedEnd: d.expectedEnd || null,
          ended: d.ended || null,
          note: d.note.trim(),
        });
      } else {
        await store().addAbsence({
          id: newId(),
          employeeId,
          workDate: historyDate,
          startTime: d.startTime,
          expectedEnd: d.expectedEnd || null,
          ended: d.ended || null,
          absenceType: d.absenceType,
          note: d.note.trim(),
          slettet: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
      await efterRettelse();
    } catch (e) {
      setGemFejl(fejltekst(e));
    }
  }
  async function sletFravaer() {
    if (!fravaer?.absence || !window.confirm("Slet dette fravær?")) return;
    try {
      await store().deleteAbsence(fravaer.absence);
      await efterRettelse();
    } catch (e) {
      setGemFejl(fejltekst(e));
    }
  }

  const summary = useMemo(
    () => summarizeDay(historyEntries, expectedWorkMinutes(historyDate), historyAbsences),
    [historyEntries, historyAbsences, historyDate]
  );
  const summaryParts = useMemo(() => {
    const parts = [`${formatDuration(summary.workedMinutes)} arbejde`];
    if (summary.breakMinutes > 0) parts.push(`${formatDuration(summary.breakMinutes)} pause`);
    if (summary.absenceMinutes > 0) parts.push(`${formatDuration(summary.absenceMinutes)} fravær`);
    if (summary.missingMinutes > 0) parts.push(`${formatDuration(summary.missingMinutes)} mangler`);
    return parts;
  }, [summary]);

  const timeline = useMemo(
    () => buildDayTimeline(historyEntries, historyAbsences),
    [historyEntries, historyAbsences]
  );

  function selectEmployee(id: string) {
    localStorage.setItem(EMPLOYEE_KEY, id);
    setEmployeeId(id);
  }

  if (!ready) {
    return (
      <div className="picker">
        <p className="picker-sub">Indlæser…</p>
      </div>
    );
  }
  if (!employeeId) {
    // Produktion: aldrig medarbejder-vælger — man er bundet til sin egen bruger.
    if (authBound) {
      return (
        <div className="picker">
          <p className="picker-sub">
            Kunne ikke bestemme din bruger. Genindlæs siden, eller log ind igen via SMU Hub.
          </p>
        </div>
      );
    }
    // Kun lokal dev.
    return <EmployeeSelect onSelect={selectEmployee} />;
  }

  const employee = getPerson(employeeId);
  const viewingToday = historyDate === today;

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
            {/* "Skift" giver kun mening i lokal dev (vælger-fallback). I production er
                identiteten bundet til den autentificerede bruger — ingen skift. */}
            {!authBound && (
              <button className="smu-btn-ghost" onClick={() => setEmployeeId(null)}>
                Skift
              </button>
            )}
          </div>
        </div>
        <div className="header-actions">
          {/* Diskret skift til Hub og brugerens oevrige SMU-apps */}
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

      <DayScreen employeeId={employeeId} entries={todayEntries} onChanged={onChanged} opdateret={dagVersion} />

      {/* Min dag — tryk på en registrering eller et fravær for at rette eller slette det */}
      <div className="history">
        <div className="history-head">
          <span className="history-title">Min dag</span>
          <div className="history-datebar">
            <button
              className="icon-btn sm"
              aria-label="Forrige dag"
              onClick={() => setHistoryDate(addDays(historyDate, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              aria-label="Vælg dato"
              value={historyDate}
              onChange={(e) => e.target.value && setHistoryDate(e.target.value)}
            />
            <button
              className="icon-btn sm"
              aria-label="Næste dag"
              onClick={() => setHistoryDate(addDays(historyDate, 1))}
            >
              <ChevronRight size={16} />
            </button>
            {!viewingToday && (
              <button className="smu-btn-ghost" onClick={() => setHistoryDate(today)}>
                I dag
              </button>
            )}
          </div>
        </div>
        <div className="history-date-full">{formatDanishDate(historyDate)}</div>
        <div className="history-summary">{summaryParts.join(" · ")}</div>
        {timeline.length === 0 ? (
          <div className="empty">
            {viewingToday
              ? "Ingen registreringer endnu — start en opgave ovenfor."
              : "Ingen registreringer denne dag."}
          </div>
        ) : (
          <DayTimeline
            blocks={timeline}
            onEditEntry={aabnRegistrering}
            onEditAbsence={(a) => {
              setGemFejl(null);
              setFravaer({ absence: a });
            }}
          />
        )}
        <div className="add-bar">
          <button
            className="smu-btn-secondary"
            onClick={() => {
              setGemFejl(null);
              setFravaer({ absence: null });
            }}
          >
            Registrér fravær denne dag
          </button>
        </div>
      </div>

      {retter && (
        <EntryEditor
          mode="edit"
          medarbejder
          workDate={retter.workDate}
          initial={{
            startTime: retter.startTime,
            endTime: retter.endTime,
            categoryId: retter.categoryId,
            subcategoryId: retter.subcategoryId,
            customer: retter.customer,
            sagId: retter.sagId,
            sagSmuNummer: retter.sagSmuNummer,
            enhedId: retter.enhedId,
            enhedVisning: retter.enhedVisning,
            // Hjælp-mærket vises ikke i feltet; det bevares automatisk ved gem.
            note: isHelpNote(retter.note) ? retter.note.slice(HELP_NOTE.length).replace(/^ — /, "") : retter.note,
            isRedo: retter.isRedo,
            redoReason: retter.redoReason,
            redoNote: retter.redoNote,
          }}
          error={gemFejl}
          existing={historyEntries.filter((e) => e.id !== retter.id)}
          allowSetAsCurrent={false}
          onDelete={sletRegistrering}
          onSave={(d) => gemRegistrering(d)}
          onClose={() => setRetter(null)}
        />
      )}

      {fravaer && (
        <AbsenceEditor
          mode={fravaer.absence ? "edit" : "new"}
          initial={
            fravaer.absence
              ? absenceDraftFrom(fravaer.absence)
              : { absenceType: "syg", startTime: viewingToday ? isoToHHMM(nowIso()) : "07:00", expectedEnd: "", ended: "", note: "" }
          }
          entries={historyEntries}
          andreFravaer={historyAbsences.filter((a) => a.id !== fravaer.absence?.id)}
          nuHHMM={viewingToday ? isoToHHMM(nowIso()) : null}
          error={gemFejl}
          onSave={gemFravaer}
          onDelete={fravaer.absence ? sletFravaer : undefined}
          onClose={() => setFravaer(null)}
        />
      )}

      <div className="app-version" title={`Build ${appBuildIdShort()}`}>
        SMU Tid {appProductVersion()}
      </div>
      <UpdateBanner />
    </div>
  );
}
