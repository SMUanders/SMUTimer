import { useEffect, useMemo, useState } from "react";
import { LogOut, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeEntry, Absence } from "../types";
import { getPerson, loadPeople } from "../lib/people";
import { initStore, store } from "../lib/storage";
import { summarizeDay, expectedWorkMinutes } from "../lib/summary";
import { todayIso, addDays, formatDanishDate } from "../lib/dates";
import { formatDuration } from "../lib/time";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import EmployeeSelect from "./EmployeeSelect";
import DayScreen from "./DayScreen";
import DayTimeline from "./DayTimeline";
import { buildDayTimeline } from "../lib/dayTimeline";
import UpdateBanner from "./UpdateBanner";
import { appVersionShort } from "../lib/version";

const EMPLOYEE_KEY = "smu-tid.employee";

// SMU Tid vNext — medarbejderskærm. Default-route. Den gamle dagsseddel (App)
// bevares til leder-detalje/korrektion via deep-link ?medarbejder=…
export default function EmployeeApp() {
  const [employeeId, setEmployeeId] = useState<string | null>(
    localStorage.getItem(EMPLOYEE_KEY)
  );
  const [ready, setReady] = useState(false);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");

  const today = todayIso();
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]); // til DayScreen (dublet-tjek)
  const [historyDate, setHistoryDate] = useState<string>(today);
  const [historyEntries, setHistoryEntries] = useState<TimeEntry[]>([]);
  const [historyAbsences, setHistoryAbsences] = useState<Absence[]>([]);

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
      setEmployeeId((cur) => (cur && !getPerson(cur) ? null : cur));
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
            <button className="smu-btn-ghost" onClick={() => setEmployeeId(null)}>
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

      <DayScreen employeeId={employeeId} entries={todayEntries} onChanged={onChanged} />

      {/* Min dag — read-only historik (med dato-navigation) */}
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
          <DayTimeline blocks={timeline} />
        )}
      </div>

      <div className="app-version">SMU Tid · v{appVersionShort()}</div>
      <UpdateBanner />
    </div>
  );
}
