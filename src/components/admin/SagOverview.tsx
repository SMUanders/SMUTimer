import { useEffect, useState } from "react";
import { Clock, Users, Info } from "lucide-react";
import type { TimeEntry, CurrentTask } from "../../types";
import type { SagRef } from "../../lib/storage/types";
import { store } from "../../lib/storage";
import { summarizeSag } from "../../lib/sagSummary";
import { getPersonName } from "../../lib/people";
import { getCategory, getSubcategory, isBreakCategory } from "../../data/categories";
import { formatDuration } from "../../lib/time";
import { formatShortDate } from "../../lib/dates";
import SagPicker from "../SagPicker";

// Overblik: søg en SMU-sag og se den samlede REGISTREREDE (afsluttede) arbejdstid.
// Datagrundlag = autoritativ sag_id på tid_time_entries (ingen fritekst-/fuzzy-match,
// ingen dobbeltoptælling). Aktivt arbejde (tid_current_tasks) holdes adskilt.

function activityName(categoryId: string, subcategoryId: string | null): string {
  const cat = getCategory(categoryId)?.name ?? "—";
  const sub = getSubcategory(categoryId, subcategoryId)?.name;
  return sub ? `${cat} · ${sub}` : cat;
}

export default function SagOverview() {
  const [picker, setPicker] = useState<{ customer: string; sagId: string | null; sagSmuNummer: string | null }>({
    customer: "",
    sagId: null,
    sagSmuNummer: null,
  });
  const [sag, setSag] = useState<SagRef | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeNow, setActiveNow] = useState<CurrentTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sag) {
      setEntries([]);
      setActiveNow([]);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const [rows, tasks] = await Promise.all([
        store().getEntriesForSag(sag.sagId),
        store().getAllCurrentTasks().catch(() => [] as CurrentTask[]),
      ]);
      if (!alive) return;
      setEntries(rows);
      // Aktivt arbejde på sagen lige nu (status, IKKE afsluttet tid) — holdes adskilt.
      setActiveNow(tasks.filter((t) => t.sagId === sag.sagId && !isBreakCategory(t.categoryId)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sag]);

  const s = summarizeSag(entries);

  return (
    <div>
      <section className="ov-section">
        <h2 className="ov-section-title">Søg på SMU-sag</h2>
        <SagPicker
          label="SMU-nr. / sag"
          customer={picker.customer}
          sagId={picker.sagId}
          sagSmuNummer={picker.sagSmuNummer}
          onChange={(n) => {
            setPicker(n);
            if (!n.sagId) setSag(null); // ryddet eller fri tekst → intet valgt
          }}
          onPick={(picked) => setSag(picked)}
        />
      </section>

      {sag && (
        <>
          <section className="ov-section sag-ov-head">
            <div className="sag-ov-ident">
              <span className="sag-ov-nr">{sag.smuNummer}</span>
              <span className="sag-ov-kunde">{sag.kundeNavn}</span>
            </div>
            {sag.titel && <div className="sag-ov-titel">{sag.titel}</div>}
            <div className="sag-ov-total">
              <span className="sag-ov-total-k">Registreret tid i alt</span>
              <span className="sag-ov-total-v">{formatDuration(s.totalMinutes)}</span>
            </div>
            {activeNow.length > 0 && (
              <div className="sag-ov-active">
                <Clock size={13} /> Arbejdes på nu af {activeNow.map((t) => getPersonName(t.employeeId)).join(", ")}
                <span className="sag-ov-active-note"> (tælles ikke med — ikke afsluttet)</span>
              </div>
            )}
            <div className="sag-ov-disclaimer">
              <Info size={13} /> Kun registreringer knyttet til sagen (sag-reference) indgår. Ældre
              fri-tekst-registreringer uden sag-reference er ikke med i totalen.
            </div>
          </section>

          {loading ? (
            <div className="empty">Indlæser…</div>
          ) : s.entryCount === 0 ? (
            <div className="empty">Ingen afsluttede registreringer på denne sag endnu.</div>
          ) : (
            <>
              <section className="ov-section">
                <h2 className="ov-section-title">
                  <Users size={15} /> Pr. medarbejder
                </h2>
                <div className="sag-rows">
                  {s.byEmployee.map((g) => (
                    <div key={g.employeeId} className="sag-row">
                      <span className="sag-row-name">{getPersonName(g.employeeId)}</span>
                      <span className="sag-row-dur">{formatDuration(g.minutes)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ov-section">
                <h2 className="ov-section-title">Pr. aktivitet</h2>
                <div className="sag-rows">
                  {s.byCategory.map((g) => (
                    <div key={`${g.categoryId}|${g.subcategoryId ?? ""}`} className="sag-row">
                      <span className="sag-row-name">{activityName(g.categoryId, g.subcategoryId)}</span>
                      <span className="sag-row-dur">{formatDuration(g.minutes)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ov-section">
                <h2 className="ov-section-title">Registreringer ({s.entryCount})</h2>
                <div className="sag-entries">
                  {entries.map((e) => (
                    <div key={e.id} className="sag-entry">
                      <div className="sag-entry-top">
                        <span className="sag-entry-date">{formatShortDate(e.workDate)}</span>
                        <span className="sag-entry-name">{getPersonName(e.employeeId)}</span>
                        <span className="sag-entry-dur">{formatDuration(e.durationMinutes)}</span>
                      </div>
                      <div className="sag-entry-act">
                        {e.startTime}–{e.endTime} · {activityName(e.categoryId, e.subcategoryId)}
                      </div>
                      {e.note?.trim() && <div className="sag-entry-note">{e.note.trim()}</div>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
