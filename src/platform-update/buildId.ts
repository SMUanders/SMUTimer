// Build-id — TEKNISK identitet for ét produktionsbuild. Bruges kun til at opdage, at en nyere
// frontend er deployet (og som tooltip til fejlsøgning). Det er IKKE produktversionen: den
// menneskelige version ("SMU Tid v2.2") kommer fra package.json via appens egen `lib/version.ts`.
// Sættes af `vitePlatformUpdate.ts`; `dev` uden for et produktionsbuild.
declare const __APP_VERSION__: string

// `typeof` på et udeklareret navn kaster ikke — fallback til `dev` i fx et rent test-miljø.
export const APP_BUILD_ID: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/** Er der deployet et andet build end det, der kører? Ren (testbar). */
export function erNytBuild(deployet: unknown, koerende: string): boolean {
  return typeof deployet === 'string' && deployet !== '' && koerende !== 'dev' && deployet !== koerende
}

/**
 * Ligner fejlen et lazy chunk, der ikke længere findes, fordi en nyere version er deployet?
 * Browserne formulerer det forskelligt (Chromium, Firefox, Safari). Ren (testbar).
 */
export function erChunkFejl(fejl: unknown): boolean {
  const besked = fejl instanceof Error ? fejl.message : typeof fejl === 'string' ? fejl : ''
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    besked,
  )
}

/** Kort, læsbart build-id til tooltip: "2026-10-20 14:05" (lokal tid). Ren (testbar). */
export function formatBuildId(id: string): string {
  const d = new Date(id)
  if (Number.isNaN(d.getTime())) return id
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Den kørende apps build-id i kort form (tooltip/fejlsøgning). */
export function appBuildIdShort(): string {
  return formatBuildId(APP_BUILD_ID)
}
