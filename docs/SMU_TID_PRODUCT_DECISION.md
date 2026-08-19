# SMU Tid produktbeslutning

> Status: **besluttet** (afløser den seneste lokale UX-runde, som ikke blev godkendt).
> Denne fil er retningsgivende for næste medarbejder-build. Ingen kode er ændret ud
> over denne dokumentation.

**Dagssedlen er historik, ikke input.**

Medarbejderen skal ikke udfylde en dagsseddel som normalflow. Medarbejderen vælger
opgave, starter arbejde, skifter opgave, starter pause og vender tilbage til arbejde.
Systemet bygger tidslinjen ud fra disse handlinger.

Manuel udfyldning, redigering, sletning og rettelse af tid er **leder-/korrektions-
værktøjer** — ikke medarbejderens normale vej.

Aktuel opgave er derfor **ikke** et ekstra kort oven på dagssedlen. Aktuel opgave er
medarbejderens **primære arbejdsskærm**. Dagssedlen viser historikken bagefter.

## Medarbejderens normalflow

- Vælg opgave/sag
- Start arbejde
- Skift opgave
- Start pause
- Tilbage til arbejde
- Slut dag
- Se historik

## Ikke medarbejderens normalflow

- Manuel oprettelse af tidslinjer
- Manuel udfyldning af huller
- Redigering af historiske linjer
- Sletning af historiske linjer
- Korrektion af omgøring/bagudrettede fejl

Dette er leder-/korrektionsværktøjer.

## Ledelsesflow

Ledelsen skal kunne:
- se hvem arbejder på hvad nu
- se manglende tid
- se afvigelser
- rette fejl
- udfylde manglende tid
- slette/korrigere registreringer
- eksportere/rapportere senere

## Produktretning

SMU Tid må gerne udvikle sig mod et mere stempelur-lignende flow over tid.
Det må **ikke** blive et uklart halvt stempelur.

I næste medarbejderversion skal den primære skærm være:
**"Hvad arbejder jeg på nu?"** — ikke "Udfyld din dagsseddel."

---

## Teknisk vurdering af den lokale arbejdskopi (parkeret, ikke committet)

Referencepunkt: seneste stabile live-version er commit `6f5a6ac` (= `origin/main`).
Hele den lokale UX-eksperiment ligger **uncommittet** i arbejdskopien ovenpå denne.

### A. Værd at genbruge senere (i den nye model)
- **Varighed pr. linje** (`start–slut · varighed`) — god som *historik*-visning.
- **"Indtastning mangler"** rammet ind af normal arbejdsdag (man–tor 07:30–15:30,
  fre 07:30–15:00, weekend 0) — god som neutralt *historik-/ledelsessignal*
  (`missingInputSegments` + `workdayWindow` i `src/lib/summary.ts`, med tests).
- **Kompakt/rolig linjevisning** af historik (mindre kort-tyngde).
- **Afslut-kontekst i editoren**: egen titel + skjult "sæt som aktuel opgave"-flueben
  (`title`/`saveLabel`/`allowSetAsCurrent` på `EntryEditor`) — nyttigt til
  gem-tid-fra-opgave og til leder-korrektion.
- Fredag = 7 t / man–tor = 7,5 t / weekend 0 (allerede live i `6f5a6ac`).

### B. Bør kasseres (bygger på forkert mentalmodel)
- **"Udfyld dagsseddel"** som medarbejder-sticky-handling (gør manuel udfyldning til
  normalvej).
- **"Udfyld her"** på huller som *medarbejder*-handling (hul-udfyldning er
  leder-/korrektion, ikke medarbejderens normalflow).
- Forsøg på at gøre **manuel registrering** til medarbejderens primære vej.
- Diverse **UI-lapper** der stadig placerer aktuel opgave *oven på* dagssedlen i
  stedet for at gøre den til den primære skærm.

> Bemærk: "Indtastning mangler" og "Udfyld her" deler kode, men **modellen adskiller
> dem**: signalet "indtastning mangler" beholdes (neutralt), medarbejder-handlingen
> "udfyld her" fjernes. Udfyldning flyttes til leder-/korrektionsværktøjer.

### C. Sikreste rollback (anbefaling — ikke udført)
Intet af eksperimentet er committet, så **repo-historikken kan ikke miste noget**.
Live-versionen er allerede `6f5a6ac`.

Anbefalet fremgang (Anders udfører, når klar):
1. **Park eksperimentet på en lokal gren** (så de genbrugelige dele bevares):
   `git switch -c parkering/mobil-ux-eksperiment && git add -A && git commit -m "WIP: parkeret lokal UX-runde (ikke godkendt)"`
   (commit kun lokalt — **ikke** push).
2. **Tilbage til live på main:** `git switch main` → arbejdskopien er nu ren og
   identisk med `6f5a6ac` (= live). Ingen deploy udløses.
3. Senere kan de genbrugelige dele (afsnit A) cherry-pickes/kopieres fra
   parkerings-grenen ind i medarbejderflow v2.

Alternativ (simplest, hvis vi ikke behøver at bevare eksperimentet):
`git stash push -u -m "parkeret ux-runde"` — rydder arbejdskopien til `6f5a6ac` og
gemmer eksperimentet i en stash. (Grenen er mere holdbar end en stash.)

Rul **ikke** `main` tilbage til en ældre commit — det er unødvendigt, da HEAD
allerede ER live-versionen; kun arbejdskopien er "foran".

---

## Faseplan: medarbejderflow v2 (forslag — ikke bygget)

Én medarbejdervej, én primær skærm ad gangen.

### Fase 0 — beslutning + datamodel-tjek (ingen UI)
- Bekræft at "start/skift/pause/tilbage/slut" kan bygges oven på eksisterende data
  uden migration i første omgang (aktuel opgave + tidsregistreringer findes allerede).
- Afklar om løbende tid skal vises live (uden at det bliver et låst stempelur).

### Fase 1 — primær skærm: "Hvad arbejder jeg på nu?"
- **Ingen aktiv opgave:** vælg opgave/sag → vælg aktivitet/kategori → **Start**.
- **Aktiv opgave:** vis hvad jeg arbejder på nu, startet-tidspunkt og løbende tid.
  Primære handlinger: **Skift opgave** · **Start pause** · **Slut dag**.
- **Pause:** vis "pause startet". Primær handling: **Tilbage til arbejde**.
- Handlingerne bygger tidslinjen automatisk (skift/pause/slut opretter/lukker linjer).

### Fase 2 — historik (læsevisning)
- Læsevenlig tidslinje: interval + varighed, opgave/sag, pause.
- "Indtastning mangler" vises som **neutralt signal** (ikke en medarbejderknap).
- **Ingen** normal medarbejderknap til manuel udfyldning.

### Fase 3 — leder/korrektion (adskilt fra medarbejderskærmen)
- Manuel registrering, redigering, sletning, udfyld huller, omgøring.
- Senere: rapport/eksport.
- Adgangsstyres når roller indføres (ikke nu).

### Ikke i v2
- Stor kalender, rapport/CSV, roller/PIN, SMU OS-integration, automatisk
  SMU-nummer-opslag. (Kan komme senere, separat besluttet.)

---

## Relevante komponenter/routes i næste build

| Komponent/fil | Rolle i den nye model |
|---|---|
| `src/App.tsx` | Skift medarbejder-visning til **primær = aktuel opgave-skærm**; historik som sekundær sektion/rute. Fjern "Udfyld dagsseddel" som medarbejder-primærknap. |
| `CurrentTaskCard` | Vokser til den **primære arbejdsskærm** (ikke et lille kort): vælg/start/skift/pause/slut + løbende tid. |
| `storage/current task-logik` | Udvides til at drive start/skift/pause/tilbage → generere tidslinje-linjer. Overvej om et "startet"-tidspunkt skal i DB (i dag localStorage). |
| `EntryRow` | Rendyrkes til **historik-linje** (læsevenlig: interval + varighed + opgave). Rediger/slet flyttes til leder/korrektion. |
| `GapRow` | "Indtastning mangler" som **neutralt historiksignal**; medarbejder-handlingen "Udfyld her" fjernes. |
| `DaySummary` | Kompakt historik-/dagsopsummering (arbejdstid, pause, indtastning mangler, mangler). |
| `EntryEditor` | Bliver primært et **leder-/korrektionsværktøj** (manuel/rediger/udfyld). Behold afslut-kontekst (titel/gem-tekst/skjult flueben) til "gem tid fra opgave". |
| `Overview/Admin` (`/oversigt`) | **Ledelsesflow**: hvem arbejder på hvad nu, manglende tid, afvigelser, korrektion, senere rapport. |

---

## Hvad Anders skal beslutte før næste build

1. **Rollback nu?** Park lokal eksperiment på gren + gå tilbage til `6f5a6ac` på main
   (anbefalet), eller lad arbejdskopien stå urørt indtil v2-planen er godkendt.
2. **Løbende tid på medarbejderskærmen:** må den vise en tællende tid (mod stempelur),
   eller kun "startet ca."? (Grænsen "ikke et uklart halvt stempelur".)
3. **Skift opgave-semantik:** lukker "Skift opgave" automatisk forrige linje på nu-
   tidspunktet, og med hvilken afrunding (15 min?)?
4. **Pause:** fast frokost-forslag bevares, eller styres pause udelukkende af
   start/stop-handlinger fremover?
5. **Migration:** accepteres en lille DB-ændring i v2 (fx `started_at` på aktuel opgave)
   for korrekt løbende tid på tværs af enheder, eller skal det forblive localStorage?
6. **Leder/korrektion-adgang:** skal manuel/rediger/slet skjules for medarbejdere nu
   (uden roller endnu), eller vente til roller indføres?
