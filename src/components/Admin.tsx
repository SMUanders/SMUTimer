import { useEffect, useState } from "react";
import { initStore } from "../lib/storage";
import DayOverview from "./admin/DayOverview";
import WeekOverview from "./admin/WeekOverview";

type Tab = "dag" | "uge";

// Admin/Overblik — Natasha & Anders. Egen route (/oversigt). Ingen skrivning her,
// kun læsning på tværs af medarbejdere. Klik åbner medarbejderens dagsseddel via
// deep-link (?medarbejder=<id>&dato=<YYYY-MM-DD>).
export default function Admin() {
  const [tab, setTab] = useState<Tab>("dag");
  const [ready, setReady] = useState(false);
  const [storageName, setStorageName] = useState<"local" | "supabase">("local");

  useEffect(() => {
    initStore().then((name) => {
      setStorageName(name);
      setReady(true);
    });
  }, []);

  return (
    <div className="admin">
      <header className="admin-header">
        <h1 className="admin-title">
          Overblik{" "}
          <span className="storage-tag">
            {storageName === "supabase" ? "Supabase" : "Lokalt (dev)"}
          </span>
        </h1>
        <a className="admin-back" href="/">
          ← Til dagsseddel
        </a>
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
      ) : tab === "dag" ? (
        <DayOverview />
      ) : (
        <WeekOverview />
      )}
    </div>
  );
}
