import type { DaySummary as Summary } from "../lib/summary";
import { formatDuration } from "../lib/time";

interface Props {
  summary: Summary;
}

export default function DaySummary({ summary }: Props) {
  const { workedMinutes, breakMinutes, gaps, overlaps, missingMinutes } = summary;
  const gapMinutes = gaps.reduce((s, g) => s + g.minutes, 0);

  return (
    <div className="summary">
      <div className="summary-grid">
        <div className="summary-cell">
          <div className="k">Arbejdstid</div>
          <div className="v">{formatDuration(workedMinutes)}</div>
        </div>
        <div className="summary-cell">
          <div className="k">Pause</div>
          <div className="v">{formatDuration(breakMinutes)}</div>
        </div>
        <div className="summary-cell">
          <div className="k">Mellemrum</div>
          <div className="v">{formatDuration(gapMinutes)}</div>
        </div>
        <div className="summary-cell">
          <div className="k">Mangler</div>
          <div className="v">{formatDuration(missingMinutes)}</div>
        </div>
      </div>

      <div className="summary-flags">
        {missingMinutes === 0 && overlaps.length === 0 && gaps.length === 0 && (
          <span className="smu-badge smu-badge-green">Dagen ser komplet ud</span>
        )}
        {overlaps.length > 0 && (
          <span className="smu-badge smu-badge-orange">{overlaps.length} overlap</span>
        )}
        {gaps.length > 0 && (
          <span className="smu-badge smu-badge-grey">
            {gaps.length} mellemrum
          </span>
        )}
        {missingMinutes > 0 && (
          <span className="smu-badge smu-badge-orange">
            Mangler {formatDuration(missingMinutes)} t
          </span>
        )}
      </div>
    </div>
  );
}
