import { RefreshCw } from "lucide-react";
import { useVersionCheck } from "../lib/useVersionCheck";

interface Props {
  /** Udskyd beskeden diskret (fx mens en registrering redigeres). */
  defer?: boolean;
}

// Rolig besked når en nyere version er deployet. Blokerer intet: den er ikke-modal
// og skjules mens en editor er åben (defer). Ligger under overlay i z-index, så en
// åben registrering aldrig dækkes brat.
export default function UpdateBanner({ defer = false }: Props) {
  const updateAvailable = useVersionCheck();
  if (!updateAvailable || defer) return null;

  return (
    <div className="update-banner smu-card" role="status" aria-live="polite">
      <span className="update-banner-text">
        Ny version af SMU Tid er klar. Genindlæs for at opdatere.
      </span>
      <button className="smu-btn-primary" onClick={() => window.location.reload()}>
        <RefreshCw size={15} /> Genindlæs
      </button>
    </div>
  );
}
