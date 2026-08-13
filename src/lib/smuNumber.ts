// "SMU-nummer / intern kode" — feltlogik for SMU Tid.
//
// V1: INGEN SMU OS-integration og INGEN opslag i sagstabeller. Dette er kun
// bedre feltstruktur, normalisering og datakvalitet. Feltet er VALGFRIT i beta.
//
// To typer værdier deler samme tekstfelt (kolonnen `customer` / `order_number`
// i databasen — bevaret som den er, ingen migration):
//   A) SMU-sag     → normaliseres til fx "SMU-0184"
//   B) Intern kode → fx "INTERN-LAGER" (bruges til intern tid)

export type ReferenceKind = "smu" | "intern";

/** Foreslåede interne koder (må aldrig hedde "SMU"). */
export const INTERN_CODES = [
  "INTERN-LAGER",
  "INTERN-MASKIN",
  "INTERN-OPRYDNING",
  "INTERN-ADMIN",
  "INTERN-SMUOS",
  "INTERN-ANDET",
] as const;

/**
 * Normaliser en reference til konsekvent lagring/visning.
 * - Tomt felt forbliver tomt (valgfrit i beta).
 * - Et SMU-nummer (evt. med "SMU"-prefix/bindestreg, evt. kun cifre) →
 *   "SMU-" + nul-polstret til mindst 4 cifre, fx "184" → "SMU-0184".
 * - En intern kode ("INTERN-…") uppercases og får bindestreger.
 * - Alt andet (fri kode) bevares som indtastet (kun trimmet).
 */
export function normalizeReference(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  // SMU-nummer: valgfrit "SMU"-prefix + valgfri bindestreg + kun cifre.
  const compact = raw.replace(/\s+/g, "");
  const m = compact.match(/^(?:smu)?-?(\d+)$/i);
  if (m) {
    return "SMU-" + String(parseInt(m[1], 10)).padStart(4, "0");
  }

  // Intern kode.
  if (raw.toUpperCase().startsWith("INTERN")) {
    return raw.toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
  }

  // Fri kode — bevares som indtastet.
  return raw;
}

/** Afgør hvilken felttype en (normaliseret) værdi hører til. Tom = SMU (default). */
export function referenceKind(value: string): ReferenceKind {
  return (value ?? "").trim().toUpperCase().startsWith("INTERN") ? "intern" : "smu";
}

/** Tal-delen af et SMU-nummer til visning i input'et bag "SMU-"-prefikset. */
export function smuNumberPart(value: string): string {
  return (value ?? "").trim().replace(/^smu-?/i, "");
}
