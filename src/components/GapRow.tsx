import { Plus } from "lucide-react";
import type { Gap } from "../lib/summary";
import { formatDuration } from "../lib/time";

interface Props {
  gap: Gap;
  /** Valgfri: åbn en normal manuel registrering forudfyldt til hullet. */
  onAdd?: (gap: Gap) => void;
}

// Rolig, smal visuel linje for manglende indtastning. Er IKKE en registrering:
// gemmes ikke og påvirker ingen sum (arbejdstid/pause/mangler/overarbejde).
export default function GapRow({ gap, onAdd }: Props) {
  return (
    <div className="gap-row">
      <span className="gap-text">
        Indtastning mangler · {gap.startTime}–{gap.endTime} · {formatDuration(gap.minutes)}
      </span>
      {onAdd && (
        <button className="smu-btn-ghost gap-add" onClick={() => onAdd(gap)}>
          <Plus size={13} /> Udfyld her
        </button>
      )}
    </div>
  );
}
