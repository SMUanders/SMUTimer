import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { store } from "../lib/storage";
import type { PladsEnhed } from "../lib/storage/types";
import type { FordeltEnhed } from "../types";
import { filtrerPladsEnheder, grupperPaaSag, kortEtiket, tilFordeltEnhed } from "../lib/pladsEnheder";
import { fjernEnhed, fordeling, tilfoejEnheder } from "../lib/fordeling";

// Trucking V1 — vælg de enheder, tiden fordeles på. Ét søgefelt (SMU-nummer, reg.nr., stelnummer,
// internt nr., trailer-nr., beskrivelse, "#3"). Resultaterne er KUN enheder, der står på pladsen nu
// (Pladsliste-ejet læsekontrakt). Flere enheder, på tværs af SMU-numre; "Vælg alle" pr. sag.
// Valgte enheder vises som chips og bevares, selv om enheden senere forlader pladsen (snapshot).

interface Props {
  valgte: FordeltEnhed[];
  onChange: (next: FordeltEnhed[]) => void;
  /** Registreringens varighed i minutter — viser fordelingen pr. enhed. */
  minutter?: number | null;
  /** Søgelisten åben fra start (fx når man trykker "Vælg enheder"). */
  startAaben?: boolean;
}

export default function EnhedsVaelger({ valgte, onChange, minutter = null, startAaben = false }: Props) {
  const [plads, setPlads] = useState<PladsEnhed[] | null>(null);
  const [q, setQ] = useState("");
  const [aaben, setAaben] = useState(startAaben);

  useEffect(() => {
    if (!aaben || plads) return;
    let aktiv = true;
    store()
      .getEnhederPaaPladsen()
      .then((rows) => aktiv && setPlads(rows));
    return () => {
      aktiv = false;
    };
  }, [aaben, plads]);

  const grupper = useMemo(() => grupperPaaSag(filtrerPladsEnheder(plads ?? [], q)), [plads, q]);
  const valgtSet = new Set(valgte.map((e) => e.enhedId));
  const minPr = minutter && minutter > 0 && valgte.length ? fordeling(minutter, valgte) : null;

  function toggle(r: PladsEnhed) {
    onChange(valgtSet.has(r.enhedId) ? fjernEnhed(valgte, r.enhedId) : tilfoejEnheder(valgte, [tilFordeltEnhed(r)]));
  }

  return (
    <div className="field ev">
      <label>Enheder {valgte.length > 0 && <span className="ev-antal">{valgte.length}</span>}</label>

      {valgte.length > 0 ? (
        <div className="ev-chips">
          {valgte.map((e, i) => (
            <span key={e.enhedId} className="ev-chip">
              <span className="ev-chip-txt">{kortEtiket(e)}</span>
              {minPr && <span className="ev-chip-min">{minPr[i].minutter} min</span>}
              <button
                type="button"
                className="ev-chip-x"
                onClick={() => onChange(fjernEnhed(valgte, e.enhedId))}
                aria-label={`Fjern ${kortEtiket(e)}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="sag-hint">Valgfrit — uden enheder registreres det som Trucking uden fordeling.</div>
      )}

      {!aaben ? (
        <button type="button" className="smu-btn-secondary ev-aabn" onClick={() => setAaben(true)}>
          <Plus size={15} /> {valgte.length ? "Tilføj eller fjern enheder" : "Vælg enheder"}
        </button>
      ) : (
        <div className="ev-panel">
          <div className="sag-input-wrap">
            <Search className="sag-ic" size={15} />
            <input
              className="smu-input sag-input"
              type="search"
              inputMode="search"
              placeholder="SMU-nr., reg.nr., stelnr. eller #nr."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus={startAaben}
            />
            {q && (
              <button type="button" className="sag-clear" onClick={() => setQ("")} aria-label="Ryd søgning">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="ev-liste" role="list">
            {plads === null ? (
              <div className="ev-tom">Henter enheder på pladsen…</div>
            ) : plads.length === 0 ? (
              <div className="ev-tom">Der står ingen registrerede enheder på pladsen lige nu.</div>
            ) : grupper.length === 0 ? (
              <div className="ev-tom">Ingen enheder på pladsen matcher “{q.trim()}”.</div>
            ) : (
              grupper.map((g) => {
                const alleValgt = g.enheder.every((r) => valgtSet.has(r.enhedId));
                return (
                  <div key={g.sagId} className="ev-gruppe" role="listitem">
                    <div className="ev-gruppe-top">
                      <div className="ev-gruppe-navn">
                        <strong>{g.smuNummer}</strong>
                        {(g.kunde || g.sagTitel) && <span> · {[g.kunde, g.sagTitel].filter(Boolean).join(" · ")}</span>}
                      </div>
                      {g.enheder.length > 1 && (
                        <button
                          type="button"
                          className="smu-btn-ghost ev-alle"
                          onClick={() =>
                            onChange(
                              alleValgt
                                ? valgte.filter((e) => !g.enheder.some((r) => r.enhedId === e.enhedId))
                                : tilfoejEnheder(valgte, g.enheder.map(tilFordeltEnhed))
                            )
                          }
                        >
                          {alleValgt ? "Fravælg alle" : `Vælg alle ${g.enheder.length}`}
                        </button>
                      )}
                    </div>
                    {g.enheder.map((r) => {
                      const valgt = valgtSet.has(r.enhedId);
                      return (
                        <button
                          type="button"
                          key={r.enhedId}
                          className={"ev-enhed" + (valgt ? " is-valgt" : "")}
                          aria-pressed={valgt}
                          onClick={() => toggle(r)}
                        >
                          <span className="ev-check">{valgt && <Check size={14} />}</span>
                          <span className="ev-enhed-txt">{tilFordeltEnhed(r).visning}</span>
                          {r.zone && <span className="smu-badge smu-badge-grey ev-zone">{r.zone}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div className="ev-fod">
            <button type="button" className="smu-btn-secondary" onClick={() => setAaben(false)}>
              Luk listen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
