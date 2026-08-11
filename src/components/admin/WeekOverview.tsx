import { useEffect, useMemo, useState } from "react";
import type { TimeEntry } from "../../types";
import { EMPLOYEES } from "../../data/employees";
import { store } from "../../lib/storage";
import { employeeDaySummary, STATUS_META } from "../../lib/adminSummary";
import {
  addDays,
  formatShortDate,
  isoWeekNumber,
  todayIso,
  workWeek,
  WEEKDAYS_SHORT,
  weekdayIndex,
} from "../../lib/dates";

function deepLink(employeeId: string, isoDate: string): string {
  return `/?medarbejder=${encodeURIComponent(employeeId)}&dato=${isoDate}`;
}

// Timer som decimal med dansk komma: 450 -> "7,5". 480 -> "8".
function hours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return String(h).replace(".", ",");
}

export default function WeekOverview() {
  const [anchor, setAnchor] = useState<string>(todayIso());
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const days = useMemo(() => workWeek(anchor), [anchor]);

  useEffect(() => {
    let alive = true;
    store()
      .getEntriesInRange(days[0], days[4])
      .then((rows) => alive && setEntries(rows));
    return () => {
      alive = false;
    };
  }, [days]);

  return (
    <div>
      <div className="datebar">
        <button className="datebtn" aria-label="Forrige uge" onClick={() => setAnchor(addDays(anchor, -7))}>
          ‹
        </button>
        <div className="date-current">
          <div className="date-text">
            Uge {isoWeekNumber(days[0])} · {formatShortDate(days[0])}–{formatShortDate(days[4])}
          </div>
        </div>
        <button className="datebtn" aria-label="Næste uge" onClick={() => setAnchor(addDays(anchor, 7))}>
          ›
        </button>
        <button className="today-btn" onClick={() => setAnchor(todayIso())}>
          Denne uge
        </button>
      </div>

      <div className="week-grid">
        <div className="week-inner">
          <div className="week-row head">
            <div className="week-cell week-name">Medarbejder</div>
            {days.map((d) => (
              <div key={d} className="week-cell">
                {WEEKDAYS_SHORT[weekdayIndex(d)]}. {formatShortDate(d)}
              </div>
            ))}
          </div>

          {EMPLOYEES.map((emp) => (
            <div key={emp.id} className="week-row">
              <div className="week-cell week-name">{emp.name}</div>
              {days.map((d) => {
                const mine = entries.filter(
                  (e) => e.employeeId === emp.id && e.workDate === d
                );
                const s = employeeDaySummary(emp.id, mine, d);
                const meta = STATUS_META[s.status];
                return (
                  <div
                    key={d}
                    className="week-cell clickable"
                    style={{ background: meta.bg, color: meta.fg }}
                    role="button"
                    tabIndex={0}
                    title={`${emp.name} · ${d} · ${meta.label}`}
                    onClick={() => (window.location.href = deepLink(emp.id, d))}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") window.location.href = deepLink(emp.id, d);
                    }}
                  >
                    <div className="week-hours">
                      {s.hasEntries ? `${hours(s.workedMinutes)} t` : "—"}
                      {s.redoCount > 0 ? " ⚠" : ""}
                    </div>
                    <div className="week-sub">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-legend">
        {(["udfyldt", "delvist", "ikke-startet", "overarbejde", "fri"] as const).map((k) => (
          <span key={k} className="legend-item">
            <span className="legend-swatch" style={{ background: STATUS_META[k].bg }} />
            {STATUS_META[k].label}
          </span>
        ))}
        <span className="legend-item">⚠ = omgøring</span>
      </div>
    </div>
  );
}
