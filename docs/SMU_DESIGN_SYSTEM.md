# SMU_DESIGN_SYSTEM.md — designsystem for alle SMU-apps

**Kanonisk kilde.** Dette dokument beskriver SMU-designuniverset. Den reelle implementering lever i [`src/index.css`](../src/index.css) i `smu-os-v2` — hvis der er tvivl, vinder `index.css`. Værdier her skal holdes i sync med den fil.

Formålet er, at Wiki, Tid, APV og alle andre SMU-apps ser ud som **samme system**. Kopiér `@theme`-blokken og hjælpeklasserne fra `src/index.css` ind i en ny app, og følg reglerne nedenfor.

Palette-versionen kaldes **"Maj 2026" — varm beige base**. (Font skiftede fra Barlow til Plus Jakarta Sans 4. maj 2026.)

---

## 1. Farver

Alle farver er CSS-variabler i `@theme` i `src/index.css`. Brug variablerne / hjælpeklasserne — **skriv aldrig rå hex i komponenter**.

### Base og flader

| Rolle | Variabel | Hex |
|---|---|---|
| Baggrund (varm beige) | `--color-bg` | `#f4f2ed` |
| Række-baggrund (hover/zebra) | `--color-row-bg` | `#f9f7f3` |
| Kort | `--color-card` | `#ffffff` |
| Border | `--color-border` | `#e4e0d8` |
| Border blød | `--color-border-soft` | `#f0ede7` |

### Navy (struktur)

| Rolle | Variabel | Hex |
|---|---|---|
| Navy (topbar) | `--color-navy` | `#213746` |
| Navy blød (sag-header) | `--color-navy-soft` | `#2f4758` |
| Tekst på navy | `--color-text-on-navy` | `#b8c8d1` |
| Tekst på navy, dæmpet | `--color-text-on-navy-muted` | `#7fa8bc` |

### Tekst

| Rolle | Variabel | Hex |
|---|---|---|
| Tekst | `--color-text` | `#213746` |
| Tekst dæmpet | `--color-text-muted` | `#78909c` |

### Accent + semantik

Hver accentfarve har en `-soft` (baggrund) og `-deep` (tekst/hover) variant.

| Rolle | Base | Soft | Deep |
|---|---|---|---|
| **Primær blå** (accent) | `#3f9ed3` | `#e9f6fb` | `#2384b8` |
| **Teal** (ok/positiv) | `#159b86` | `#e9f8f4` | `#13806f` |
| **Orange** (advarsel) | `#ef9f27` | `#fff2d9` | `#9a6a00` |
| **Grå** (neutral) | — | `#eef2f3` | `#667983` |
| **Rød** (kun fejl) | — | `#fde7e7` | `#b53b3b` |
| **Violet** (kategori) | — | `#efe9fb` | `#6b3aa3` |

**Semantisk regel:** grøn/teal = ok · amber/orange = advarsel · **rød KUN til fejl**. Brug aldrig rød til "slet"-knapper som ikke er destruktive-farlige, og aldrig som dekoration.

### Gamle aliases (bevar — brug ikke i ny kode)

`--color-smu-blue`, `--color-smu-navy`, `--color-smu-teal`, `--color-smu-lightblue`, `--color-smu-bluegray`, `--color-smu-bg` er bevaret så ældre komponenter ikke knækker. **Ny kode bruger de nye variabler ovenfor.**

---

## 2. Typografi

- **Skrifttype:** `Plus Jakarta Sans`, importeret fra Google Fonts i `index.css`. Fallback: `system-ui, sans-serif`.
- **Kun vægte 600 / 700 / 800.** Body er 600.

| Vægt | Bruges til |
|---|---|
| **800** | Tal, SMU-numre, kolonneoverskrifter, primære labels, badges, primær-knap |
| **700** | Sekundær-knap, ghost-knap |
| **600** | Brødtekst, inputs |

**Aldrig font-weight under 600 på noget synligt.** Ingen 400 på vigtige elementer.

---

## 3. Hjælpeklasser

Defineret i `src/index.css`. Brug dem frem for at gentage Tailwind-klynger eller hex-værdier.

### Kort — `.smu-card`
Radius 14px, border `#e4e0d8`, shadow `0 8px 24px rgba(33,55,70,0.06)`, hvid baggrund.

### Badges — `.smu-badge` + farve-modifier
Pill-form (radius 999px), font-weight 800, 11px. Varianter:
`.smu-badge-blue` · `.smu-badge-green` · `.smu-badge-orange` · `.smu-badge-grey` · `.smu-badge-red` · `.smu-badge-violet`

### Knapper
- **`.smu-btn-primary`** — blå `#3f9ed3`, hvid tekst, radius 10px, vægt 800. Hover: `brightness(0.95)`. Disabled: `opacity 0.55`.
- **`.smu-btn-secondary`** — hvid med border, radius 8px, vægt 700. Hover: beige baggrund.
- **`.smu-btn-ghost`** — transparent, blå tekst, vægt 700, 12px.

### Input — `.smu-input`
Hvid, border `#e4e0d8`, radius 8px, vægt 600. Fokus: border skifter til `#3f9ed3` (ingen outline).

---

## 4. Layout-regler

- **Page-shell:** `max-width: 1280px`, centreret, varm beige baggrund.
- **Border-radius:** minimum 8px på interaktive elementer, 14px på kort. **Aldrig under 8px på kort.**
- **Topbar:** navy `#213746`. Sag-/kontekst-header: navy blød `#2f4758`.
- **Klikbare referencefelter** linker konsekvent til deres destination: sagsnummer → sag, kundenavn → kunde, brandnavn → brand. Gælder alle lister, detaljesider og overblik.

---

## 5. Ufravigelige regler ("aldrig bryd")

1. **Ingen gradients.**
2. **Ingen emojis** — brug Lucide React-ikoner.
3. **Ingen accent-striber / tilfældige understregninger / tilfældige farver.**
4. **Ingen border-radius under 8px på kort.**
5. **Ingen font-weight under 600 på synlige labels.**
6. **Rød kun til fejl.**
7. **Rå hex i komponenter er forbudt** — brug CSS-variabler / hjælpeklasser.
8. **Login, tomme states og fejlskærme skal føles som SMU** — ikke default-browser-look.

---

## 6. `@theme`-blok (reference)

Dette er kilden. Ved ny app: kopiér denne blok fra `src/index.css` (ikke herfra — filen er autoritativ), så farve-tokens er identiske på tværs af apps.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
@import "tailwindcss";

@theme {
  --color-bg:           #f4f2ed;
  --color-row-bg:       #f9f7f3;
  --color-card:         #ffffff;
  --color-border:       #e4e0d8;
  --color-border-soft:  #f0ede7;
  --color-navy:         #213746;
  --color-navy-soft:    #2f4758;
  --color-text:         #213746;
  --color-text-muted:   #78909c;
  --color-text-on-navy: #b8c8d1;
  --color-text-on-navy-muted: #7fa8bc;
  --color-primary:      #3f9ed3;
  --color-primary-soft: #e9f6fb;
  --color-primary-deep: #2384b8;
  --color-teal:         #159b86;
  --color-teal-soft:    #e9f8f4;
  --color-teal-deep:    #13806f;
  --color-orange:       #ef9f27;
  --color-orange-soft:  #fff2d9;
  --color-orange-deep:  #9a6a00;
  --color-grey-soft:    #eef2f3;
  --color-grey-deep:    #667983;

  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

---

*Domænespecifik designdokumentation for SMU OS' kalkulationsdel findes i [`DESIGNKATALOG.md`](../DESIGNKATALOG.md) — det er beslutningsgrundlag for kalkulation, ikke det visuelle designsystem.*
