import { useEffect, useState } from 'react'
import { APP_BUILD_ID, erNytBuild } from './buildId'

// Hvor ofte der tjekkes (5 min). Ingen service worker, ingen offline-cache — bare et let fetch.
const INTERVAL_MS = 5 * 60 * 1000

/**
 * true, når en nyere frontend er deployet end den, der kører i fanen.
 *
 * Kilder:
 *  - `/version.json` (fra build-outputtet) afviger fra `__APP_VERSION__` — tjekkes ved start,
 *    hvert 5. minut og når fanen/app-ikonet bliver synligt igen. Kun i produktion.
 *  - `vite:preloadError`: en gammel fane kan ikke længere hente et lazy chunk efter et deploy.
 *    Fejlen lades gå videre (til `PlatformUpdateBoundary`); her markeres blot, at der er en ny version.
 *
 * Genindlæser ALDRIG selv — det gør kun brugeren via `UpdateBanner`.
 */
export function useVersionCheck(): boolean {
  const [nyVersion, setNyVersion] = useState(false)

  useEffect(() => {
    const vedPreloadFejl = () => setNyVersion(true)
    window.addEventListener('vite:preloadError', vedPreloadFejl)

    const aktivt = import.meta.env.PROD && APP_BUILD_ID !== 'dev'
    let levende = true
    let id: number | undefined

    async function tjek() {
      try {
        // Cache-bust + no-store, så det altid er serverens aktuelle fil, der læses.
        const svar = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!svar.ok) return
        const data = (await svar.json()) as { version?: unknown }
        if (levende && erNytBuild(data.version, APP_BUILD_ID)) setNyVersion(true)
      } catch {
        // Netværksfejl ignoreres — næste interval prøver igen.
      }
    }
    const vedSynlig = () => {
      if (document.visibilityState === 'visible') tjek()
    }

    if (aktivt) {
      tjek()
      id = window.setInterval(tjek, INTERVAL_MS)
      document.addEventListener('visibilitychange', vedSynlig)
    }

    return () => {
      levende = false
      window.removeEventListener('vite:preloadError', vedPreloadFejl)
      if (id !== undefined) window.clearInterval(id)
      document.removeEventListener('visibilitychange', vedSynlig)
    }
  }, [])

  return nyVersion
}
