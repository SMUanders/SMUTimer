import type { Plugin } from 'vite'

/**
 * Vite-plugin: giver hvert PRODUKTIONSBUILD et build-id og lægger det to steder, så de altid matcher:
 *  - compilet ind i bundlen som `__APP_VERSION__` (den kørende apps eget id)
 *  - som `version.json` direkte i build-outputtet (`dist/version.json` = det deployede id)
 *
 * Der skrives intet til `public/` og intet til repoet: filen findes kun i build-outputtet.
 * Under `vite dev` (og vitest) er id'et `dev`, og der laves ingen `version.json` — update-tjekket
 * er slået fra uden for produktion.
 *
 * Bevidst uden Node-imports, så filen kan type-tjekkes både af appens og vite.config's tsconfig.
 *
 *   // vite.config.ts
 *   import { platformUpdate } from './src/platform-update/vitePlatformUpdate'
 *   plugins: [react(), tailwindcss(), platformUpdate()]
 */
export function platformUpdate(): Plugin {
  const buildId = new Date().toISOString()
  let erBuild = false
  return {
    name: 'smu-platform-update',
    config(_, { command }) {
      erBuild = command === 'build'
      return { define: { __APP_VERSION__: JSON.stringify(erBuild ? buildId : 'dev') } }
    },
    generateBundle() {
      if (!erBuild) return
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildId }) + '\n',
      })
    },
  }
}
