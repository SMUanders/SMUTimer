import { Component, type ReactNode } from 'react'
import { erChunkFejl } from './buildId'
import { RECOVERY_EVENT } from './useVersionCheck'
import { NY_VERSION_TEKST, OPDATER_TEKST } from './UpdateBanner'

type Tilstand = { fejl: unknown; recovery: boolean }

/**
 * Recovery efter et deploy: når en gammel fane ikke længere kan hente et lazy chunk
 * (`vite:preloadError` eller en chunk-fejl under rendering), erstattes HELE appen af ét centralt
 * kort "Ny version er klar – [Opdater]". Header/navigation forsvinder bevidst — én sikker
 * recovery-skærm frem for navigation i en inkonsistent gammel bundle. Banneret skjules samtidig
 * (via `RECOVERY_EVENT`), så brugeren kun ser kortet. Alle andre fejl kastes uændret videre.
 * Placeres om hele appen (fx i main.tsx). Genindlæser kun ved klik.
 */
export class PlatformUpdateBoundary extends Component<{ children: ReactNode }, Tilstand> {
  state: Tilstand = { fejl: null, recovery: false }

  static getDerivedStateFromError(fejl: unknown): Partial<Tilstand> {
    return erChunkFejl(fejl) ? { recovery: true } : { fejl }
  }

  private vedPreloadFejl = () => this.setState({ recovery: true })

  componentDidMount() {
    window.addEventListener('vite:preloadError', this.vedPreloadFejl)
  }

  componentWillUnmount() {
    window.removeEventListener('vite:preloadError', this.vedPreloadFejl)
  }

  componentDidUpdate(_: unknown, foer: Tilstand) {
    if (this.state.recovery && !foer.recovery) window.dispatchEvent(new Event(RECOVERY_EVENT))
  }

  render() {
    if (this.state.recovery) {
      return (
        <div role="alert" style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 16 }}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              justifyItems: 'center',
              maxWidth: 420,
              padding: '20px 24px',
              textAlign: 'center',
              background: 'var(--color-card, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: 14,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-navy, #213746)' }}>{NY_VERSION_TEKST}</span>
            <button type="button" className="smu-btn-primary" onClick={() => window.location.reload()}>
              {OPDATER_TEKST}
            </button>
          </div>
        </div>
      )
    }
    if (this.state.fejl !== null) throw this.state.fejl
    return this.props.children
  }
}
