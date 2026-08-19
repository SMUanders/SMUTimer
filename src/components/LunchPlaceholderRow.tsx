import { UtensilsCrossed } from "lucide-react";
import type { LunchWindow } from "../lib/lunch";

interface Props {
  window: LunchWindow;
}

// Rent visuel "forventet frokost"-linje. Er IKKE en registrering: gemmes ikke,
// tæller ikke i nogen sum. Forsvinder når frokosten splittes ud eller man har
// arbejdet henover den.
export default function LunchPlaceholderRow({ window }: Props) {
  return (
    <div className="entry-row is-break is-placeholder">
      <div className="entry-body">
        <div className="entry-line">
          <span className="entry-interval">{window.startTime}–{window.endTime}</span>
        </div>
        <div className="entry-catline">
          <span className="entry-cat">
            <UtensilsCrossed size={13} /> Frokost
          </span>
        </div>
        <div className="entry-note">
          Foreslået frokost — kan ligge anderledes. Håndteres når du taster henover den.
        </div>
      </div>

      <div className="entry-actions">
        <span className="smu-badge smu-badge-grey">Foreslået</span>
      </div>
    </div>
  );
}
