import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Kort manual i appen (Anders, 10. nov. 2026) — samme form som SMU Pladslistens hjælp: få trin med skærmbilleder.
 * Billederne ligger i public/hjaelp/ og er taget i lokal udviklingstilstand med demodata (intet medarbejdernavn).
 * Ændres skærmene, skal billederne tages om.
 */
export default function Hjaelp() {
  return (
    <div className="app hj">
      <div className="hj-top">
        <a href="/" className="hj-tilbage" aria-label="Tilbage til Min dag">
          <ArrowLeft size={22} />
        </a>
        <h1 className="hj-titel">Sådan bruger du SMU Tid</h1>
      </div>

      <p className="hj-tekst">
        Registrér din tid, mens du arbejder. Start en opgave, når du går i gang, og afslut den, når du er færdig.
      </p>

      <Trin nr={1} titel="Start en opgave" billeder={[["1-hvad-nu.png", "Hvad nu? med Start opgave, dine hurtigvalg og forslag"]]}>
        Tryk <b>Start opgave</b>, vælg aktiviteten og evt. SMU-sagen, og tryk <b>Start opgave</b>. Dine hurtigvalg står lige
        under: et hurtigvalg åbner <b>Start opgave</b> med aktiviteten valgt, så du kun skal vælge sagen. Trucking, Uproduktiv
        tid og Pause starter med det samme. Under <b>Forslag</b> står det, du ofte bruger.
      </Trin>

      <Trin nr={2} titel="Fastgør dine hurtigvalg" billeder={[["2-fastgoer.png", "Start opgave med Fastgør som hurtigvalg under aktiviteten"]]}>
        Tryk <b>Start opgave</b>, vælg aktiviteten, og tryk <b>Fastgør som hurtigvalg</b>. Tryk <b>Annuller</b>, hvis du
        ikke vil starte den nu. Samme sted fjerner du den igen med <b>Fjern fra hurtigvalg</b>.
      </Trin>

      <Trin nr={3} titel="Trucking: vælg enhederne" billeder={[["3-enheder.png", "Aktiv Trucking med valgte enheder og listen over enheder på pladsen"]]}>
        Tryk <b>Vælg enheder</b>, mens du arbejder eller ved afslutningen. Søg på SMU-nr., reg.nr. eller stelnummer, og tryk på
        enhederne. <b>Vælg alle</b> tager hele sagen; <b>×</b> fjerner en. Listen viser kun enheder, der står på pladsen.
      </Trin>

      <Trin nr={4} titel="Afslut" billeder={[["4-afslut.png", "Afslut opgave med tider og minutter pr. enhed"]]}>
        Tryk <b>Gå til afslutning</b>, ret tiderne hvis de ikke passer, og tryk <b>Gem afsluttet opgave</b>. Ved Trucking deles
        tiden ligeligt mellem enhederne — din arbejdstid tælles kun én gang.
      </Trin>

      <section className="smu-card hj-fejl">
        <h2 className="hj-h2">Fejl?</h2>
        <p className="hj-tekst">
          Tryk på registreringen under <b>Min dag</b> for at rette tider, aktivitet, enheder eller note — eller tryk <b>Slet</b>.
        </p>
        <Billeder billeder={[["5-min-dag.png", "Min dag med en registrering, man kan trykke på"]]} />
      </section>

      <p className="hj-note">Billederne er fra et testmiljø med opdigtede data.</p>
    </div>
  );
}

function Trin({ nr, titel, billeder, children }: { nr: number; titel: string; billeder: [string, string][]; children: ReactNode }) {
  return (
    <section className="hj-trin">
      <h2 className="hj-h2">
        <span className="hj-nr">{nr}</span>
        {titel}
      </h2>
      <p className="hj-tekst">{children}</p>
      <Billeder billeder={billeder} />
    </section>
  );
}

function Billeder({ billeder }: { billeder: [string, string][] }) {
  return (
    <div className="hj-billeder">
      {billeder.map(([fil, alt]) => (
        <img key={fil} src={`/hjaelp/${fil}`} alt={alt} loading="lazy" className="hj-billede" />
      ))}
    </div>
  );
}
