/**
 * SMU Platform — miljøbevidst Supabase-session-storage (canonical, kopieres ind i hver app).
 *
 * - På platform-domænerne (smu.signmeup.dk / *.smu.signmeup.dk) gemmes sessionen i en cookie scoped
 *   til `.smu.signmeup.dk`, så alle SMU-apps deler samme login (SSO). SameSite=Lax, Secure.
 * - Overalt ellers (localhost, *.netlify.app, dev) bruges localStorage — dvs. UÆNDRET nuværende adfærd,
 *   så kode kan merges/deployes sikkert FØR DNS-cutover uden at røre de eksisterende miljøer.
 *
 * Cookien er browser-læsbar (ikke HttpOnly), fordi den browser-only Supabase-klient selv skal læse tokenet.
 * Ingen custom token-serialisering: vi gemmer præcis den streng Supabase leverer (kun chunk + URI-encode).
 */

const COOKIE_DOMAIN = '.smu.signmeup.dk'
const CHUNK = 3600 // hold hver cookie < 4KB
const MAX_AGE = 400 * 24 * 60 * 60 // ~400 dage; Supabase styrer selv token-udløb/refresh

export function erPlatformDomæne(host?: string): boolean {
  if (typeof window === 'undefined') return false
  const h = host ?? window.location.hostname
  return h === 'smu.signmeup.dk' || h.endsWith('.smu.signmeup.dk')
}

function læsCookie(navn: string): string | null {
  const præfiks = navn + '='
  const fundet = document.cookie.split('; ').find((c) => c.startsWith(præfiks))
  return fundet ? fundet.slice(præfiks.length) : null
}
function skrivCookie(navn: string, værdi: string): void {
  document.cookie = `${navn}=${værdi}; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`
}
function sletCookie(navn: string): void {
  document.cookie = `${navn}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`
}
function ryd(key: string): void {
  sletCookie(key)
  let i = 0
  while (læsCookie(`${key}.${i}`) !== null) { sletCookie(`${key}.${i}`); i++ }
}

/** Supabase-kompatibel storage der lever i en delt cookie på `.smu.signmeup.dk`. */
function cookieStorage(): Storage {
  return {
    getItem(key: string): string | null {
      // Chunked (key.0, key.1, …); fald tilbage til enkelt cookie hvis den findes.
      if (læsCookie(`${key}.0`) === null) {
        const enkelt = læsCookie(key)
        if (enkelt === null) return null
        try { return decodeURIComponent(enkelt) } catch { return enkelt }
      }
      let ud = ''
      let i = 0
      let del = læsCookie(`${key}.${i}`)
      while (del !== null) { ud += del; i++; del = læsCookie(`${key}.${i}`) }
      try { return decodeURIComponent(ud) } catch { return ud }
    },
    setItem(key: string, value: string): void {
      const enc = encodeURIComponent(value)
      ryd(key)
      const antal = Math.max(1, Math.ceil(enc.length / CHUNK))
      for (let i = 0; i < antal; i++) skrivCookie(`${key}.${i}`, enc.slice(i * CHUNK, (i + 1) * CHUNK))
    },
    removeItem(key: string): void {
      ryd(key)
    },
  } as unknown as Storage
}

/**
 * Returnér den storage Supabase-klienten skal bruge i det aktuelle miljø.
 * `undefined` (SSR/ingen window) → Supabase bruger sin egen default.
 */
export function platformAuthStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return erPlatformDomæne() ? cookieStorage() : window.localStorage
}
