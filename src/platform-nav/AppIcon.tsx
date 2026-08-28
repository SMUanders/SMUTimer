/**
 * SMU Platform — app-ikon (canonical). Viser appens OFFICIELLE ikon kant-til-kant med rounded clip.
 * App-favicons er allerede fuld-bleed navy kvadrater, så der lægges INGEN ekstra navy tile/padding
 * udenom (det var årsagen til at fx Tid-uret så forkert ud). Ingen nyopfundet grafik.
 */
export function AppIcon({ icon, size = 44, alt = '' }: { icon: string; size?: number; alt?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        overflow: 'hidden',
        background: '#213746', // navy — kun synlig bag evt. transparente ikon-dele
        flexShrink: 0,
      }}
    >
      <img
        src={icon}
        alt={alt}
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </span>
  )
}
