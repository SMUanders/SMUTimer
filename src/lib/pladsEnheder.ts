// Trucking V1 — enheder på pladsen (ren logik: søgning, gruppering, snapshot). Ingen datahentning.
//
// Listen kommer fra Pladsliste-ejet læsekontrakt public.pladsliste_tid_enheder_paa_pladsen
// (kun OS-enheder med et aktivt ophold — Pladsliste er autoritativ for "på pladsen nu").
// Pladsen er lille, så hele listen hentes én gang, og søgningen sker her — øjeblikkeligt mens
// der tastes. Samme normalisering som kontrakten: store bogstaver, uden mellemrum og bindestreg.

import type { FordeltEnhed } from "../types";
import type { PladsEnhed } from "./storage/types";
import { enhedVisning } from "./enhed";

export function normaliser(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * Én søgning: SMU-nummer, reg.nr., stelnummer, internt nr., trailer-nr., beskrivelse — og "#3"
 * for løbenummer. Flere ord skal alle passe (fx "0043 #2"). Tom søgning = hele listen.
 */
export function filtrerPladsEnheder(rows: PladsEnhed[], q: string): PladsEnhed[] {
  const ord = q.trim().split(/\s+/).filter(Boolean);
  if (ord.length === 0) return rows;
  return rows.filter((r) =>
    ord.every((o) => {
      const loeb = /^#(\d+)$/.exec(o);
      if (loeb) return r.loebenummer === Number(loeb[1]);
      const n = normaliser(o);
      if (!n) return true;
      return [r.smuNummer, r.regNr, r.stelnummer, r.interntNr, r.trailerNr, r.beskrivelse].some((f) =>
        normaliser(f).includes(n)
      );
    })
  );
}

export interface SagGruppe {
  sagId: string;
  smuNummer: string;
  sagTitel: string | null;
  kunde: string | null;
  enheder: PladsEnhed[];
}

/** Gruppér pr. SMU-sag (bevarer rækkefølgen fra listen; enheder efter løbenummer). */
export function grupperPaaSag(rows: PladsEnhed[]): SagGruppe[] {
  const m = new Map<string, SagGruppe>();
  for (const r of rows) {
    let g = m.get(r.sagId);
    if (!g) {
      g = { sagId: r.sagId, smuNummer: r.smuNummer, sagTitel: r.sagTitel, kunde: r.kunde, enheder: [] };
      m.set(r.sagId, g);
    }
    g.enheder.push(r);
  }
  for (const g of m.values()) g.enheder.sort((a, b) => a.loebenummer - b.loebenummer);
  return [...m.values()];
}

/** Snapshot, der gemmes på registreringen — bevarer historikken, når enheden forlader pladsen. */
export function tilFordeltEnhed(r: PladsEnhed): FordeltEnhed {
  return { enhedId: r.enhedId, sagId: r.sagId, sagSmuNummer: r.smuNummer, visning: enhedVisning(r) };
}

/** Etiket til chips og tidslinje: "SMU-0043L #2 · AD8204". */
export function kortEtiket(e: FordeltEnhed): string {
  return [e.sagSmuNummer, e.visning].filter(Boolean).join(" ");
}
