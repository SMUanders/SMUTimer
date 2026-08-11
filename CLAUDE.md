# SMU Tid — satellit-app i SMU/Signmeup-universet

**SMU Tid** (digital dagsseddel) er en lille, fokuseret app i SMU-familien. Den
**deler Supabase-projekt, auth og designunivers** med resten. Navet og den
kanoniske kilde er **`smu-os-v2`**.

- **Standard:** følg `SMU_APP_STANDARD.md` (kopi i roden) — stack, backend, auth,
  sikkerhed, deploy, arbejdsmåde.
- **Design:** følg `docs/SMU_DESIGN_SYSTEM.md` (kopi i repoet). Kilde til farver,
  typografi og hjælpeklasser. Ved tvivl vinder `smu-os-v2/src/index.css`.
- **Tabel-prefix:** denne app bruger prefikset **`tid_`** i det delte Supabase-
  projekt. `profiler` + `auth.users` deles på tværs af apps — læs dem, opret dem
  ikke igen.

## Ved reskin / design-arbejde — LÆS FØRST
Når opgaven handler om styling, layout, farver, komponenter eller "få det til at
ligne SMU":
1. **Læs `docs/SMU_DESIGN_SYSTEM.md` FØR du ændrer styling.** Ufravigeligt.
2. Brug CSS-variabler + hjælpeklasser (`.smu-card`, `.smu-badge*`, `.smu-btn-*`,
   `.smu-input`) — **aldrig rå hex i komponenter**.
3. Hold `@theme`-blokken i `src/index.css` identisk med `smu-os-v2`.
4. "Aldrig bryd": ingen gradients, ingen emojis (Lucide-ikoner), rød kun til fejl,
   font-weight ≥ 600 synligt, border-radius ≥ 8px (14px på kort).
5. Login, tomme states og fejlskærme skal føles som SMU.

## Kendte afvigelser fra standarden (ryd op når der er tid)
Dokumenteret jf. standardens krav om at notere afvigelser:

- **Tabelnavne ikke prefikset endnu:** appen bruger `employees` og `time_entries`
  (fra før prefiks-reglen). Bør migreres til `tid_time_entries` m.fl. `employees`
  er appens egen medarbejder-liste (til vælgeren) — overvej at bruge den **delte
  `profiler`** i stedet, så personer ikke dubleres på tværs af apps.
- **Stack-version:** React 18 + Vite 5 (standarden/`smu-os-v2` er på React 19 +
  Vite 8). Fungerer; kan opgraderes ved lejlighed.
- **Ingen soft-deletes endnu:** sletning er hard delete. Standarden foreskriver
  `slettet: boolean` + append-only aktivitetslog. Har dog `created_by`/`updated_by`.
- **Ingen roller** (bevidst V1) — alle indloggede ser/redigerer alt.

## Domæne-noter (SMU Tid-specifikt)
- Frokost-split: man–tor 12:00–12:30, fre 10:00–10:30, weekend intet. Pause tælles
  ikke som arbejdstid. Ren logik i `src/lib/lunch.ts` (unit-testet).
- Overlap blokeres (`src/lib/validation.ts`). Forventet arbejdsdag 7,5 t (weekend 0).
- Storage bag interface: `src/lib/storage/` (localAdapter dev-fallback +
  supabaseAdapter). Én delt klient `src/lib/supabaseClient.ts`.
- Routing: simpel sti-switch i `main.tsx` (`/oversigt` = admin). Deep-link
  `?medarbejder=<id>&dato=<YYYY-MM-DD>`.

## Kommandoer
`npm run dev` · `npm test` · `npm run build`. Kør tsc/tests/build efter ændringer;
skriv hvad der er ændret + hvad der skal testes manuelt. Alt på dansk.
