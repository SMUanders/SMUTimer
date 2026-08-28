# SMU Tid — medarbejderflow v2 (implementeringsplan)

> **STATUS: IMPLEMENTERET som SMU Tid v2 — FEATURE-FROZEN / RELEASE-KLAR / AFVENTER GO-LIVE (ikke live).**
> (Produktnavnet er "SMU Tid v2"; "vNext" var det tidligere interne navn — historiske
> git-/branchnavne, fx `release/vnext-candidate`, omdøbes ikke.)
> Den faktiske sandhed står i `docs/SMU_TID_PRODUCT_DECISION.md` → afsnittet
> **"Aktuel sandhed (SMU Tid v2 releasekandidat)"**. Denne plan er beholdt som historik.
>
> **Vigtige afvigelser fra planen som faktisk blev bygget:**
> - "Skift opgave / Tilbage til arbejde" blev **ikke** bygget. I stedet: Start opgave →
>   Gå til afslutning (justerbare tider) → Gem; samt **Hjælp på anden opgave** (opgave-først)
>   og **Omgøring** (begge splitter tiden ud og genoptager egen opgave automatisk), **Pause**,
>   og **Fravær** (`tid_absences`, delt drifts-status).
> - Der blev lavet **én DB-ændring** (godkendt): tabellen `tid_absences` (schema + RLS via
>   `har_app_adgang`/`har_app_rolle`) — applied i live DB.
> - Kandidaten er **committed + pushet til `origin/release/vnext-candidate`** (backup), men
>   **IKKE** merget/pushet til main og **ikke deployet** (push til main = Netlify-produktion).
>
> Referencepunkt: stabil main. Parkeret UI-eksperiment ligger på lokal branch
> `parkering/mobil-ux-eksperiment` (ikke pushet).

---

## V2 mentalmodel

SMU Tid v2 er **ikke** en manuel dagsseddel. Det er heller ikke et **låst hårdt
stempelur**.

Det er en **arbejdsstatus**, hvor medarbejderen siger: **"Hvad arbejder jeg på nu?"**
Systemet hjælper med tiden og bygger historikken.

Medarbejderen kan rette den aktive opgave, før den lukkes. Når segmentet lukkes,
bliver det historik.

---

## Kernemodel (den ene idé)

Alt bygger på ét begreb: **det aktive segment**. Et segment = den nuværende aktuelle
opgave (arbejde eller pause) med et **starttidspunkt**. Hver medarbejderhandling
(skift/pause/tilbage/slut) **lukker** det aktive segment til en `tid_time_entries`-linje
(start = segmentets start, slut = nu) og starter det næste. Dagssedlen er summen af de
lukkede segmenter = **historik**.

Fordi handlinger er sekventielle (luk før start), kan segmenter aldrig overlappe.

---

## Medarbejderens normalflow (UI)

Én skærm, én tilstand ad gangen (primærskærm = default route):

- **Ingen aktiv opgave** → *"Hvad arbejder du på nu?"* → vælg opgave + **Start**.
- **Aktiv opgave (arbejde)** → *"Du arbejder på: [kategori · underpunkt · sag]"* +
  *"Startet 08:52 · [løbende tid]"*. Handlinger: **Skift opgave · Start pause · Slut dag**.
- **Pause** → *"På pause siden 10:00 · [løbende tid]"* → **Tilbage til arbejde**.
- **Historik** (sekundær, read-only): dagens tidslinje — interval + varighed +
  opgave/pause, "Indtastning mangler" som **neutralt signal** (ingen medarbejderknap).

Mobil-først, rolig, få knapper, ingen konkurrerende flows.

---

## Start opgave

Når ingen opgave er aktiv, skal medarbejderen kunne starte en opgave med:
- ordre / sag / kunde
- kategori
- underpunkt
- note

Ordre/sag/kunde skal være **fleksibelt** i v2. Senere kan det erstattes eller
suppleres af SMU-nummer/opslag.

**Effekt:** `setCurrentTask(opgave)` + sæt starttid = nu. Ingen historiklinje endnu.

---

## Skift opgave

Ved "Skift opgave" skal appen:
1. **Lukke det aktive segment til historik** (arbejds-linje: start = segmentstart, slut = nu).
2. **Starte en ny aktiv opgave.**
3. Lade medarbejderen vælge/indtaste den nye opgaves:
   - ordre / sag / kunde
   - kategori
   - underpunkt
   - note

Skift-flowet må **ikke** ligne manuel efterregistrering. Det skal **ikke** spørge efter
start/slut som normalflow. Det skal handle om **den nye opgave**, ikke om at bygge
fortiden.

---

## Handlingerne (tilstandsmaskinen)

Fælles regel: hver handling **lukker det aktive segment** → `time_entry(start=segmentstart,
slut=nu)` og sætter næste tilstand.

| Handling | Fra tilstand | Effekt |
|---|---|---|
| **Start opgave** | ingen aktiv | `setCurrentTask(opgave)` + starttid = nu. Ingen linje endnu. |
| **Afslut opgave** | arbejde | Luk segment → arbejds-linje. `clearCurrentTask` + ryd starttid → **ingen aktiv opgave** (næste: Start opgave). Reducer-handling `close`. |
| **Skift opgave** | arbejde | Genvej: luk segment → arbejds-linje, og start straks ny opgave (vælg felter). |
| **Start pause** | arbejde | **Én handling:** luk segment → arbejds-linje + `setCurrentTask(Pause/Frokost)` + starttid = nu. (Ikke Afslut → derefter Pause.) |
| **Tilbage til arbejde** | pause | Luk segment → **pause-linje (is_break=true)**. Forudfyld seneste arbejdsopgave, men medarbejderen **bekræfter/tilpasser** før arbejdssegmentet starter. |
| **Slut dag / markér resten af dagen** | arbejde/pause | Færdig for dagen (evt. med årsag: kort dag/fravær). **Kræver DB** for at persistere/vise til kolleger — se "Kort dag / fravær" nedenfor. |

- **Afslut vs. Skift vs. Slut dag:** "Afslut opgave" er den **normale** måde at afslutte
  en opgave på (man står derefter i "ingen aktiv opgave" — det er ikke en fejl).
  "Skift opgave" er en genvej (afslut + start ny). "Slut dag" bruges **kun** når man er
  færdig for dagen.
- **Frokost:** pause er en **eksplicit handling** — ikke auto-split. Foreslået frokost
  bevares som blidt påmindelsessignal (produktvalg, se nederst).
- **Recovery:** glemt afslutning → åbent segment fra i går skal opdages ved næste
  åbning og tilbydes afsluttet (leder/korrektion kan rette).
- **Tid uden for normal arbejdstid** kan stadig ligge i et segment; rammen
  (man–tor 07:30–15:30, fre 07:30–15:00, weekend 0) bruges **kun** til
  "Indtastning mangler"-signalet — blokerer intet.

---

## "I gang"-status (arbejdsstatus, ikke stempelur)

Når medarbejderen er aktiv på en opgave, skal det være **visuelt tydeligt** at opgaven
kører — men det skal føles som **arbejdsstatus**, ikke et hårdt kontrol-stempelur.

- **Ingen** loadingbar/progressbar (en opgave har ikke kendt slutprocent).
- Brug: diskret **aktiv prik**/lille ur-ikon + tydelig tekst **"I gang nu"**.
- Løbende tid: **"Startet 08:52 · 0:38 i gang"**.
- Evt. **rolig farvet kant** (topkant/kant), ikke en accent-stripe.

## Kort dag / fravær (driftsstatus — ikke løn)

> **Låst formulering:** "SMU Tid skal kunne vise enkel dags-/tilstedeværelsesstatus,
> så kort dag, fravær eller aftaler ikke ligner manglende tidsregistrering. Statussen
> er driftsinformation og kollegaoverblik — ikke lønsystem."

SMU Tid skal kunne skelne **"indtastning mangler"** fra **"dagen er kortere/anderledes
med årsag"** (gået tidligt, læge/aftale, afspadsering, syg, fri, møde/ude af huset,
andet). Formål: ro i overblikket + vise kolleger/leder hvorfor nogen ikke er på arbejde.

**Ikke** løn, ferie-, sygdoms- eller afspadseringssaldo.

**Vurdering (denne runde):** kan **ikke** laves meningsfuldt uden DB. En status, der skal
**vises til kolleger/leder** (fx på /oversigt), skal ligge i delt lagring — localStorage
kun-lokalt opfylder ikke formålet. Derfor **ikke bygget nu**; dokumenteret som en lille
fremtidig DB-tilføjelse.

**Foreslået mindste datamodel (senere):** en `tid_dagsstatus`-tabel (eller kolonne):
`employee_id`, `dato`, `status` (enum: gaaet_tidligt / aftale / afspadsering / syg / fri
/ moede_ude / andet), valgfri `note`, `updated_at`/`updated_by`. Additiv, nullable,
fejler blødt. Ingen lønberegning, ingen saldo, ingen rapport.

## Aktiv opgave må redigeres af medarbejderen

Medarbejderen må **redigere den aktive opgaves indhold, mens den er aktiv**.

Det gælder:
- ordre / sag / kunde
- kategori
- underpunkt
- note
- evt. kort beskrivelse af hvad der arbejdes på

**Begrundelse:** Indtil SMU-numre og sag-opslag er modne, skal medarbejderen kunne
tilføje relevant viden løbende, fx kundenavn, ordrenummer eller intern reference.

**Vigtig skelnen:**
- **Aktiv opgave** = medarbejderen må beskrive og justere.
- **Lukket historiklinje** = normal medarbejderredigering er slut.
- **Historiske rettelser** er leder-/korrektionsflow.

Dette gør v2 fleksibel uden at gøre dagssedlen til manuel input igen.

---

## Produktbeslutning (låst formulering)

> "Medarbejderen må redigere den aktive opgaves beskrivelse, ordre/sag/kunde,
> kategori, underpunkt og note, mens opgaven er aktiv. Når opgaven lukkes og bliver
> til historik, er den ikke længere medarbejderens normale input. Historiske
> rettelser er leder-/korrektionsflow."

---

## Historisk læseadgang (præcisering)

Medarbejderen må gerne se egne dagssedler historisk som read-only. Begrænsningen
gælder **ændring** af historik, ikke **adgang til at læse** historik.

Konkret må medarbejderen i normalflow:
- vælge tidligere datoer og se sin historik for dagen,
- se interval, varighed, kategori, underpunkt, ordre/sag/kunde og pause,
- se en rolig opsummering for dagen.

Medarbejderen må **ikke** i normalflow redigere/slette historiske linjer, oprette
manuelle linjer, udfylde huller eller rette omgøring/bagudrettede fejl — det er
leder-/korrektionsflow. (WorkNow forbliver på "i dag"; kun historik-sektionen har
dato-navigation.)

## Kan v2 bygges uden migration?

**Ja — en minimal, testbar v2 kan bygges uden migration.** Med én kendt svaghed:

- `tid_time_entries` har alt et lukket segment kræver (start/slut/kategori/sag/note/
  is_break/varighed). **Ingen ændring nødvendig.**
- `tid_current_tasks` har **ikke** et `started_at`. Segmentets start kommer i dag fra
  **localStorage** (`currentTaskStart.ts`, pr. enhed) + fallback `current_tasks.updated_at`.

**Konsekvens:** virker fint på **samme enhed** (delt tablet); løbende tid + segment-luk
**på tværs af enheder** er ikke robust uden en starttid i DB.

**Anbefaling:** minimal test-build **uden migration**. Produktion-v2 tilføjer **én**
additiv, nullable kolonne `tid_current_tasks.started_at timestamptz` (lav risiko, fejler
blødt hvis ikke kørt).

---

## Hvad kan genbruges

- Storage-laget (`setCurrentTask`/`getCurrentTask`/`clearCurrentTask` + `addEntries`/`getEntriesForDate`).
- `buildEntries` + `lunch.ts` (pause/frokost), `time.ts` (afrunding/tid), `summary.ts`
  (`summarizeDay` + `expectedWorkMinutes`: fre 420 / man–tor 450 / weekend 0).
- `categories.ts` + `CategoryPicker`, `people.ts` (medarbejdervalg).
- `CurrentTaskCard` som kim til primærskærmen; `EntryRow` + `DaySummary` til historik.
- `/oversigt` (Admin + `CurrentTasksNow`) som ledelsesflade.
- Fra `parkering/mobil-ux-eksperiment` (cherry-pick): varighed pr. linje,
  `missingInputSegments`/`workdayWindow`, kompakt linjevisning, afslut-editor-kontekst.

---

## Hvad skal skjules/flyttes væk fra medarbejdervisningen

- "Ny manuel registrering" / "Udfyld dagsseddel" og "Udfyld her".
- `EntryEditor` som manuel-opret-værktøj.
- Rediger/Slet på **historiske** linjer, omgøring/redo, "sæt som aktuel opgave".

Medarbejderen ser kun: primær "nu"-skærm + læsbar historik. (Redigering af den
**aktive** opgave er tilladt — se afsnittet ovenfor.)

---

## Leder-/korrektionsflow — hvor

Ligger på **`/oversigt` (Admin)**, adskilt fra medarbejderskærmen: se hvem arbejder på
hvad nu, manglende tid, afvigelser; manuel oprettelse/redigering/sletning/udfyld
huller/omgøring (genbruger `EntryEditor`); senere rapport/eksport.

**Adgang:** roller findes ikke endnu (RLS = alle authenticated må redigere). Nu:
UI-adskilt (korrektion ikke linket fra medarbejderskærmen). Senere: ægte
adgangsstyring med roller.

---

## Komponenter der skal ændres

| Fil/komponent | Ny rolle |
|---|---|
| `src/main.tsx` | Routing: medarbejder-primærskærm = default; historik sekundær; `/oversigt` = ledelse. |
| **Ny: `WorkNow`** (fra `CurrentTaskCard`) | Primærskærm + tilstandsmaskine + redigering af aktiv opgave. |
| **Ny: `lib/currentSegment.ts`** | Ren logik: luk segment → `time_entry`, sæt næste tilstand; starttid. Unit-testbar. |
| `src/App.tsx` | Historik-/dagsvisning (read-only for medarbejder); manuel-knapper fjernes. |
| `EntryRow`, `DaySummary` | Historik-rendering (cherry-pick varighed + "Indtastning mangler"). |
| `EntryEditor` | Korrektions-kontekst (admin); beholder afslut/titel-props fra WIP. |
| `storage/*` (`currentTaskStart.ts` + adaptere) | Starttid; evt. `started_at`; helper "luk aktuel opgave til linje". |
| `lib/summary.ts` | `workdayWindow`/`missingInputSegments` til historik-signal. |
| `admin/*` | Korrektionsværktøjer samlet her. |

---

## Mindste sikre lokale build (test først)

1. Primærskærm `WorkNow`: **Start → Skift → Start pause → Tilbage → Slut dag** bygger
   rigtige `tid_time_entries`.
2. **Redigering af den aktive opgave** (ordre/sag/kunde, kategori, underpunkt, note)
   mens den er aktiv.
3. Starttid fra localStorage (fallback `updated_at`) — enheds-lokal begrænsning accepteret.
4. Historik-visning **read-only** under primærskærmen.
5. Medarbejderskærmen viser **ingen** manuel/rediger/slet af historik.
6. `/oversigt` **urørt**. tsc + tests + build grønt; test lokalt ~390 px.

**Udenfor dette build:** korrekt løbende tid på tværs af enheder (kræver migration),
rollebaseret adgang, rapport/eksport, auto-frokostsplit, redesign af /oversigt.

---

## Produktvalg der skal afklares før build

1. **Migration nu eller senere?** (minimal = ingen; produktion = `started_at`).
2. **Løbende tid:** tællende tid, eller kun "Startet 08:52"?
3. **Afrunding ved segment-luk:** eksakte tider, eller rund til 5/15 min?
4. **Frokost:** kun eksplicit "Start pause", eller bevar foreslået frokostsplit som hjælp?
5. **Skift opgave:** hurtigt "vælg ny opgave"-trin, eller genoptag forrige?
6. **Korrektionsadgang:** UI-adskilt nu (uden ægte låsning), eller vent på roller?
