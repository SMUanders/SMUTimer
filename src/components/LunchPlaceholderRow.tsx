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
      <div className="entry-time">
        {window.startTime}
        <small>{window.endTime}</small>
      </div>

      <div className="entry-main">
        <div>
          <span className="entry-cat">
            <UtensilsCrossed size={14} /> Frokost
          </span>
        </div>
        <div className="entry-note">Forventet — registreres når du taster henover frokosten.</div>
      </div>

      <div className="entry-actions">
        <span className="smu-badge smu-badge-grey">Forventet</span>
      </div>
    </div>
  );
}
