import { useEffect, useRef, useState } from "react";
import { store } from "../lib/storage";
import type { SagEnhed } from "../lib/storage/types";
import { enhedVisning, erMontageKategori, standardEnhed } from "../lib/enhed";

// "Enhed" — vælg den konkrete enhed på den valgte SMU-sag (TR-088). Vises KUN når der er
// valgt en rigtig sag med aktive enheder. Ét valg pr. registrering; arbejde på flere/alle
// enheder = "Hele sagen" (sagsniveau). Aldrig obligatorisk. Enhederne læses via OS-ejet
// read-contract (tid_sag_enheder) — ingen OS-adgang, ingen lokal kopi.

interface Props {
  sagId: string | null;
  categoryId: string;
  enhedId: string | null;
  enhedVisning: string | null;
  onChange: (next: { enhedId: string | null; enhedVisning: string | null }) => void;
}

export default function EnhedPicker({ sagId, categoryId, enhedId, enhedVisning: snapshot, onChange }: Props) {
  const [enheder, setEnheder] = useState<SagEnhed[]>([]);
  const [hentetFor, setHentetFor] = useState<string | null>(null);
  // Har brugeren selv valgt på denne sag? Så ændrer standardreglen intet.
  const roert = useRef(false);
  // Den enhed, systemet selv forvalgte (så den kan fjernes igen ved skift væk fra montage).
  const autoValgt = useRef<string | null>(null);
  // Sagen formularen ÅBNEDE med (ret eksisterende registrering/opgave). Standardreglen gælder
  // KUN for en sag valgt i denne formular — en eksisterende registrering omskrives aldrig
  // automatisk med en enhed (TR-088: ingen kunstig præcision, ingen backfill).
  const aabnetMedSag = useRef(sagId);

  useEffect(() => {
    roert.current = sagId !== null && sagId === aabnetMedSag.current;
    autoValgt.current = null;
    setEnheder([]);
    setHentetFor(null);
    if (!sagId) return;
    let aktiv = true;
    store()
      .getSagEnheder(sagId)
      .then((rows) => {
        if (!aktiv) return;
        setEnheder(rows);
        setHentetFor(sagId);
      });
    return () => {
      aktiv = false;
    };
  }, [sagId]);

  // Godkendt standardregel: montage + præcis én aktiv enhed → forvælg. Ellers sagsniveau.
  useEffect(() => {
    if (!sagId || hentetFor !== sagId || roert.current) return;
    const std = standardEnhed(categoryId, enheder);
    if (std && !enhedId) {
      autoValgt.current = std.enhedId;
      onChange({ enhedId: std.enhedId, enhedVisning: enhedVisning(std) });
    } else if (!erMontageKategori(categoryId) && enhedId && enhedId === autoValgt.current) {
      autoValgt.current = null; // kategori skiftet væk fra montage → tilbage til sagsniveau
      onChange({ enhedId: null, enhedVisning: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sagId, hentetFor, categoryId, enheder]);

  if (!sagId || hentetFor !== sagId || enheder.length === 0) return null;

  // En tidligere valgt enhed, der siden er soft-slettet, skal stadig kunne vises.
  const ukendt = enhedId && !enheder.some((e) => e.enhedId === enhedId);
  const opfordring = erMontageKategori(categoryId) && !enhedId && enheder.length > 1;

  return (
    <div className="field">
      <label>Enhed</label>
      <select
        className="smu-input"
        value={enhedId ?? ""}
        onChange={(e) => {
          roert.current = true;
          const valgt = enheder.find((x) => x.enhedId === e.target.value) ?? null;
          onChange(valgt ? { enhedId: valgt.enhedId, enhedVisning: enhedVisning(valgt) } : { enhedId: null, enhedVisning: null });
        }}
      >
        <option value="">Hele sagen (flere/alle enheder)</option>
        {enheder.map((e) => (
          <option key={e.enhedId} value={e.enhedId}>
            {enhedVisning(e)}
          </option>
        ))}
        {ukendt && <option value={enhedId!}>{snapshot ?? "Ukendt enhed"}</option>}
      </select>
      {opfordring && <div className="enhed-hint">Montage: vælg den enhed, du arbejder på.</div>}
    </div>
  );
}
