// #HYDRATION-418-1014 — il fuso del browser senza mismatch d'idratazione.
// `useState(() => Intl…timeZone)` dava il fuso di Node in SSR (UTC su Vercel) e
// quello dell'utente all'idratazione: ogni orario renderizzato lato server
// divergeva (React #418). Con useSyncExternalStore server e idratazione leggono
// lo stesso snapshot fisso, poi React ri-renderizza col fuso vero del browser.
import { useSyncExternalStore } from "react";

export const SSR_TZ = "Europe/Rome";

const subscribe = () => () => {}; // il fuso non cambia durante la sessione
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || SSR_TZ;
const serverTz = () => SSR_TZ;

export function useBrowserTimeZone(): string {
  return useSyncExternalStore(subscribe, browserTz, serverTz);
}
