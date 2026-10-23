import { useState } from "react";
import type { Absence, TimeEntry } from "../types";
import { ABSENCE_TYPES, absenceTypeName } from "../data/absences";
import { absenceError, type AbsenceDraft } from "../lib/absence";
import TimeSelect from "./TimeSelect";

// Ret, slet eller afslut et fravær — eller registrér et nyt på den viste dag. Bruges af både
// medarbejderen (eget fravær i "Min dag") og lederen (på medarbejderens vegne). Eksisterende
// fraværsmodel og -typer genbruges; tom "Tilbage" betyder, at medarbejderen stadig er væk.

interface Props {
  mode: "new" | "edit";
  initial: AbsenceDraft;
  /** Dagens arbejdsregistreringer og øvrige fravær (det redigerede er ekskluderet) — til overlap-tjek. */
  entries: TimeEntry[];
  andreFravaer: Absence[];
  /** "Nu" som HH:MM, når dagen er i dag (til "Tilbage nu"); ellers null. */
  nuHHMM: string | null;
  error?: string | null;
  onSave: (draft: AbsenceDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function AbsenceEditor({ mode, initial, entries, andreFravaer, nuHHMM, error, onSave, onDelete, onClose }: Props) {
  const [d, setD] = useState<AbsenceDraft>(initial);
  const fejl = absenceError(d, entries, andreFravaer);
  const set = <K extends keyof AbsenceDraft>(k: K, v: AbsenceDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const kendtType = ABSENCE_TYPES.some((t) => t.id === d.absenceType);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-header">{mode === "new" ? "Registrér fravær" : "Ret fravær"}</div>
        <div className="sheet-body">
          {error && <div className="msg error">{error}</div>}
          {fejl && <div className="msg error">{fejl}</div>}
          <div className="field">
            <label>Type</label>
            <select className="smu-input" value={d.absenceType} onChange={(e) => set("absenceType", e.target.value)}>
              {!kendtType && <option value={d.absenceType}>{absenceTypeName(d.absenceType)}</option>}
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
              <TimeSelect value={d.startTime} onChange={(v) => set("startTime", v)} />
            </div>
            <div className="field">
              <label>Forventet tilbage</label>
              <TimeSelect value={d.expectedEnd} onChange={(v) => set("expectedEnd", v)} />
            </div>
          </div>
          <div className="field">
            <label>Tilbage (tom = stadig væk)</label>
            <div className="row-2" style={{ alignItems: "center" }}>
              <TimeSelect value={d.ended} onChange={(v) => set("ended", v)} />
              {d.ended === "" && nuHHMM && (
                <button className="smu-btn-secondary" type="button" onClick={() => set("ended", nuHHMM)}>
                  Tilbage nu ({nuHHMM})
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Note</label>
            <textarea className="smu-input" placeholder="Valgfri" value={d.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>
        <div className="sheet-footer">
          {mode === "edit" && onDelete && (
            <button className="smu-btn-ghost sheet-delete" onClick={onDelete} style={{ flex: "0 0 auto" }}>
              Slet
            </button>
          )}
          <button className="smu-btn-secondary" onClick={onClose} style={{ flex: "0 0 auto" }}>
            Annuller
          </button>
          <button className="smu-btn-primary" onClick={() => onSave(d)} disabled={!!fejl}>
            Gem
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fravær → redigeringsudkast (tomme felter for manglende tider). */
export function absenceDraftFrom(a: Absence): AbsenceDraft {
  return { absenceType: a.absenceType, startTime: a.startTime, expectedEnd: a.expectedEnd ?? "", ended: a.ended ?? "", note: a.note ?? "" };
}
