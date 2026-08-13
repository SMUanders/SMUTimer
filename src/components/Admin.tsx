import { useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { initStore } from "../lib/storage";
import { loadPeople, people } from "../lib/people";
import { loadHidden, saveHidden } from "../lib/overblikFilter";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import DayOverview from "./admin/DayOverview";
import WeekOverview from "./admin/WeekOverview";
import EmployeeFilter from "./admin/EmployeeFilter";

type Tab = "dag" | "uge";

// Admin/Overblik — Natasha & Anders. Egen route (/oversigt). Ingen skrivning her,
// kun læsning på tværs af medarbejdere. Klik åbner medarbejderens dagsseddel via
// deep-link (?medarbejder=<id>&dato=<YYYY-MM-DD>).
export default function Admin() {
  const [tab, setTab] = useState<Tab>("dag");
  const [ready, setReady] = useState(false);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden());

  useEffect(() => {
    (async () => {
      const name = await initStore();
      setStorageName(name);
      await loadPeople();
      setReady(true);
    })();
  }, []);

  // Gem filtervalget lokalt i browseren.
  useEffect(() => {
    saveHidden(hidden);
  }, [hidden]);

  const allPeople = people();
  const visiblePeople = allPeople.filter((p) => !hidden.has(p.id));

  return (
    <div className="admin">
      <header className="admin-header">
        <h1 className="admin-title">
          Overblik{" "}
          <span className="storage-tag">
            {storageName === "supabase" ? "Supabase" : "Lokalt (dev)"}
          </span>
        </h1>
        <div className="header-actions">
          <a className="admin-back" href="/">
            <ArrowLeft size={15} /> Til dagsseddel
          </a>
          {isSupabaseConfigured && (
            <button className="smu-btn-secondary link-btn" onClick={() => signOut()}>
              <LogOut size={15} /> Log ud
            </button>
          )}
        </div>
      </header>

      <div className="admin-tabs">
        <button className={tab === "dag" ? "active" : ""} onClick={() => setTab("dag")}>
          Dag
        </button>
        <button className={tab === "uge" ? "active" : ""} onClick={() => setTab("uge")}>
          Uge
        </button>
      </div>

      {!ready ? (
        <div className="empty">Indlæser…</div>
      ) : (
        <>
          <EmployeeFilter people={allPeople} hidden={hidden} onChange={setHidden} />
          {visiblePeople.length === 0 ? (
            <div className="empty">
              Ingen medarbejdere valgt i filteret. Tryk “Alle” for at vise dem igen.
            </div>
          ) : tab === "dag" ? (
            <DayOverview visiblePeople={visiblePeople} />
          ) : (
            <WeekOverview visiblePeople={visiblePeople} />
          )}
        </>
      )}
    </div>
  );
}
