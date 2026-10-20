import { describe, expect, it } from 'vitest'
import { erChunkFejl, erNytBuild, formatBuildId } from '../platform-update/buildId'
import { PlatformUpdateBoundary } from '../platform-update/PlatformUpdateBoundary'

// Rene regler i det fælles platform-update-modul (canonical: smu-hub/src/platform-update/).
describe('erNytBuild — er der deployet et andet build end det, der kører?', () => {
  it('samme id → nej', () => expect(erNytBuild('2026-10-20T10:00:00.000Z', '2026-10-20T10:00:00.000Z')).toBe(false))
  it('andet id → ja', () => expect(erNytBuild('2026-10-20T11:00:00.000Z', '2026-10-20T10:00:00.000Z')).toBe(true))
  it('kørende dev-build tjekkes aldrig', () => expect(erNytBuild('2026-10-20T11:00:00.000Z', 'dev')).toBe(false))
  it('manglende/ugyldig version.json → nej', () => {
    expect(erNytBuild(undefined, '2026-10-20T10:00:00.000Z')).toBe(false)
    expect(erNytBuild('', '2026-10-20T10:00:00.000Z')).toBe(false)
    expect(erNytBuild(42, '2026-10-20T10:00:00.000Z')).toBe(false)
  })
})

describe('erChunkFejl — gammel fane, slettet lazy chunk', () => {
  it('Chromium', () => expect(erChunkFejl(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true))
  it('Safari', () => expect(erChunkFejl(new TypeError('Importing a module script failed.'))).toBe(true))
  it('Firefox', () => expect(erChunkFejl(new TypeError('error loading dynamically imported module'))).toBe(true))
  it('CSS-preload', () => expect(erChunkFejl(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true))
  it('almindelig fejl → nej (kastes videre)', () => {
    expect(erChunkFejl(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(erChunkFejl(null)).toBe(false)
  })
})

describe('formatBuildId', () => {
  it('ugyldigt id returneres uændret', () => expect(formatBuildId('dev')).toBe('dev'))
  it('ISO → "YYYY-MM-DD HH:MM"', () => expect(formatBuildId('2026-10-20T10:05:00.000Z')).toMatch(/^2026-10-20 \d{2}:05$/))
})

describe('PlatformUpdateBoundary — recovery ved lazy-/chunk-fejl, andre fejl kastes videre', () => {
  const medFejl = (fejl: unknown) => {
    const b = new PlatformUpdateBoundary({ children: 'app' })
    // Som React: den delvise tilstand flettes ind i den eksisterende.
    b.state = { ...b.state, ...PlatformUpdateBoundary.getDerivedStateFromError(fejl) }
    return b
  }
  it('ingen fejl → børnene vises uændret', () => {
    expect(new PlatformUpdateBoundary({ children: 'app' }).render()).toBe('app')
  })
  it('chunk-fejl → update-kort med "Opdater" (ikke tom side)', () => {
    const el = medFejl(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')).render() as {
      props: { role: string }
    }
    expect(el.props.role).toBe('alert')
  })
  it('vite:preloadError (recovery-tilstand) → kun recovery-kortet', () => {
    const b = new PlatformUpdateBoundary({ children: 'app' })
    b.state = { fejl: null, recovery: true }
    expect((b.render() as { props: { role: string } }).props.role).toBe('alert')
  })
  it('anden fejl → kastes videre uændret', () => {
    const fejl = new Error('noget helt andet')
    expect(() => medFejl(fejl).render()).toThrow(fejl)
  })
})
