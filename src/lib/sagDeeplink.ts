// Deep-link fra SMU OS (sagens "Tidsforbrug i alt") til Overblik → fanen "Sag":
//   /oversigt?sag=<sag-uuid>&smu=<SMU-nr.>
// Kun en visningsgenvej: registreringerne hentes stadig via sag_id under RLS
// (har_app_adgang('tid')). smu bruges kun som visning og til at finde titel/kunde.

export interface SagDeeplink {
  sagId: string;
  smuNummer: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Læser ?sag= (og valgfri ?smu=) — null hvis sag mangler eller ikke er et gyldigt id. */
export function sagFraUrl(search: string): SagDeeplink | null {
  const p = new URLSearchParams(search);
  const sagId = (p.get("sag") ?? "").trim().toLowerCase();
  if (!UUID.test(sagId)) return null;
  const smu = (p.get("smu") ?? "").trim().slice(0, 40);
  return { sagId, smuNummer: smu || null };
}
