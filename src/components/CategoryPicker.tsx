import { Pin, PinOff } from "lucide-react";
import { CATEGORIES, getCategory, defaultSubcategoryFor } from "../data/categories";

interface Props {
  categoryId: string;
  subcategoryId: string | null;
  onChange: (categoryId: string, subcategoryId: string | null) => void;
  /**
   * Personlige hurtigvalg: vis "Fastgør som hurtigvalg" / "Fjern fra hurtigvalg" for den valgte aktivitet.
   * Kun i medarbejderens egne start-/ret-formularer (ikke når en leder retter for andre).
   */
  hurtigvalg?: { fastgjort: boolean; fuld: boolean; onToggle: () => void };
}

// To dropdowns: hovedkategori + underpunkt. Alle medarbejdere ser alle
// kategorier (ingen filtrering i V1).
export default function CategoryPicker({ categoryId, subcategoryId, onChange, hurtigvalg }: Props) {
  const category = getCategory(categoryId);
  const subs = category?.subcategories ?? [];

  const vaelger = (
    <div className="row-2">
      <div className="field" style={{ margin: 0 }}>
        <label>Kategori</label>
        <select
          className="smu-input"
          value={categoryId}
          onChange={(e) => {
            // Forvalgt underpunkt (montage → Montering, ellers første) — kun et default.
            onChange(e.target.value, defaultSubcategoryFor(e.target.value));
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label>Underpunkt</label>
        <select
          className="smu-input"
          value={subcategoryId ?? ""}
          disabled={subs.length === 0}
          onChange={(e) => onChange(categoryId, e.target.value || null)}
        >
          {subs.length === 0 && <option value="">—</option>}
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
  if (!hurtigvalg) return vaelger;
  return (
    <>
      {vaelger}
      <button
        type="button"
        className={"smu-btn-ghost cp-fastgoer" + (hurtigvalg.fastgjort ? " is-fastgjort" : "")}
        onClick={hurtigvalg.onToggle}
        disabled={!hurtigvalg.fastgjort && hurtigvalg.fuld}
        aria-pressed={hurtigvalg.fastgjort}
      >
        {hurtigvalg.fastgjort ? (
          <>
            <PinOff size={14} /> Fjern fra hurtigvalg
          </>
        ) : hurtigvalg.fuld ? (
          <>
            <Pin size={14} /> Højst 8 hurtigvalg — fjern et først
          </>
        ) : (
          <>
            <Pin size={14} /> Fastgør som hurtigvalg
          </>
        )}
      </button>
    </>
  );
}
