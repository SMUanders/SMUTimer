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
          <div className="k">Huller</div>
          <div className="v">{formatDuration(gapMinutes)}</div>
        </div>
        <div className="summary-cell">
          <div className="k">Mangler</div>
          <div className="v">{formatDuration(missingMinutes)}</div>
        </div>
      </div>

      <div className="summary-flags">
        {missingMinutes === 0 && overlaps.length === 0 && gaps.length === 0 && (
          <span className="flag ok">Dagen ser komplet ud</span>
        )}
        {overlaps.length > 0 && (
          <span className="flag">
            {overlaps.length} overlap{overlaps.length > 1 ? "" : ""}
          </span>
        )}
        {gaps.length > 0 && (
          <span className="flag">
            {gaps.length} hul{gaps.length > 1 ? "ler" : ""}
          </span>
        )}
        {missingMinutes > 0 && (
          <span className="flag">Mangler {formatDuration(missingMinutes)} t</span>
        )}
      </div>
    </div>
  );
}
