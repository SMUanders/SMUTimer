import { Component, type ReactNode } from 'react'
import { erChunkFejl } from './buildId'
import { NY_VERSION_TEKST, OPDATER_TEKST } from './UpdateBanner'

/**
 * Fanger KUN den fejl, en gammel fane får, når et lazy chunk ikke længere findes efter et deploy,
 * og viser samme update-flow i stedet for en tom side. Alle andre fejl kastes uændret videre.
 * Placeres om appens indhold (fx i main.tsx). Genindlæser kun ved klik.
 */
export class PlatformUpdateBoundary extends Component<{ children: ReactNode }, { fejl: unknown }> {
  state: { fejl: unknown } = { fejl: null }

  static getDerivedStateFromError(fejl: unknown) {
    return { fejl }
  }

  render() {
    const { fejl } = this.state
    if (fejl === null) return this.props.children
    if (!erChunkFejl(fejl)) throw fejl

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
}
