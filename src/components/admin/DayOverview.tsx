import { useEffect, useState } from "react";
import type { TimeEntry } from "../../types";
import { EMPLOYEES } from "../../data/employees";
import { store } from "../../lib/storage";
import { employeeDaySummary, STATUS_META } from "../../lib/adminSummary";
import { formatDuration } from "../../lib/time";
import { addDays, formatDanishDate, todayIso } from "../../lib/dates";

function deepLink(employeeId: string, isoDate: string): string {
  return `/?medarbejder=${encodeURIComponent(employeeId)}&dato=${isoDate}`;
}

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DayOverview() {
  const [date, setDate] = useState<string>(todayIso());
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    let alive = true;
    store()
      .getEntriesForDateAll(date)
      .then((rows) => alive && setEntries(rows));
    return () => {
      alive = false;
    };
  }, [date]);

  const rows = EMPLOYEES.map((emp) => {
    const mine = entries.filter((e) => e.employeeId === emp.id);
    return { emp, s: employeeDaySummary(emp.id, mine, date) };
  });

  return (
    <div>
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

      <div className="ov-table">
        <div className="ov-head">
          <div>Medarbejder</div>
          <div>Arbejdstid</div>
          <div>Forventet</div>
          <div>Mangler</div>
          <div>Overarbejde</div>
          <div>Status</div>
          <div>Huller</div>
          <div>Omgøringer</div>
          <div>Sidst opdateret</div>
        </div>

        {rows.map(({ emp, s }) => {
          const meta = STATUS_META[s.status];
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
                <span className="ov-label">Arbejdstid</span>
                {formatDuration(s.workedMinutes)}
              </div>
              <div className="ov-num">
                <span className="ov-label">Forventet</span>
                {formatDuration(s.expectedMinutes)}
              </div>
              <div className="ov-num">
                <span className="ov-label">Mangler</span>
                <span className={s.missingMinutes > 0 ? "ov-amber" : ""}>
                  {formatDuration(s.missingMinutes)}
                </span>
              </div>
              <div className="ov-num">
                <span className="ov-label">Overarbejde</span>
                <span className={s.overtimeMinutes > 0 ? "ov-blue" : ""}>
                  {formatDuration(s.overtimeMinutes)}
                </span>
              </div>
              <div>
                <span className="ov-label">Status</span>
                <span
                  className="status-pill"
                  style={{ background: meta.bg, color: meta.fg }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="ov-num">
                <span className="ov-label">Huller</span>
                {s.gapsCount > 0 ? `${s.gapsCount} (${formatDuration(s.gapsMinutes)})` : "—"}
              </div>
              <div className="ov-num">
                <span className="ov-label">Omgøringer</span>
                {s.redoCount > 0 ? <span className="warn-dot">⚠ {s.redoCount}</span> : "—"}
              </div>
              <div className="ov-num">
                <span className="ov-label">Sidst opdateret</span>
                {formatUpdated(s.lastUpdated)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-legend">
        {(["udfyldt", "delvist", "ikke-startet", "overarbejde", "fri"] as const).map((k) => (
          <span key={k} className="legend-item">
            <span className="legend-swatch" style={{ background: STATUS_META[k].bg }} />
            {STATUS_META[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
