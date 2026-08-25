import { useEffect, useState } from "react";
import type { CurrentTask, TimeEntry, Absence } from "../../types";
import type { Person } from "../../lib/people";
import { store } from "../../lib/storage";
import { getCategory, getSubcategory, isBreakCategory } from "../../data/categories";
import { absenceTypeName } from "../../data/absences";
import { activeAbsence } from "../../lib/absence";
import { isoToHHMM } from "../../lib/currentTaskStart";
import { formatDuration } from "../../lib/time";
import { todayIso } from "../../lib/dates";

interface Props {
  people: Person[];
}

type NowStatus =
  | "fravaer"
  | "i-gang"
  | "paa-pause"
  | "ingen-aktiv"
  | "ikke-startet"
  | "ikke-opdateret";

const STATUS_LABEL: Record<NowStatus, { label: string; badge: string }> = {
  fravaer: { label: "Fravær", badge: "smu-badge-grey" },
  "i-gang": { label: "I gang", badge: "smu-badge-green" },
  "paa-pause": { label: "På pause", badge: "smu-badge-orange" },
  "ingen-aktiv": { label: "Ingen aktiv opgave", badge: "smu-badge-grey" },
  "ikke-startet": { label: "Ikke startet", badge: "smu-badge-grey" },
  "ikke-opdateret": { label: "Ikke opdateret i dag", badge: "smu-badge-orange" },
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function deepLink(employeeId: string, isoDate: string): string {
  return `/?medarbejder=${encodeURIComponent(employeeId)}&dato=${isoDate}`;
}

// "Arbejder på nu" — kompakt drifts-tabel. Hvem arbejder på hvad lige nu, siden
// hvornår, og hvor længe. Læser aktuel opgave (tid_current_tasks); starttid =
// opgavens updatedAt (bedste tilgængelige uden DB-ændring). Ikke tidsregnskab.
export default function WorkingNow({ people }: Props) {
  const [tasks, setTasks] = useState<CurrentTask[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [, setTick] = useState(0);
  const today = todayIso();

  useEffect(() => {
    let alive = true;
    store()
      .getAllCurrentTasks()
      .then((t) => alive && setTasks(t));
    store()
      .getEntriesForDateAll(today)
      .then((rows) => alive && setTodayEntries(rows));
    store()
      .getAbsencesForDateAll(today)
      .then((rows) => alive && setAbsences(rows));
    return () => {
      alive = false;
    };
  }, [today]);

  // Live "I gang"-optælling.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const byEmp = new Map(tasks.map((t) => [t.employeeId, t]));

  function rowFor(p: Person) {
    const t = byEmp.get(p.id);
    const hasEntriesToday = todayEntries.some((e) => e.employeeId === p.id && !e.slettet);

    // Aktivt fravær vinder over alt andet (medarbejderen er ude nu).
    const abs = activeAbsence(absences.filter((a) => a.employeeId === p.id));
    if (abs) {
      return {
        p,
        status: "fravaer" as NowStatus,
        active: true,
        started: abs.startTime,
        elapsed: abs.expectedEnd ? `tilbage ca. ${abs.expectedEnd}` : "tilbage ukendt",
        orderKunde: absenceTypeName(abs.absenceType),
        type: abs.note || "Fravær",
      };
    }

    let status: NowStatus;
    if (!t) status = hasEntriesToday ? "ingen-aktiv" : "ikke-startet";
    else if (isBreakCategory(t.categoryId)) status = "paa-pause";
    else if (!isToday(t.updatedAt)) status = "ikke-opdateret";
    else status = "i-gang";

    const active = status === "i-gang" || status === "paa-pause";
    const cat = t ? getCategory(t.categoryId) : undefined;
    const sub = t ? getSubcategory(t.categoryId, t.subcategoryId) : undefined;
    const elapsed = active
      ? formatDuration(Math.max(0, Math.floor((Date.now() - Date.parse(t!.updatedAt)) / 60000)))
      : "—";

    return {
      p,
      status,
      active,
      started: active ? isoToHHMM(t!.updatedAt) : "—",
      elapsed,
      orderKunde: t?.orderNumber?.trim() || "—",
      type: t ? `${cat?.name ?? "—"}${sub ? ` · ${sub.name}` : ""}` : "—",
    };
  }

  return (
    <section className="ov-section">
      <h2 className="ov-section-title">Arbejder på nu</h2>
      <div className="wn-table">
        <div className="wn-head">
          <div>Medarbejder</div>
          <div>Status</div>
          <div>Opgave / kunde</div>
          <div>Startet</div>
          <div>I gang</div>
          <div>Type</div>
        </div>
        {people.map((p) => {
          const r = rowFor(p);
          const meta = STATUS_LABEL[r.status];
          return (
            <div
              key={p.id}
              className={"wn-row" + (r.active ? "" : " is-idle")}
              role="button"
              tabIndex={0}
              onClick={() => (window.location.href = deepLink(p.id, today))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") window.location.href = deepLink(p.id, today);
              }}
            >
              <div className="wn-name">{r.p.name}</div>
              <div>
                <span className="wn-label">Status</span>
                <span className={`smu-badge ${meta.badge}`}>{meta.label}</span>
              </div>
              <div className="wn-order">
                <span className="wn-label">Opgave / kunde</span>
                {r.orderKunde}
              </div>
              <div className="wn-num">
                <span className="wn-label">Startet</span>
                {r.started}
              </div>
              <div className="wn-num">
                <span className="wn-label">I gang</span>
                {r.elapsed}
              </div>
              <div className="wn-type">
                <span className="wn-label">Type</span>
                {r.type}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
