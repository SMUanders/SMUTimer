// Overblikkets adresse (vedligeholdelsespakke 2): fane, dato (Dag), uge (Uge) og valgt sag (Sag) står i adressen,
//   /oversigt?fane=uge&uge=2026-11-09   ·   /oversigt?dato=2026-11-10   ·   /oversigt?fane=sag&sag=<uuid>&smu=SMU-0123
// så F5 og browserens tilbage fra en medarbejders dag lander samme sted. Appen har ingen router: adressen skrives med
// history.replaceState (ingen ekstra historik pr. klik). Standard (ingen parametre) = fanen Dag, i dag — som før.
// Den seneste Overblik-adresse huskes også i fanens sessionStorage, så "Overblik"-knappen i en medarbejders dag
// går tilbage til samme sted. Kun en bekvemmelighed — aldrig data.
import { sagFraUrl, type SagDeeplink } from "./sagDeeplink";

export type OverblikFane = "dag" | "uge" | "sag";

export interface OverblikTilstand {
  fane: OverblikFane;
  /** Dag-fanens dato (null = i dag). */
  dato: string | null;
  /** Uge-fanens ankerdato (null = denne uge). */
  uge: string | null;
  sag: SagDeeplink | null;
}

/** En gyldig kalenderdato "ÅÅÅÅ-MM-DD", ellers null. */
export function gyldigDato(v: string | null | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (y < 2000 || y > 2100) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : null;
}

/** Læser adressen. Et sag-deeplink uden fane (fra SMU OS) åbner fanen Sag — som før. */
export function tolkOverblik(search: string): OverblikTilstand {
  const p = new URLSearchParams(search);
  const sag = sagFraUrl(search);
  const f = p.get("fane");
  const fane: OverblikFane = f === "dag" || f === "uge" || f === "sag" ? f : sag ? "sag" : "dag";
  return { fane, dato: gyldigDato(p.get("dato")), uge: gyldigDato(p.get("uge")), sag };
}

/** Bygger søgestrengen; standardværdierne (Dag, i dag, denne uge) udelades. */
export function overblikSoegning(t: OverblikTilstand, idag: string): string {
  const p = new URLSearchParams();
  if (t.fane !== "dag") p.set("fane", t.fane);
  if (t.dato && t.dato !== idag) p.set("dato", t.dato);
  if (t.uge && t.uge !== idag) p.set("uge", t.uge);
  if (t.sag) {
    p.set("sag", t.sag.sagId);
    if (t.sag.smuNummer) p.set("smu", t.sag.smuNummer);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const NOEGLE = "smu-tid.overblik-adresse";

/** Kun Overblikkets egen adresse accepteres; alt andet bliver "/oversigt". */
export function gyldigOverblikAdresse(v: string | null | undefined): string {
  return typeof v === "string" && (v === "/oversigt" || v.startsWith("/oversigt?")) ? v : "/oversigt";
}

/** Skriver adressen (uden ny historik) og husker den i fanen. */
export function skrivOverblikAdresse(t: OverblikTilstand, idag: string): void {
  const adresse = `/oversigt${overblikSoegning(t, idag)}`;
  try {
    if (window.location.pathname + window.location.search !== adresse) window.history.replaceState(window.history.state, "", adresse);
  } catch {
    /* ignoreres */
  }
  try {
    sessionStorage.setItem(NOEGLE, adresse);
  } catch {
    /* privat vindue o.l. */
  }
}

/** Overblik-adressen, som "Overblik"-knappen i en medarbejders dag skal gå til. */
export function overblikAdresse(): string {
  try {
    return gyldigOverblikAdresse(sessionStorage.getItem(NOEGLE));
  } catch {
    return "/oversigt";
  }
}
