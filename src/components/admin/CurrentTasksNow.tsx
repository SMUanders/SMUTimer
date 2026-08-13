import { useEffect, useState } from "react";
import { store } from "../../lib/storage";
import { getCategory, getSubcategory } from "../../data/categories";
import type { CurrentTask } from "../../types";
import type { Person } from "../../lib/people";

interface Props {
  people: Person[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? `i dag ${hh}` : `${d.getDate()}. ${MONTHS[d.getMonth()]} ${hh}`;
}

// "Arbejder på nu" — status pr. medarbejder. Ikke tidsregistrering.
export default function CurrentTasksNow({ people }: Props) {
  const [tasks, setTasks] = useState<CurrentTask[]>([]);

  useEffect(() => {
    let alive = true;
    store()
      .getAllCurrentTasks()
      .then((t) => alive && setTasks(t));
    return () => {
      alive = false;
    };
  }, []);

  const byEmp = new Map(tasks.map((t) => [t.employeeId, t]));

  return (
    <div className="now-card">
      <div className="now-head">Arbejder på nu</div>
      <div className="now-list">
        {people.map((p) => {
          const t = byEmp.get(p.id);
          const cat = t ? getCategory(t.categoryId) : undefined;
          const sub = t ? getSubcategory(t.categoryId, t.subcategoryId) : undefined;
          return (
            <div key={p.id} className="now-row">
              <div className="now-name">{p.name}</div>
              <div className="now-task">
                {t ? (
                  <>
                    <span className="now-cat">{cat?.name ?? "—"}</span>
                    {sub && <span className="now-sub"> / {sub.name}</span>}
                    {t.orderNumber && <span className="now-order"> · {t.orderNumber}</span>}
                    {t.note && <span className="now-note"> — {t.note}</span>}
                  </>
                ) : (
                  <span className="now-empty">Ingen aktuel opgave</span>
                )}
              </div>
              <div className="now-when">{t ? formatWhen(t.updatedAt) : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
