import { useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { store } from "../lib/storage";
import type { SagRef } from "../lib/storage/types";

// "SMU-nr. / sag" — typeahead mod eksisterende SMU OS-sager via OS-ejet read-contract.
// Fritekst bevares: skriver man uden at vælge en sag, gemmes teksten som fri reference
// (sagId = null). Vælger man en sag, gemmes en STABIL reference (sagId + smu-nummer-
// snapshot), og fritekstfeltet viser SMU-nummeret. Ingen OS-adgang kræves; ingen lokal
// sagskopi. Samme model kan senere fodres af QR (resolve → samme valgte-sag).

interface Props {
  label?: string;
  customer: string;
  sagId: string | null;
  sagSmuNummer: string | null;
  onChange: (next: { customer: string; sagId: string | null; sagSmuNummer: string | null }) => void;
}

export default function SagPicker({ label = "SMU-nr. / sag / kunde", customer, sagId, onChange }: Props) {
  const [results, setResults] = useState<SagRef[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced søgning: kun når feltet har fokus, mindst 2 tegn, og ingen sag er valgt.
  useEffect(() => {
    const q = customer.trim();
    if (!focused || sagId || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(async () => {
      const rows = await store().searchSager(q);
      setResults(rows);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [customer, sagId, focused]);

  // Luk dropdown ved klik udenfor.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function selectSag(s: SagRef) {
    // Gem stabil reference + vis SMU-nummeret i fritekstfeltet (display-kontinuitet).
    onChange({ customer: s.smuNummer, sagId: s.sagId, sagSmuNummer: s.smuNummer });
    setOpen(false);
    setResults([]);
  }

  function clearSag() {
    onChange({ customer: "", sagId: null, sagSmuNummer: null });
  }

  return (
    <div className="field sag-picker" ref={boxRef}>
      <label>{label}</label>
      <div className="sag-input-wrap">
        {sagId ? <Check className="sag-ic sag-ic-ok" size={16} /> : <Search className="sag-ic" size={15} />}
        <input
          className="smu-input sag-input"
          type="text"
          placeholder="Fx SMU-0123, kundenavn eller fri reference"
          value={customer}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) =>
            // Manuel redigering = fri reference: ryd en evt. valgt sag-binding.
            onChange({ customer: e.target.value, sagId: null, sagSmuNummer: null })
          }
        />
        {sagId && (
          <button type="button" className="sag-clear" onClick={clearSag} aria-label="Ryd valgt sag">
            <X size={15} />
          </button>
        )}
      </div>

      {sagId ? (
        <div className="sag-hint sag-hint-ok">Valgt SMU-sag — reference gemmes stabilt.</div>
      ) : (
        <div className="sag-hint">Vælg en SMU-sag fra listen, eller skriv en fri reference.</div>
      )}

      {open && (results.length > 0 || loading) && (
        <div className="sag-results">
          {loading && <div className="sag-result sag-muted">Søger…</div>}
          {!loading &&
            results.map((s) => (
              <button
                type="button"
                key={s.sagId}
                className="sag-result"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSag(s)}
              >
                <span className="sag-result-top">
                  <strong>{s.smuNummer}</strong> · {s.kundeNavn}
                </span>
                <span className="sag-result-titel">{s.titel}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
