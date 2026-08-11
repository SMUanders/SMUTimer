import { EMPLOYEES } from "../data/employees";

interface Props {
  onSelect: (employeeId: string) => void;
}

// Startside / medarbejdervælger. Vises når ingen medarbejder er valgt.
export default function EmployeeSelect({ onSelect }: Props) {
  return (
    <div className="picker">
      <h1 className="picker-title">SMU Tid</h1>
      <p className="picker-sub">Vælg medarbejder for at åbne dagsseddel</p>
      <div className="picker-grid">
        {EMPLOYEES.map((e) => (
          <button key={e.id} className="picker-item" onClick={() => onSelect(e.id)}>
            {e.name}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>
        <a className="admin-back" href="/oversigt">
          Åbn overblik (admin) →
        </a>
      </p>
    </div>
  );
}
