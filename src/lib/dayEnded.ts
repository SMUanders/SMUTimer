// "Slut arbejdsdag" — neutral, LOKAL dagsstatus (localStorage, pr. enhed).
// Ingen DB: markerer blot at medarbejderen er færdig for i dag, så "HVAD NU?"
// ikke bliver ved med at bede om en handling. Reel dags-/fraværsstatus (delt,
// synlig for leder) kræver DB og bygges ikke i denne runde.

const KEY = "smu-tid.day-ended.v1";

type Map = Record<string, boolean>; // "<employeeId>|<dato>" -> true

function load(): Map {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Map;
  } catch {
    return {};
  }
}
function save(m: Map): void {
  localStorage.setItem(KEY, JSON.stringify(m));
}
function key(employeeId: string, date: string): string {
  return `${employeeId}|${date}`;
}

export function isDayEnded(employeeId: string, date: string): boolean {
  return !!load()[key(employeeId, date)];
}

export function setDayEnded(employeeId: string, date: string, ended: boolean): void {
  const m = load();
  if (ended) m[key(employeeId, date)] = true;
  else delete m[key(employeeId, date)];
  save(m);
}
