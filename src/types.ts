// Domænetyper for SMU Tid.

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  /** true for Pause-kategorien — pause tælles aldrig som arbejdstid. */
  isBreak?: boolean;
  /** Forvalgt underpunkt når kategorien vælges (ellers bruges første underpunkt). */
  defaultSubcategoryId?: string;
  subcategories: Subcategory[];
}

export interface TimeEntry {
  id: string;
  /** Hvilken medarbejder registreringen tilhører. */
  employeeId: string;
  /** YYYY-MM-DD */
  workDate: string;
  /** HH:MM (24t) */
  startTime: string;
  /** HH:MM (24t) */
  endTime: string;
  /** Udregnet ved gem. */
  durationMinutes: number;
  categoryId: string;
  subcategoryId: string | null;
  /** Fri tekst, kan være tom. Fritekst-reference til ordre/sag/kunde. */
  customer: string;
  /** Stabil reference til en SMU OS-sag (sager.id). null = ikke-sagsbundet arbejde. */
  sagId: string | null;
  /** Display-snapshot af sagens SMU-nummer (så historik er læsbar uden OS-adgang). */
  sagSmuNummer: string | null;
  /** Fri tekst, kan være lang. */
  note: string;
  /** true for auto-oprettede frokostlinjer (Pause). */
  isBreak: boolean;
  /** "Omgøring" som tilvalg på linjen (kun intern opfølgning i V1). */
  isRedo: boolean;
  /** Årsag til omgøring — kun sat når isRedo. */
  redoReason: string | null;
  /** Note til omgøring — kun sat når isRedo. */
  redoNote: string;
  /** Samler de dele der stammer fra ét frokost-split. */
  splitGroupId: string | null;
  /** Soft-delete: markeret slettet i stedet for fjernet fysisk. */
  slettet: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * "Aktuel opgave" — ren status pr. medarbejder ("hvad arbejder de på lige nu").
 * IKKE tidsregistrering: tæller aldrig som arbejdstid og påvirker ingen tal.
 */
export interface CurrentTask {
  employeeId: string;
  categoryId: string;
  subcategoryId: string | null;
  orderNumber: string | null;
  /** Stabil reference til en valgt SMU OS-sag (sager.id), hvis nogen. */
  sagId: string | null;
  /** Display-snapshot af sagens SMU-nummer. */
  sagSmuNummer: string | null;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * "Fravær i arbejdsdagen" — drifts-/tilstedeværelsesstatus (IKKE løn/ferie/saldo).
 * Delt via egen tabel (tid_absences), så kolleger/leder kan se den. Tæller ALDRIG
 * som arbejdstid eller pause; skaber ikke "hul" i det dækkede tidsrum.
 *
 * ÉN autoritativ tilstand: AKTIVT fravær = `ended === null` (ude nu). Der er intet
 * separat `active`-felt (undgår dobbeltstatus). Forventet og faktisk retur er
 * BEVIDST to felter — vi vil vise "forventet tilbage 11:30" mens hun er væk, og
 * bagefter kende det faktiske fravær 09:30–11:18.
 */
export interface Absence {
  id: string;
  employeeId: string;
  /** YYYY-MM-DD */
  workDate: string;
  /** HH:MM — fra-tid (fraværet starter). */
  startTime: string;
  /** HH:MM — FORVENTET tilbage. null = ukendt ("tilbage senere"). */
  expectedEnd: string | null;
  /** HH:MM — FAKTISK retur. null = stadig ude = AKTIVT fravær. */
  ended: string | null;
  /** id fra ABSENCE_TYPES (src/data/absences.ts). */
  absenceType: string;
  note: string;
  slettet: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Data brugeren indtaster i editoren (før split/udregning). */
export interface EntryDraft {
  startTime: string;
  endTime: string;
  categoryId: string;
  subcategoryId: string | null;
  customer: string;
  /** Stabil SMU-sag-reference, hvis valgt (round-trippes ved leder-korrektion). */
  sagId: string | null;
  sagSmuNummer: string | null;
  note: string;
  isRedo: boolean;
  redoReason: string | null;
  redoNote: string;
}
