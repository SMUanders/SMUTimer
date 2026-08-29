import { CATEGORIES, getCategory, defaultSubcategoryFor } from "../data/categories";

interface Props {
  categoryId: string;
  subcategoryId: string | null;
  onChange: (categoryId: string, subcategoryId: string | null) => void;
}

// To dropdowns: hovedkategori + underpunkt. Alle medarbejdere ser alle
// kategorier (ingen filtrering i V1).
export default function CategoryPicker({ categoryId, subcategoryId, onChange }: Props) {
  const category = getCategory(categoryId);
  const subs = category?.subcategories ?? [];

  return (
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
}
