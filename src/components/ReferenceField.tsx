import { useState } from "react";
import {
  INTERN_CODES,
  referenceKind,
  smuNumberPart,
  type ReferenceKind,
} from "../lib/smuNumber";

interface Props {
  /** Rå/normaliseret værdi (gemmes i kolonnen customer/order_number). */
  value: string;
  onChange: (value: string) => void;
}

const FREE = "__FRI__";

// "SMU-nummer / intern kode" — valgfrit felt i beta. Ingen SMU OS-opslag endnu.
// Erstatter det gamle "Kunde/Ordre"-felt. Normaliseres endeligt ved gem.
export default function ReferenceField({ value, onChange }: Props) {
  const [kind, setKind] = useState<ReferenceKind>(referenceKind(value));

  const internMatch = INTERN_CODES.includes(value.trim().toUpperCase() as never);
  const [free, setFree] = useState<boolean>(
    kind === "intern" && value.trim() !== "" && !internMatch
  );

  function switchKind(next: ReferenceKind) {
    if (next === kind) return;
    setKind(next);
    setFree(false);
    // Skift felttype rydder værdien hvis den ikke passer til den nye type.
    if (referenceKind(value) !== next) onChange("");
  }

  return (
    <div className="field ref-field">
      <label>SMU-nummer / intern kode</label>

      <div className="ref-kinds" role="tablist">
        <button
          type="button"
          className={`ref-kind ${kind === "smu" ? "active" : ""}`}
          aria-pressed={kind === "smu"}
          onClick={() => switchKind("smu")}
        >
          SMU-sag
        </button>
        <button
          type="button"
          className={`ref-kind ${kind === "intern" ? "active" : ""}`}
          aria-pressed={kind === "intern"}
          onClick={() => switchKind("intern")}
        >
          Intern kode
        </button>
      </div>

      {kind === "smu" ? (
        <div className="ref-smu">
          <span className="ref-prefix">SMU-</span>
          <input
            className="smu-input ref-smu-input"
            type="text"
            inputMode="numeric"
            placeholder="fx 184"
            value={smuNumberPart(value)}
            onChange={(e) => {
              const digits = e.target.value;
              onChange(digits.trim() === "" ? "" : `SMU-${digits}`);
            }}
          />
        </div>
      ) : (
        <>
          <select
            className="smu-input"
            value={free ? FREE : internMatch ? value.trim().toUpperCase() : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === FREE) {
                setFree(true);
                onChange("");
              } else {
                setFree(false);
                onChange(val);
              }
            }}
          >
            <option value="">Vælg intern kode…</option>
            {INTERN_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={FREE}>Andet (fri kode)…</option>
          </select>
          {free && (
            <input
              className="smu-input"
              type="text"
              placeholder="fx INTERN-PROJEKT"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ marginTop: 8 }}
            />
          )}
        </>
      )}

      <div className="ref-hint">Valgfrit i beta.</div>
    </div>
  );
}
