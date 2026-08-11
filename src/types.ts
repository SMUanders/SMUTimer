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
  /** Fri tekst, kan være tom. */
  customer: string;
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

/** Data brugeren indtaster i editoren (før split/udregning). */
export interface EntryDraft {
  startTime: string;
  endTime: string;
  categoryId: string;
  subcategoryId: string | null;
  customer: string;
  note: string;
  isRedo: boolean;
  redoReason: string | null;
  redoNote: string;
}
