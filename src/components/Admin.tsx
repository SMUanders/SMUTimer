import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { initStore } from "../lib/storage";
import { loadPeople, people } from "../lib/people";
import { loadHidden, saveHidden } from "../lib/overblikFilter";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { getSupabaseClient } from "../lib/supabaseClient";
import { AppSwitcher } from "../platform-nav/AppSwitcher";
import { signOut } from "../lib/auth";
import DayOverview from "./admin/DayOverview";
import WeekOverview from "./admin/WeekOverview";
import SagOverview from "./admin/SagOverview";
import EmployeeFilter from "./admin/EmployeeFilter";
import { UpdateBanner } from "../platform-update/UpdateBanner";
import { appBuildIdShort } from "../platform-update/buildId";
import { appProductVersion } from "../lib/version";
import type { SagDeeplink } from "../lib/sagDeeplink";
import { skrivOverblikAdresse, tolkOverblik, type OverblikTilstand } from "../lib/overblikAdresse";
import { todayIso } from "../lib/dates";

type Tab = "dag" | "uge" | "sag";

// Admin/Overblik — Natasha & Anders. Egen route (/oversigt). Ingen skrivning her,
// kun læsning på tværs af medarbejdere. Klik åbner medarbejderens dagsseddel via
// deep-link (?medarbejder=<id>&dato=<YYYY-MM-DD>). Fra SMU OS kan sagens tidsforbrug
// åbne fanen "Sag" med sagen valgt (?sag=<id>&smu=<SMU-nr.>).
export default function Admin() {
  // Fane, dato, uge og valgt sag står i adressen (vedligeholdelsespakke 2, src/lib/overblikAdresse.ts): F5 og
  // tilbage fra en medarbejders dag lander samme sted. Uden parametre: Dag, i dag (som før). OS-deeplinket
  // (?sag=&smu=) åbner fortsat fanen Sag.
  const [start] = useState(() => tolkOverblik(window.location.search));
  const [adr, setAdr] = useState<OverblikTilstand>(start);
  const tab = adr.fane;
  const setTab = (fane: Tab) => setAdr((a) => ({ ...a, fane }));
  const onDato = useCallback((dato: string) => setAdr((a) => (a.dato === dato ? a : { ...a, dato })), []);
  const onUge = useCallback((uge: string) => setAdr((a) => (a.uge === uge ? a : { ...a, uge })), []);
  const onSag = useCallback((sag: SagDeeplink | null) => setAdr((a) => ({ ...a, sag })), []);
  useEffect(() => {
    skrivOverblikAdresse(adr, todayIso());
  }, [adr]);
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
          {/* Diskret skift til Hub og brugerens oevrige SMU-apps */}
          {getSupabaseClient() && (
            <AppSwitcher supabase={getSupabaseClient()!} currentAppKey="tid" />
          )}
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
        <button className={tab === "sag" ? "active" : ""} onClick={() => setTab("sag")}>
          Sag
        </button>
      </div>

      {!ready ? (
        <div className="empty">Indlæser…</div>
      ) : tab === "sag" ? (
        // Sag-overblik er på tværs af alle medarbejdere (ikke medarbejder-filtreret).
        <SagOverview startSag={adr.sag} onSag={onSag} />
      ) : (
        <>
          <EmployeeFilter people={allPeople} hidden={hidden} onChange={setHidden} />
          {visiblePeople.length === 0 ? (
            <div className="empty">
              Ingen medarbejdere valgt i filteret. Tryk “Alle” for at vise dem igen.
            </div>
          ) : tab === "dag" ? (
            <DayOverview visiblePeople={visiblePeople} startDato={adr.dato} onDato={onDato} />
          ) : (
            <WeekOverview visiblePeople={visiblePeople} startUge={adr.uge} onUge={onUge} />
          )}
        </>
      )}

      <div className="app-version" title={`Build ${appBuildIdShort()}`}>
        SMU Tid {appProductVersion()}
      </div>
      <UpdateBanner />
    </div>
  );
}
