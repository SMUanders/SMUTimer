import { useVersionCheck } from './useVersionCheck'

/** Den fælles tekst — samme i alle SMU-apps. */
export const NY_VERSION_TEKST = 'Ny version er klar'
export const OPDATER_TEKST = 'Opdater'

/**
 * Diskret, ikke-modal besked nederst, når en nyere version er deployet: "Ny version er klar – [Opdater]".
 * Siden genindlæses KUN, når brugeren klikker — aldrig automatisk, så intet input kasseres.
 *
 * `defer`: skjul beskeden midlertidigt (fx mens en registrering redigeres); den kommer igen, når
 * `defer` er false. Ligger under modaler (z-index 40), så en åben formular aldrig dækkes brat.
 * Et usynligt mellemrum i sideflowet (monteres sidst på siden) gør, at sidens nederste indhold — fx en
 * formulars Gem-knap — altid kan scrolles fri af beskeden.
 * Inline-styles med designsystemets tokens (som platform-nav), så modulet ikke afhænger af appens CSS;
 * knappen bruger den fælles `smu-btn-primary`.
 */
export function UpdateBanner({ defer = false }: { defer?: boolean }) {
  const nyVersion = useVersionCheck()
  if (!nyVersion || defer) return null

  return (
    <>
      <div aria-hidden style={{ height: 'calc(96px + env(safe-area-inset-bottom))' }} />
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 40,
          width: 'calc(100% - 32px)',
          maxWidth: 560,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--color-card, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: 14,
          boxShadow: '0 8px 24px rgba(33, 55, 70, 0.12)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-navy, #213746)' }}>{NY_VERSION_TEKST}</span>
        <button type="button" className="smu-btn-primary" onClick={() => window.location.reload()}>
          {OPDATER_TEKST}
        </button>
      </div>
    </>
  )
}
