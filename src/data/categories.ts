import type { Category, Subcategory } from "../types";

// Data-drevet kategori-træ. Alle medarbejdere ser ALLE kategorier og
// underpunkter (ingen medarbejderfiltrering i V1). Listen kan udvides frit
// her uden kodeændringer andre steder.
//
// Underpunkt-ID'er er globalt unikke (prefixet med kategori-slug), så de kan
// bruges direkte som primærnøgle i Postgres/Supabase.

// ID'er som logikken refererer direkte.
export const BREAK_CATEGORY_ID = "pause";
export const LUNCH_SUBCATEGORY_ID = "pause__frokost";

// Byg underpunkter med globalt unikke ID'er: "<kategori>__<slug>".
function subs(categoryId: string, items: [slug: string, name: string][]): Subcategory[] {
  return items.map(([slug, name]) => ({ id: `${categoryId}__${slug}`, name }));
}

export const CATEGORIES: Category[] = [
  {
    id: "tegnestue-grafik",
    name: "Tegnestue / grafik",
    subcategories: subs("tegnestue-grafik", [
      ["ny-tegning", "Ny tegning"],
      ["rettelser", "Rettelser"],
      ["klargoering", "Klargøring til print/skæring"],
      ["kundekorrektur", "Kundekorrektur"],
      ["filkontrol", "Filkontrol"],
      ["andet", "Andet"],
    ]),
  },
  {
    id: "print-og-skaer",
    name: "Print og skær",
    subcategories: subs("print-og-skaer", [
      ["print", "Print"],
      ["farvproeve", "Farveprøve"],
      ["maskinpleje", "Maskinpleje"],
      ["laminering", "Laminering"],
      ["skaer", "Skær"],
      ["tilskaer", "Tilskær"],
      ["applikering", "Applikering"],
      ["pak", "Pak"],
      ["komplet-klargoering", "Komplet klargøring"],
      ["pladeskaering-sav", "Pladeskæring / sav"],
    ]),
  },
  {
    id: "uproduktiv-tid",
    name: "Uproduktiv tid",
    subcategories: subs("uproduktiv-tid", [
      ["morgenmoede", "Morgenmøde"],
      ["oprydning", "Oprydning"],
      ["rengoering", "Rengøring"],
      ["lager", "Lager"],
      ["vedligehold", "Vedligehold"],
    ]),
  },
  {
    id: "montage-internt",
    name: "Montage internt",
    // Default-aktivitet = Montering (brugeren kan frit vælge Trucking/Vask/… bagefter).
    defaultSubcategoryId: "montage-internt__montering",
    subcategories: subs("montage-internt", [
      ["trucking", "Trucking"],
      ["vask-ekstra", "Vask (ekstra)"],
      ["montering", "Montering"],
      ["afmontering", "Afmontering"],
      ["opmaaling", "Opmåling"],
      ["andet", "Andet"],
    ]),
  },
  {
    id: "montage-ude",
    name: "Montage ude",
    // Default-aktivitet = Montering (brugeren kan frit vælge Kørsel/Vask/… bagefter).
    defaultSubcategoryId: "montage-ude__montering",
    subcategories: subs("montage-ude", [
      ["koersel", "Kørsel"],
      ["vask-ekstra", "Vask (ekstra)"],
      ["montering", "Montering"],
      ["afmontering", "Afmontering"],
      ["opmaaling", "Opmåling"],
      ["andet", "Andet"],
    ]),
  },
  {
    id: "salg-administration",
    name: "Salg / administration",
    subcategories: subs("salg-administration", [
      ["tilbud", "Tilbud"],
      ["kundedialog", "Kundedialog"],
      ["ordreoprettelse", "Ordreoprettelse"],
      ["fakturering", "Fakturering"],
      ["indkoeb", "Indkøb"],
      ["opmaaling", "Opmåling"],
      ["morgenmoede", "Morgenmøde"],
      ["andet", "Andet"],
    ]),
  },
  {
    id: BREAK_CATEGORY_ID,
    name: "Pause",
    isBreak: true,
    subcategories: subs("pause", [
      ["frokost", "Frokost"],
      ["pause", "Pause"],
      ["privat", "Privat"],
      ["andet", "Andet"],
    ]),
  },
  {
    id: "andet",
    name: "Andet",
    subcategories: subs("andet", [
      ["opmaaling", "Opmåling"],
      ["andet", "Andet"],
    ]),
  },
];

// Opslags-hjælpere.
const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category | undefined {
  return byId.get(id);
}

export function getSubcategory(categoryId: string, subId: string | null) {
  if (!subId) return undefined;
  return byId.get(categoryId)?.subcategories.find((s) => s.id === subId);
}

/**
 * Forvalgt underpunkt for en kategori: kategoriens eksplicitte `defaultSubcategoryId`
 * (fx Montering for montage), ellers første underpunkt. Kun et default — brugeren
 * kan altid vælge et andet.
 */
export function defaultSubcategoryFor(categoryId: string): string | null {
  const c = byId.get(categoryId);
  if (!c) return null;
  const explicit = c.defaultSubcategoryId;
  if (explicit && c.subcategories.some((s) => s.id === explicit)) return explicit;
  return c.subcategories[0]?.id ?? null;
}

export function isBreakCategory(categoryId: string): boolean {
  return byId.get(categoryId)?.isBreak === true;
}

// Omgøring-årsager (intern opfølgning). Vises kun når "Omgøring" er markeret.
export interface RedoReason {
  id: string;
  name: string;
}

export const REDO_REASONS: RedoReason[] = [
  { id: "produktionsfejl", name: "Produktionsfejl" },
  { id: "tegnestuefejl", name: "Tegnestuefejl" },
  { id: "maalefejl", name: "Målefejl" },
  { id: "monteringsfejl", name: "Monteringsfejl" },
  { id: "andet", name: "Andet" },
];

export function getRedoReason(id: string | null): RedoReason | undefined {
  if (!id) return undefined;
  return REDO_REASONS.find((r) => r.id === id);
}
