import { LayoutGrid } from "lucide-react";
import { people } from "../lib/people";

interface Props {
  onSelect: (employeeId: string) => void;
}

// Startside / medarbejdervælger. Vises når ingen medarbejder er valgt.
export default function EmployeeSelect({ onSelect }: Props) {
  return (
    <div className="picker">
      <h1 className="picker-title">SMU Tid</h1>
      <p className="picker-sub">Vælg dig selv for at åbne din dagsseddel</p>
      <div className="picker-grid">
        {people().map((e) => (
          <button key={e.id} className="picker-item" onClick={() => onSelect(e.id)}>
            {e.name}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>
        <a className="admin-back" href="/oversigt">
          <LayoutGrid size={15} /> Åbn overblik (admin)
        </a>
      </p>
    </div>
  );
}
