import { useEffect, useMemo, useState } from "react";
import { LogOut, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeEntry } from "../types";
import { getPerson, loadPeople } from "../lib/people";
import { initStore, store } from "../lib/storage";
import { summarizeDay, expectedWorkMinutes } from "../lib/summary";
import { todayIso, addDays, formatDanishDate } from "../lib/dates";
import { toMinutes, formatDuration } from "../lib/time";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import EmployeeSelect from "./EmployeeSelect";
import WorkNow from "./WorkNow";
import EntryRow from "./EntryRow";
import UpdateBanner from "./UpdateBanner";
import { appVersionShort } from "../lib/version";

const EMPLOYEE_KEY = "smu-tid.employee";

// Medarbejderflow v2 — primærskærm. Default-route (den gamle dagsseddel (App)
// bevares til leder-detalje/korrektion via deep-link ?medarbejder=…).
export default function WorkApp() {
  const [employeeId, setEmployeeId] = useState<string | null>(
    localStorage.getItem(EMPLOYEE_KEY)
  );
  const [ready, setReady] = useState(false);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");

  const today = todayIso();
  // WorkNow (primærskærm) arbejder altid på i dag.
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  // Historik = read-only, med dato-navigation (må gerne se tidligere dage).
  const [historyDate, setHistoryDate] = useState<string>(today);
  const [historyEntries, setHistoryEntries] = useState<TimeEntry[]>([]);

  async function loadToday(emp = employeeId) {
    setTodayEntries(emp ? await store().getEntriesForDate(emp, today) : []);
  }
  async function loadHistory(emp = employeeId, d = historyDate) {
    setHistoryEntries(emp ? await store().getEntriesForDate(emp, d) : []);
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

  // Efter en handling i WorkNow: genindlæs i dag (+ historik hvis den viser i dag).
  async function onChanged() {
    await loadToday(employeeId);
    if (historyDate === today) await loadHistory(employeeId, today);
  }

  const summary = useMemo(
    () => summarizeDay(historyEntries, expectedWorkMinutes(historyDate)),
    [historyEntries, historyDate]
  );

  // Kompakt medarbejder-summary: kun arbejde altid; pause/mangler/hul kun når > 0.
  // Overlap er et leder-/korrektionssignal og vises ikke her (se /oversigt).
  const summaryParts = useMemo(() => {
    const gapMin = summary.gaps.reduce((s, g) => s + g.minutes, 0);
    const parts = [`${formatDuration(summary.workedMinutes)} arbejde`];
    if (summary.breakMinutes > 0) parts.push(`${formatDuration(summary.breakMinutes)} pause`);
    if (summary.missingMinutes > 0) parts.push(`${formatDuration(summary.missingMinutes)} mangler`);
    if (gapMin > 0) parts.push(`${formatDuration(gapMin)} hul`);
    return parts;
  }, [summary]);

  const historyRows = useMemo(
    () => [...historyEntries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [historyEntries]
  );

  function selectEmployee(id: string) {
    localStorage.setItem(EMPLOYEE_KEY, id);
    setEmployeeId(id);
  }
  function switchEmployee() {
    setEmployeeId(null);
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

      <WorkNow employeeId={employeeId} entries={todayEntries} onChanged={onChanged} />

      {/* Historik = read-only tidslinje. Medarbejderen må vælge tidligere datoer. */}
      <div className="history">
        <div className="history-head">
          <span className="history-title">Historik</span>
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
        <div className="entry-list">
          {historyRows.length === 0 ? (
            <div className="empty">
              {viewingToday
                ? "Ingen registreringer endnu — start en opgave ovenfor."
                : "Ingen registreringer denne dag."}
            </div>
          ) : (
            historyRows.map((e) => <EntryRow key={e.id} entry={e} />)
          )}
        </div>
      </div>

      <div className="app-version">SMU Tid · v{appVersionShort()}</div>
      <UpdateBanner />
    </div>
  );
}
