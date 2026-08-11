import type { EntryDraft } from "../types";
import type { LunchWindow } from "../lib/lunch";
import { splitAroundLunch } from "../lib/lunch";
import { getCategory, getSubcategory } from "../data/categories";

interface Props {
  draft: EntryDraft;
  lunch: LunchWindow;
  /** true = split omkring frokost, false = arbejdede gennem frokost. */
  onResolve: (split: boolean) => void;
  onCancel: () => void;
}

// Bekræftelse ved overlap med frokost. Standardvalg = split (ja).
export default function LunchSplitDialog({ draft, lunch, onResolve, onCancel }: Props) {
  const parts = splitAroundLunch(draft.startTime, draft.endTime, lunch);
  const catName = getCategory(draft.categoryId)?.name ?? "";
  const subName = getSubcategory(draft.categoryId, draft.subcategoryId)?.name ?? "";

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-body">
          <h3>Overlapper frokost</h3>
          <p>
            Tidsrummet overlapper frokost. Skal vi splitte registreringen omkring
            frokost?
          </p>
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
          <button className="btn-primary" onClick={() => onResolve(true)}>
            Ja, split omkring frokost
          </button>
          <button className="btn-ghost" onClick={() => onResolve(false)}>
            Arbejdede gennem frokost / split ikke
          </button>
        </div>
      </div>
    </div>
  );
}
