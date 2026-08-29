# SMU Tid produktbeslutning

> Status: **SMU Tid v2 er PRODUCTION-LIVE på https://smutimer.netlify.app** (feature-frozen, main = go-live-commit). Custom-domain (`tid.smu.signmeup.dk`) + TLS + Supabase Auth URL + **SSO-cutover er PENDING** (ikke live endnu). Hub peger fortsat på `smutimer.netlify.app`.
> (Produktnavnet er nu "SMU Tid v2"; "vNext" var det tidligere internt navn — historiske
> git-/branchnavne omdøbes ikke.) Medarbejderne briefes om det nye flow, før vi skifter
> fra den nuværende live-version.
> Afsnittene "Faseplan (forslag)" og "Relevante komponenter" længere nede er
> **historiske** (den oprindelige plan) — den faktiske sandhed står i "Aktuel sandhed"
> nedenfor. Fase 1's "Skift opgave / Tilbage til arbejde" blev IKKE bygget; i stedet
> Afslut/Start + Hjælp + Omgøring + Fravær med automatisk genoptagelse.

## Aktuel sandhed (SMU Tid v2 releasekandidat)

- **Aktiv opgave er medarbejderens primære arbejdsstatus** ("● I gang nu"), ikke et kort oven på en dagsseddel.
- **Almindelig afslutning har justerbare tider:** "Gå til afslutning" åbner en form med redigerbar start/slut; kun den endelige "Gem afsluttet opgave" gemmer.
- **Hjælp på anden opgave er OPGAVE-FØRST.** Man vælger/indtaster den **arbejdsreference** (SMU-sag, ordre, stelnummer, kunde — fri tekst i det eksisterende ordre/sag/kunde-felt) man hjælper på, + aktivitet (kategori/underpunkt, fx **Montage internt · Trucking**). "Opgaver i gang lige nu" viser aktive opgaver **opgave-først** (reference primær, aktivitet sekundær, medarbejder som metadata) — kun en **genvej** til prefilling; den relevante opgave behøver ikke være på listen, referencen kan altid indtastes manuelt. Tiden lander på **den anden opgave**, ikke på ens egen. Teknisk: egen opgave lukkes frem til hjælpens start, hjælp køres som mini-stopur (start/stop autoritativ, 5-min-regel, min. 5 min), og egen opgave **genoptages automatisk** fra hjælpens sluttid. Intet overlap.
- **Omgøring** er særskilt struktureret tid med **årsag** (`isRedo`/`redoReason`/`redoNote`); trækkes ud af normal opgave; egen opgave genoptages automatisk. Vises i Min dag + som afvigelse i /oversigt.
- **Pause** tæller **ikke** som arbejdstid.
- **Fravær** (`tid_absences`) er drifts-/tilstedeværelsesstatus — **ikke** løn-/ferie-/sygdoms-/saldomodel. Aktivt = `ended IS NULL`; `expected_end` (forventet) og `ended` (faktisk) er adskilte. Tæller ikke som arbejde/pause; reducerer "Mangler".
- **Min dag** er en **read-only** lodret tidslinje (arbejde/hjælp/omgøring/pause/fravær/hul/overlap). Ingen Rediger/Slet/Ny/Udfyld på medarbejderskærmen.
- **/oversigt** er lederens drifts-/dagsoverblik: "Arbejder på nu" + "Dagens registrering". Åbent for alle med Tid-adgang (SELECT); klik på en medarbejder åbner medarbejderens dag.
- **Leder-visning af en medarbejders dag ("Andreas' dag"):** klik i Overblik (`?medarbejder=…`) åbner medarbejderens **v2-dag** (samme `DayTimeline` + summer + aktiv opgave-status som medarbejderen selv ser) — **ikke** "registrér som medarbejderen". Viewer-identiteten (auth) ændres aldrig; subject kommer kun fra deep-linket. Leder/admin får eksplicitte, **rolle-gatede** korrektioner: ret registrering (klik i tidslinjen), tilføj registrering, slet, og **afslut aktiv opgave med eksplicit sluttid** (systemet gætter ikke — lederen bekræfter/retter start+slut). Medarbejder/observatør der åbner en dag = **read-only** (`canLeaderCorrect`; `src/lib/tidRole.ts`). RLS (`20260828140001`) er den reelle grænse. Komponent: `src/components/LeaderDay.tsx`. **Den gamle v1-dagsseddel (`src/App.tsx`) + byggeklodser (`CurrentTaskCard`/`EntryRow`/`LunchPlaceholderRow`) er fjernet** — ingen route giver længere v1-hovedoplevelsen.
- **Identitet & owner-scope (individuelt login):** SMU Tid bruges med **individuelt login** — ingen fælles værksteds-PC/tablet. En almindelig medarbejder kan **kun** oprette/ændre/slette **egne** tid-data. `employee_id` bindes til den autentificerede bruger (`auth.uid`), aldrig til en dropdown/localStorage/query-param; medarbejder-vælgeren er fjernet fra det almindelige flow (kun lokal-dev-fallback). **Backend/RLS er den reelle grænse:** owner-scope-policies på `tid_time_entries`/`tid_current_tasks`/`tid_absences` = `har_app_rolle('tid','leder')` ELLER (`medarbejder` OG `employee_id = auth.uid()`) (smu-os-v2 migration `20260828140001`, live 28. aug. 2026). **Leder/admin** bevarer bred korrektionsadgang til andre; **observatør** er read-only.
- **Normtid:** man–tor = 7,5 t · fredag = 7 t · weekend = 0.
- **Sammenhængende tidslinje:** systemets default-forslag skaber aldrig hul/overlap (næste start = seneste sluttid). Tidlige møder (fx Sascha kl. 05:00) understøttes (forslag fra 05:00; ingen hard grænse).

## Backlog — POST-v2 (ikke bygget · IKKE blockers for v2)

Vurderes først **efter reel brug** af v2. Ingen af dem blokerer go-live.

1. **Afbrydelse / Telefon / Kundepleje / andet ikke-sagsarbejde** — generel afbrydelsesmekanisme (typisk 5–10 min) der trækker tiden ud af aktiv opgave, når tiden **ikke** hører til en anden sag. Selvstændig produktbeslutning; må **ikke** hardcodes som en persons specialløsning.
2. **Trucking-quick action** — dedikeret hurtigknap, hvis reel drift viser behov. (I v2 vælges Trucking via kategori-vælgeren: Montage internt · Trucking.)
3. **Justering af hjælpetid ved afslutning** — hvis reel drift viser behov. (I v2 er start/stop autoritativt; **ingen redigering af hjælpetiden i afslutningsøjeblikket** er bevidst accepteret.)
4. **Autoritativ `started_at`** til lederoverblik (i dag bruger "Startet/I gang" `updated_at` som proxy). Ingen DB-ændring nu.
5. ~~**Tid-identitet / owner-scope**~~ — **LØST 28. aug. 2026** (var: "vælg medarbejder"-modellen betød at RLS ikke var bundet til `employee_id = auth.uid()`, så en medarbejder kunne skrive som en anden). Produktbeslutning: **individuelt login** (ingen fælles værksteds-PC). RLS owner-scope er nu live (smu-os-v2 migration `20260828140001`) og frontend binder `employee_id` til `auth.uid` (`resolveEmployeeIdentity`). Se "Identitet & owner-scope" under Aktuel sandhed.
6. **Rapport / CSV / analyse** — senere.

## Production-live status & næste gate (Reality Sync)

- **SMU Tid v2 er PRODUCTION-LIVE** på `https://smutimer.netlify.app` (main = go-live-commit; Netlify auto-deploy verificeret grøn: app loader, platform-nav/AppSwitcher renderer, ingen runtime-fejl).
- **SMU Tid v2 er FEATURE-FROZEN.** Der bygges ikke flere funktioner før reel brug af v2; kendte forbedringer (backlog ovenfor) hører efter drift-feedback.
- **Ingen krav om perfekt minutpræcision.** Hjælp/omgøring bruger 5-min-afrunding, og registreringer under overgang/briefing (fx fredag) behøver ikke være perfekte — Signmeup accepterer det.
- **Custom-domain / SSO-cutover er PENDING (endnu ikke live):** næste gate er `tid.smu.signmeup.dk` + TLS + opdateret **Supabase Auth URL** + SSO. På `smutimer.netlify.app` bruges fortsat localStorage-login — det er korrekt og **ikke** en SSO-fejl. Hub peger fortsat på `smutimer.netlify.app`.
- Kanonisk `NEXT_STEPS` (Truth Reset i `smu-os-v2`) synkes af platform-/Hub-sporet; hub-migrationshistorik for APV/Color/Tid reconciles i Hub-sporet → **ingen migration køres fra smu-tid** (fravær-tabellen `tid_absences` er allerede live og uafhængig af dette).

---

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
