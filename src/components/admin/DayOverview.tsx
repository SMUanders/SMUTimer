import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, UserMinus } from "lucide-react";
import type { TimeEntry, Absence } from "../../types";
import type { Person } from "../../lib/people";
import { store } from "../../lib/storage";
import { employeeDaySummary } from "../../lib/adminSummary";
import { absenceTypeName } from "../../data/absences";
import { formatDuration } from "../../lib/time";
import { addDays, formatDanishDate, todayIso } from "../../lib/dates";
import WorkingNow from "./WorkingNow";

function deepLink(employeeId: string, isoDate: string): string {
  return `/?medarbejder=${encodeURIComponent(employeeId)}&dato=${isoDate}`;
}

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DayOverview({ visiblePeople }: { visiblePeople: Person[] }) {
  const [date, setDate] = useState<string>(todayIso());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);

  useEffect(() => {
    let alive = true;
    store()
      .getEntriesForDateAll(date)
      .then((rows) => alive && setEntries(rows));
    store()
      .getAbsencesForDateAll(date)
      .then((rows) => alive && setAbsences(rows));
    return () => {
      alive = false;
    };
  }, [date]);

  const rows = visiblePeople.map((emp) => {
    const mine = entries.filter((e) => e.employeeId === emp.id);
    const myAbs = absences.filter((a) => a.employeeId === emp.id);
    return { emp, s: employeeDaySummary(emp.id, mine, date, myAbs) };
  });

  return (
    <div>
      {/* ---------- Sektion 1: Arbejder på nu (drift lige nu) ---------- */}
      <WorkingNow people={visiblePeople} />

      {/* ---------- Sektion 2: Dagens registrering (tidsregnskab) ---------- */}
      <section className="ov-section">
        <h2 className="ov-section-title">Dagens registrering</h2>

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

        <div className="ov-table ov-table-2">
          <div className="ov-head">
            <div>Medarbejder</div>
            <div>Arbejde</div>
            <div>Pause</div>
            <div>Mangler</div>
            <div>Overarbejde</div>
            <div>Afvigelser</div>
            <div>Sidst opdateret</div>
          </div>

          {rows.map(({ emp, s }) => {
            const afvig: { key: string; text: string; warn?: boolean; absence?: boolean }[] = [];
            if (s.absenceMinutes > 0)
              afvig.push({
                key: "abs",
                absence: true,
                text: `Fravær ${formatDuration(s.absenceMinutes)}${
                  s.absenceTypes.length === 1 ? ` · ${absenceTypeName(s.absenceTypes[0])}` : ""
                }`,
              });
            if (s.gapsCount > 0) afvig.push({ key: "gap", text: `Hul ${formatDuration(s.gapsMinutes)}` });
            if (s.overlaps > 0) afvig.push({ key: "ovl", text: "Overlap", warn: true });
            if (s.redoCount > 0)
              afvig.push({ key: "redo", text: `${s.redoCount} ${s.redoCount === 1 ? "omgøring" : "omgøringer"}`, warn: true });
            if (!s.hasEntries && s.expectedMinutes > 0) afvig.push({ key: "none", text: "Ikke startet" });

            return (
              <div
                key={emp.id}
                className="ov-row"
                role="button"
                tabIndex={0}
                onClick={() => (window.location.href = deepLink(emp.id, date))}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") window.location.href = deepLink(emp.id, date);
                }}
              >
                <div className="ov-name">{emp.name}</div>
                <div className="ov-num">
                  <span className="ov-label">Arbejde</span>
                  {formatDuration(s.workedMinutes)}
                </div>
                <div className="ov-num">
                  <span className="ov-label">Pause</span>
                  {s.breakMinutes > 0 ? formatDuration(s.breakMinutes) : "—"}
                </div>
                <div className="ov-num">
                  <span className="ov-label">Mangler</span>
                  <span className={s.missingMinutes > 0 ? "ov-muted-num" : ""}>
                    {formatDuration(s.missingMinutes)}
                  </span>
                </div>
                <div className="ov-num">
                  <span className="ov-label">Overarbejde</span>
                  <span className={s.overtimeMinutes > 0 ? "ov-blue" : ""}>
                    {formatDuration(s.overtimeMinutes)}
                  </span>
                </div>
                <div className="ov-afvig">
                  <span className="ov-label">Afvigelser</span>
                  {afvig.length === 0 ? (
                    "—"
                  ) : (
                    <span className="ov-chips">
                      {afvig.map((a) => (
                        <span
                          key={a.key}
                          className={"ov-chip" + (a.warn ? " is-warn" : "") + (a.absence ? " is-fravaer" : "")}
                        >
                          {a.warn && <AlertTriangle size={12} />}
                          {a.absence && <UserMinus size={12} />} {a.text}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="ov-num">
                  <span className="ov-label">Sidst opdateret</span>
                  {formatUpdated(s.lastUpdated)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
