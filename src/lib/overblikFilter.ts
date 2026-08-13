// Visnings-filter til /oversigt: hvilke medarbejdere skjules i dag-/ugeoverblik.
// KUN visning — data hentes uændret. Gemmes lokalt i browseren.

const KEY = "smu-tid.overblik.skjulte";

/** Sæt af SKJULTE medarbejder-id'er (så nye medarbejdere er synlige som udgangspunkt). */
export function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveHidden(hidden: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...hidden]));
}
