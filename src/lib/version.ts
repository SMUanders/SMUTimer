// To ADSKILTE begreber:
//  - PRODUKTVERSION (menneskelig, "v2.1") — SSOT = package.json "version", indlejret
//    som __APP_PRODUCT_VERSION__. Vises diskret i UI.
//  - BUILD-ID (teknisk, bygnings-tidsstempel) — hører IKKE hjemme her. Det kommer
//    fra det fælles modul `src/platform-update/` og bruges kun til update-detektion
//    og som tooltip (`appBuildIdShort`).
// Fallback hvis konstanterne ikke er defineret (fx et rent test-miljø).
export const APP_PRODUCT_VERSION: string =
  typeof __APP_PRODUCT_VERSION__ !== "undefined" ? __APP_PRODUCT_VERSION__ : "dev";

/** Formatér en semver-streng til diskret label: "2.1.0" → "v2.1". Ren (testbar). */
export function formatProductVersion(v: string): string {
  const m = /^(\d+)\.(\d+)/.exec(v);
  return m ? `v${m[1]}.${m[2]}` : v;
}

/** Menneskelig produktversion til diskret UI-label: "v2.1" (major.minor). */
export function appProductVersion(): string {
  return formatProductVersion(APP_PRODUCT_VERSION);
}
