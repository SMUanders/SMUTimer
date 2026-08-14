// Cirka-starttidspunkt for "Aktuel opgave" (hjælpe-stempelur / kladde).
//
// Bevidst KUN i localStorage pr. enhed — ikke i databasen. Det er en hjælp til at
// huske hvornår man cirka startede, ikke en autoritativ registrering. Ingen
// migration. Selve aktuel opgave-statussen (kategori/ordre/note) ligger fortsat i
// tid_current_tasks. Starttidspunktet bruges kun til at forudfylde start i
// "Afslut og registrér tid" — brugeren kan altid rette det før gem.

const KEY = "smu-tid.current-task-start.v1";

type StartMap = Record<string, string>; // employeeId -> ISO-tidsstempel

function load(): StartMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as StartMap;
  } catch {
    return {};
  }
}

function save(map: StartMap): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** ISO-tidsstempel for hvornår aktuel opgave blev startet, eller null. */
export function getTaskStart(employeeId: string): string | null {
  return load()[employeeId] ?? null;
}

export function setTaskStart(employeeId: string, iso: string): void {
  const map = load();
  map[employeeId] = iso;
  save(map);
}

export function clearTaskStart(employeeId: string): void {
  const map = load();
  delete map[employeeId];
  save(map);
}

/** Lokal "HH:MM" fra et ISO-tidsstempel (til visning/forudfyldning). */
export function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
