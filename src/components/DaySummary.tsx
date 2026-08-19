import type { DaySummary as Summary, Gap } from "../lib/summary";
import { formatDuration } from "../lib/time";

interface Props {
  summary: Summary;
  /** "Indtastning mangler"-segmenter (rammet ind af normal arbejdsdag). */
  missing: Gap[];
}

export default function DaySummary({ summary, missing }: Props) {
  const { workedMinutes, breakMinutes, overlaps, missingMinutes } = summary;
  const missingInputMinutes = missing.reduce((s, g) => s + g.minutes, 0);

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
          <div className="k">Indtastning mangler</div>
          <div className="v">{formatDuration(missingInputMinutes)}</div>
        </div>
        <div className="summary-cell">
          <div className="k">Mangler</div>
          <div className="v">{formatDuration(missingMinutes)}</div>
        </div>
      </div>

      <div className="summary-flags">
        {missingMinutes === 0 && overlaps.length === 0 && missing.length === 0 && (
          <span className="smu-badge smu-badge-green">Dagen ser komplet ud</span>
        )}
        {overlaps.length > 0 && (
          <span className="smu-badge smu-badge-orange">{overlaps.length} overlap</span>
        )}
        {missing.length > 0 && (
          <span className="smu-badge smu-badge-grey">
            Indtastning mangler: {missing.length}
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
