import { useMemo } from "react";
import { toHHMM, toMinutes } from "../lib/time";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Interval-grænser for forslagene. Default 06:00–18:00. */
  from?: string;
  to?: string;
}

// Tidsfelt med 15-minutters FORSLAG (06:00, 06:15, 06:30 …), men fri manuel
// indtastning af enhver gyldig HH:MM (fx 07:35, 08:10). Realiseret som et
// <input type="time"> med en delt <datalist> af kvarter-forslag.
const STEP = 15;
const DATALIST_ID = "smu-time-quarters";

function quarters(from: string, to: string): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const list: string[] = [];
  for (let m = start; m <= end; m += STEP) list.push(toHHMM(m));
  return list;
}

export default function TimeSelect({ value, onChange, from = "06:00", to = "18:00" }: Props) {
  const options = useMemo(() => quarters(from, to), [from, to]);
  return (
    <>
      <input
        className="smu-input"
        type="time"
        list={DATALIST_ID}
        value={value}
        step={60}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={DATALIST_ID}>
        {options.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}
