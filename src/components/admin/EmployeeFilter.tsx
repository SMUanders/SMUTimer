import { RotateCcw } from "lucide-react";
import type { Person } from "../../lib/people";

interface Props {
  people: Person[];
  hidden: Set<string>;
  onChange: (hidden: Set<string>) => void;
}

// Simpelt visnings-filter: slå medarbejdere til/fra i overblikket.
export default function EmployeeFilter({ people, hidden, onChange }: Props) {
  const visibleCount = people.filter((p) => !hidden.has(p.id)).length;
  const total = people.length;
  const aktiv = visibleCount < total;

  function toggle(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function udenAndersNatasha() {
    const ids = people
      .filter((p) => p.name === "Anders" || p.name === "Natasha")
      .map((p) => p.id);
    onChange(new Set(ids));
  }

  return (
    <div className="filter-card">
      <div className="filter-head">
        <div className="filter-status">
          Viser <strong>{visibleCount}</strong> af <strong>{total}</strong> medarbejdere
          {aktiv && <span className="smu-badge smu-badge-orange">Filter aktivt</span>}
        </div>
        <div className="filter-quick">
          <button className="smu-btn-secondary" onClick={() => onChange(new Set())}>
            Alle
          </button>
          <button className="smu-btn-secondary" onClick={udenAndersNatasha}>
            Uden Anders/Natasha
          </button>
          <button className="smu-btn-ghost filter-reset" onClick={() => onChange(new Set())}>
            <RotateCcw size={14} /> Nulstil filter
          </button>
        </div>
      </div>

      <div className="filter-grid">
        {people.map((p) => (
          <label key={p.id} className="filter-check">
            <input
              type="checkbox"
              checked={!hidden.has(p.id)}
              onChange={() => toggle(p.id)}
            />
            {p.name}
          </label>
        ))}
      </div>
    </div>
  );
}
