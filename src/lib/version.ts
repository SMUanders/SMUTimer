// To ADSKILTE begreber:
//  - PRODUKTVERSION (menneskelig, "v2.1") — SSOT = package.json "version", indlejret
//    som __APP_PRODUCT_VERSION__. Vises diskret i UI.
//  - BUILD-ID (teknisk, bygnings-tidsstempel) — __APP_VERSION__. Bruges til
//    update-detektion (version.json) og teknisk fejlsøgning (tooltip).
// Fallback hvis konstanterne ikke er defineret (fx et rent test-miljø).
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const APP_PRODUCT_VERSION: string =
  typeof __APP_PRODUCT_VERSION__ !== "undefined" ? __APP_PRODUCT_VERSION__ : "dev";

/** Kort, læsbart build-id til teknisk visning/tooltip: "YYYY-MM-DD HH:MM". */
export function appVersionShort(): string {
  const d = new Date(APP_VERSION);
  if (Number.isNaN(d.getTime())) return APP_VERSION;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formatér en semver-streng til diskret label: "2.1.0" → "v2.1". Ren (testbar). */
export function formatProductVersion(v: string): string {
  const m = /^(\d+)\.(\d+)/.exec(v);
  return m ? `v${m[1]}.${m[2]}` : v;
}

/** Menneskelig produktversion til diskret UI-label: "v2.1" (major.minor). */
export function appProductVersion(): string {
  return formatProductVersion(APP_PRODUCT_VERSION);
}
