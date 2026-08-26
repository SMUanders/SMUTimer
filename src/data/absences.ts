// Fraværstyper — centralt defineret (ingen spredte hardcodede labels).
// Rækkefølgen styrer dropdown-rækkefølgen. id gemmes i tid_absences.absence_type.
//
// DATAMINIMERING: SMU Tid er et DRIFTSværktøj, ikke HR/løn. Vi gemmer IKKE konkrete
// private årsager (læge/tandlæge/jordemoder/behandlinger) som faste kategorier. Kun
// generiske typer. Ønsker medarbejderen selv at skrive fx "tandlæge", kan det stå i
// det VALGFRIE note-felt — systemet kræver/foreslår ikke private årsager.

export interface AbsenceType {
  id: string;
  name: string;
}

export const ABSENCE_TYPES: AbsenceType[] = [
  { id: "syg", name: "Syg" },
  { id: "afspadsering", name: "Afspadsering" },
  { id: "fri", name: "Fri" },
  { id: "andet", name: "Andet fravær" },
];

export function getAbsenceType(id: string | null): AbsenceType | undefined {
  if (!id) return undefined;
  return ABSENCE_TYPES.find((t) => t.id === id);
}

// Ukendte/udfasede ids (fx gamle testrækker med "laege-tandlaege"/"jordemoder")
// vises generisk som "Fravær" — aldrig den rå id/private label. Ingen crash, ingen
// DB-migration nødvendig; note-feltet er stadig fri tekst.
export function absenceTypeName(id: string | null): string {
  return getAbsenceType(id)?.name ?? "Fravær";
}
