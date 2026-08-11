# SMU mini-app-principper (fast standard)

Disse principper gælder SMU Tid og **alle nye SMU mini-apps**. En SMU-app er ikke
en løs prototype — den er ejet kode, der skal kunne leve i SMU OS.

## Design
- Brug **samme SMU-designunivers** overalt — også på login, fejlskærme og tomme
  states (ikke kun på "hovedskærmen").
- SMU-palette:
  - Navy/mørk blå `#1d384d` — primær (knapper, brand-accent, overskrifter)
  - Blå `#2e9bd4` — sekundær accent/links
  - Lys blå `#b7d4e5` — bløde flader
  - Grøn `#006140` — ok/udfyldt
  - Gul/amber — advarsel / mangler / omgøring
  - **Rød kun** til fejl, sletning og kritisk
  - Hvid/rolige lyse baggrunde
- Ingen tilfældige farver, ingen generiske framework-/Supabase-templates.
- Samme knapstil, felt-stil og kort-stil på tværs af skærme.
- Dansk UI-tekst.

## Platform
- **Supabase** som backend (Postgres + Auth), samme retning som SMU Wiki / SMU OS.
- **Login/auth** samme retning: Supabase Auth, én delt klient (auth + data deler
  session), login-gate når appen skal deles. Ingen roller før det er nødvendigt.
- **RLS** skal være stram (kun authenticated) før bredere deling — aldrig åben
  `using(true)` i produktion.
- Miljøvariabler via `VITE_*`; hemmeligheder aldrig i git (`.env.local` ignoreres).

## Kode
- Bygges som **ejet kode**, struktureret så den kan **integreres i SMU OS senere**
  (klar adskillelse af domænelogik, storage bag et interface, delt auth/klient).
- tsc + tests + build skal være grønne før commit.

## Login/empty/error som en del af familien
- Login-siden skal føles som SMU OS (navy brand-accent, "SMU OS"-mærkning, rolige
  farver) — ikke en standard login-template.
- Tomme states og fejlskærme bruger samme sprog, farver og komponentstil som resten.
