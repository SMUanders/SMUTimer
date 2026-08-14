import { useState } from "react";
import type { EntryDraft } from "../types";
import type { LunchWindow } from "../lib/lunch";
import { splitAroundLunch } from "../lib/lunch";
import { toMinutes } from "../lib/time";
import { getCategory, getSubcategory } from "../data/categories";
import TimeSelect from "./TimeSelect";

interface Props {
  draft: EntryDraft;
  /** Den FORESLÅEDE frokost (kan flyttes af brugeren). */
  lunch: LunchWindow;
  /** null = ingen frokost i tidsrummet; ellers = split omkring dette vindue. */
  onResolve: (lunch: LunchWindow | null) => void;
  onCancel: () => void;
}

// Frokosten er kun et FORSLAG. Brugeren kan splitte ved forslaget, flytte
// frokosten (fx 10:30–11:00) eller sige at der ikke var frokost i tidsrummet.
export default function LunchSplitDialog({ draft, lunch, onResolve, onCancel }: Props) {
  const [moving, setMoving] = useState(false);
  const [from, setFrom] = useState(lunch.startTime);
  const [to, setTo] = useState(lunch.endTime);

  const catName = getCategory(draft.categoryId)?.name ?? "";
  const subName = getSubcategory(draft.categoryId, draft.subcategoryId)?.name ?? "";

  const eStart = toMinutes(draft.startTime);
  const eEnd = toMinutes(draft.endTime);
  const mFrom = toMinutes(from);
  const mTo = toMinutes(to);

  let movedError: string | null = null;
  if (moving) {
    if (mTo <= mFrom) movedError = "“Frokost til” skal være efter “Frokost fra”.";
    else if (mFrom < eStart || mTo > eEnd)
      movedError = "Frokosten skal ligge inden for registreringens tidsrum.";
  }
  const movedValid = moving && !movedError;

  const activeLunch: LunchWindow = movedValid ? { startTime: from, endTime: to } : lunch;
  const parts = splitAroundLunch(draft.startTime, draft.endTime, activeLunch);

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-body">
          <h3>Foreslået frokost</h3>
          <p>
            Tidsrummet rammer den foreslåede frokost ({lunch.startTime}–{lunch.endTime}).
            Frokosten er kun et forslag — split ved forslaget, flyt frokosten, eller
            vælg at der ikke var frokost i dette tidsrum.
          </p>

          {moving && (
            <div className="row-2" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Frokost fra</label>
                <TimeSelect value={from} onChange={setFrom} />
              </div>
              <div className="field">
                <label>Frokost til</label>
                <TimeSelect value={to} onChange={setTo} />
              </div>
            </div>
          )}
          {movedError && <div className="msg error">{movedError}</div>}

          <div className="split-preview">
            {parts.map((p, i) => (
              <div key={i} className={"line" + (p.isBreak ? " brk" : "")}>
                <span>
                  {p.startTime}–{p.endTime}
                </span>
                <span>
                  {p.isBreak
                    ? "Pause / Frokost"
                    : `${catName}${subName ? " / " + subName : ""}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          {moving ? (
            <button
              className="smu-btn-primary"
              onClick={() => onResolve({ startTime: from, endTime: to })}
              disabled={!movedValid}
            >
              Split ved flyttet frokost
            </button>
          ) : (
            <button className="smu-btn-primary" onClick={() => onResolve(lunch)}>
              Split ved foreslået frokost
            </button>
          )}
          <button className="smu-btn-secondary" onClick={() => setMoving((m) => !m)}>
            {moving ? "Fortryd flyt" : "Flyt frokost"}
          </button>
          <button className="smu-btn-ghost" onClick={() => onResolve(null)}>
            Ingen frokost i dette tidsrum
          </button>
        </div>
      </div>
    </div>
  );
}
