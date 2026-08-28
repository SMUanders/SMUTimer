import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AppIcon } from './AppIcon'
import { HUB_APP, type AppMeta } from './platformApps'
import { useAllowedApps } from './useAllowedApps'

/**
 * SMU Platform — diskret app-skifter til apps' eksisterende topbar (canonical, kopieres ind).
 * Version-agnostisk: kun React-hooks, ingen react-router, ingen ekstra ikon-dependency (inline SVG),
 * cross-app-navigation via almindelig <a href>. Framework-agnostiske inline-styles (platform-chrome).
 *
 * Viser Hub + kun de LIVE apps brugeren har aktiv app_adgange til. `currentAppKey` markerer den
 * aktuelle app. Apps uden adgang og apps "på vej" hører hjemme i Hub — ikke i den daglige skifter.
 * Navigation sker med almindelige links, så brugeren selv kan vælge ny fane (fx cmd/ctrl-klik) og
 * have flere SMU-apps åbne samtidig.
 */
export function AppSwitcher({
  supabase,
  currentAppKey,
}: {
  supabase: SupabaseClient
  currentAppKey?: string
}) {
  const { apps } = useAllowedApps(supabase)
  const [åben, setÅben] = useState(false)
  const boks = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!åben) return
    function udenfor(e: MouseEvent) {
      if (boks.current && !boks.current.contains(e.target as Node)) setÅben(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setÅben(false) }
    document.addEventListener('mousedown', udenfor)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', udenfor)
      document.removeEventListener('keydown', esc)
    }
  }, [åben])

  // Hub først, derefter brugerens live-apps. Apps uden verificeret URL kan ikke linkes.
  const liste: AppMeta[] = [HUB_APP, ...apps].filter((a) => a.url)

  return (
    <div ref={boks} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setÅben((v) => !v)}
        aria-label="Skift app"
        aria-expanded={åben}
        title="Skift app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 8,
          border: 'none',
          background: åben ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: '#b8c8d1',
          cursor: 'pointer',
        }}
      >
        {/* inline 3×3-gitter (ingen ikon-dependency) */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="3" r="1.6" /><circle cx="9" cy="3" r="1.6" /><circle cx="15" cy="3" r="1.6" />
          <circle cx="3" cy="9" r="1.6" /><circle cx="9" cy="9" r="1.6" /><circle cx="15" cy="9" r="1.6" />
          <circle cx="3" cy="15" r="1.6" /><circle cx="9" cy="15" r="1.6" /><circle cx="15" cy="15" r="1.6" />
        </svg>
      </button>

      {åben && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            width: 264,
            maxWidth: '90vw',
            background: '#ffffff',
            border: '1px solid #e4e0d8',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(33,55,70,0.16)',
            padding: 8,
            zIndex: 60,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#78909c',
              margin: '4px 8px 6px',
            }}
          >
            Skift app
          </p>
          {liste.map((app) => {
            const aktuel = app.key === currentAppKey
            return (
              <a
                key={app.key}
                href={app.url ?? undefined}
                role="menuitem"
                aria-current={aktuel ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  background: aktuel ? '#eef2f3' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!aktuel) e.currentTarget.style.background = '#f9f7f3' }}
                onMouseLeave={(e) => { if (!aktuel) e.currentTarget.style.background = 'transparent' }}
              >
                <AppIcon icon={app.icon} size={34} alt="" />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#213746' }}>
                    {app.displayName}
                    {aktuel && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#78909c', marginLeft: 6 }}>
                        (aktuel)
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78909c' }}>
                    {app.description}
                  </span>
                </span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
