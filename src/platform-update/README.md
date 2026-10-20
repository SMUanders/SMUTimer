# SMU Platform-update (canonical)

Fælles update-notifikation for SMU Platform: en åben app opdager, at en nyere frontend er deployet, og viser
**"Ny version er klar – [Opdater]"**. **Model D** som `platform-nav`: dette er kilde-of-truth, og filerne
**kopieres uændret** ind i hver app (ingen npm-pakke, intet monorepo, ingen central tjeneste). Kanonisk placering:
`smu-hub/src/platform-update/`.

**Status:** officiel SMU-standard (okt. 2026), valideret i pilot (Tid, Pladsliste og Arkiv med reel lazy-chunk-fejl på
produktion). Gælder alle LIVE-apps undtagen Assist, ESG og Projektboard — se `SMU_APP_STANDARD.md` i smu-os.

## To adskilte versionsbegreber
| | Produktversion | Build-id |
|---|---|---|
| Eksempel | "SMU Tid v2.2" | `2026-10-20T12:34:56.789Z` |
| Kilde | `package.json` → `__APP_PRODUCT_VERSION__` (appens egen `lib/version.ts`) | dette moduls Vite-plugin → `__APP_VERSION__` |
| Formål | vises diskret til mennesker | opdager et nyere deploy (+ tooltip til fejlsøgning) |

De to blandes aldrig: en ny build af samme produktversion er stadig et nyt deploy.

## Indhold
- `vitePlatformUpdate.ts` — Vite-plugin. Ved `vite build` laves ét build-id, der compiles ind som `__APP_VERSION__`
  og lægges som `version.json` **direkte i build-outputtet** (`dist/version.json`). Intet i `public/`, ingen
  genereret fil i repoet. Under `vite dev`/vitest er id'et `dev`, og tjekket er slået fra.
- `buildId.ts` — `APP_BUILD_ID`, `appBuildIdShort()` og de rene regler `erNytBuild()` / `erChunkFejl()`.
- `useVersionCheck.ts` — **normal versionsdetektion**, kun i produktion: henter `/version.json` (no-store + cache-bust)
  ved start, hvert 5. minut og når dokumentet bliver synligt igen.
- `UpdateBanner.tsx` — diskret, ikke-modal besked nederst. `defer` skjuler den midlertidigt under kritisk redigering.
  Skjuler sig, når recovery-kortet er fremme (`RECOVERY_EVENT`).
- `PlatformUpdateBoundary.tsx` — **recovery**: en gammel fane, der ikke kan hente et lazy chunk efter et deploy
  (`vite:preloadError` eller chunk-fejl under rendering), får ét centralt kort i stedet for en tom side. Hele appen
  erstattes (header/navigation forsvinder bevidst). Alle andre fejl kastes videre uændret.

## UX-regel
- **Ny version:** nederste banner "Ny version er klar" + [Opdater]. Blokerer intet og ligger under modaler.
- **Lazy-/preload-fejl:** KUN det centrale recovery-kort "Ny version er klar" + [Opdater] — aldrig samtidig med banneret.
  Én sikker recovery-skærm frem for navigation i en inkonsistent gammel bundle.
- **Ingen automatisk genindlæsning.** Siden genindlæses kun, når brugeren klikker "Opdater", så intet input kasseres.
- Samme tekst og placering i alle apps.

## Sådan bruges det i en app
1. Kopiér hele mappen `src/platform-update/` uændret ind i appens `src/`.
2. `vite.config.ts`: `import { platformUpdate } from './src/platform-update/vitePlatformUpdate'` og tilføj
   `platformUpdate()` i `plugins`.
3. Montér `<UpdateBanner />` ét globalt sted (fx i `main.tsx` eller rod-layoutet) — eller pr. skærm med
   `defer={…}`, hvis appen har kritisk redigering, der ikke må forstyrres.
4. Omslut hele appen med `<PlatformUpdateBoundary>` (`<UpdateBanner />` som søskende uden for den).
5. Har appen en CSP, skal `connect-src` tillade `'self'` (fetch af `/version.json`).
6. Ingen `public/version.json` og ingen gitignore-linje til den.

## Opdatering
Ret canonical her og kopiér på ny ind i apps (som `platform-nav` og designsystemet). Ingen registry/build-infra.
