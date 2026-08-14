import { useEffect, useState } from "react";
import { APP_VERSION } from "./version";

// Hvor ofte der tjekkes for ny version (5 min). INGEN service worker/offline —
// bare et let fetch af /version.json.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Returnerer true når serverens version.json afviger fra den kørende app —
 * dvs. der er deployet en nyere version, og fanen bør genindlæses.
 * Tjekker ved opstart, hvert 5. minut, og når fanen bliver synlig igen
 * (fanger gamle åbne faner/app-ikoner).
 */
export function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        // Cache-bust + no-store, så vi altid ser serverens aktuelle version.
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: unknown };
        const serverVersion = typeof data.version === "string" ? data.version : null;
        if (alive && serverVersion && serverVersion !== APP_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // Netværksfejl ignoreres — vi prøver igen ved næste interval.
      }
    }

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return updateAvailable;
}
