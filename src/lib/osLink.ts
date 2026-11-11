import { PLATFORM_APPS } from "../platform-nav/platformApps";

/**
 * Adressen på en sag i SMU OS (vedligeholdelsespakke 1). Bygges ud fra platformens app-katalog
 * (`platform-nav`), så OS' domæne kun står ét sted. Kun et link: OS håndhæver selv adgangen.
 */
export function osSagUrl(sagId: string): string {
  return `${PLATFORM_APPS.os.url}/sager/${encodeURIComponent(sagId)}`;
}
