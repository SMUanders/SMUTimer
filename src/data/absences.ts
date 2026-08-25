// Fraværstyper — centralt defineret (ingen spredte hardcodede labels).
// Rækkefølgen styrer dropdown-rækkefølgen. id gemmes i tid_absences.absence_type.

export interface AbsenceType {
  id: string;
  name: string;
}

export const ABSENCE_TYPES: AbsenceType[] = [
  { id: "laege-tandlaege", name: "Læge / tandlæge" },
  { id: "jordemoder", name: "Jordemoder" },
  { id: "afspadsering", name: "Afspadsering" },
  { id: "gaaet-tidligt", name: "Gået tidligt" },
  { id: "syg", name: "Syg" },
  { id: "fri", name: "Fri" },
  { id: "andet", name: "Andet" },
];

export function getAbsenceType(id: string | null): AbsenceType | undefined {
  if (!id) return undefined;
  return ABSENCE_TYPES.find((t) => t.id === id);
}

export function absenceTypeName(id: string | null): string {
  return getAbsenceType(id)?.name ?? id ?? "Fravær";
}
