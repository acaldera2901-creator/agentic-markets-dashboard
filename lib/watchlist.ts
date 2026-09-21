// lib/watchlist.ts — #RESTYLING-0921
//
// La watchlist: quali partite l'utente ha messo da parte. Il brief la vuole in
// nav, come fascia della lobby e come bottone su ogni card — ed è uno dei due
// motivi di ritorno che il prodotto può dare senza notifiche aggressive.
//
// SCORCIATOIA INTENZIONALE, dichiarata. Questa versione vive in
// `localStorage`: è PER-DISPOSITIVO, non segue l'account e non è leggibile dal
// server. Non c'era alcuna infrastruttura watchlist nel prodotto (misurato il
// 21/09: zero occorrenze fuori dai componenti nuovi), e il percorso onesto per
// la prima preview è quello che non richiede una migrazione di schema né un
// endpoint. L'upgrade è una tabella `watchlist(user_id, sport, event_id)` +
// merge al login, e questo modulo è l'unico punto da cambiare: la UI parla
// solo con `useWatchlist()`.
//
// Le chiavi sono `sport:id` (vedi lobbyKey): gli id di calcio e tennis vengono
// da tabelle diverse e si sovrappongono.

import { useCallback, useEffect, useState } from "react";
import { storageGet, storageSet } from "@/lib/safe-storage";

export const WATCHLIST_KEY = "betredge-watchlist";
/** Un tetto: la watchlist è una selezione, e un array senza limite in
 *  localStorage è un modo lento di riempire la quota di dominio. */
export const WATCHLIST_CAP = 200;

/** Parsa il valore grezzo. Tollera qualsiasi spazzatura: la watchlist non è
 *  un dato critico e un JSON rotto non deve impedire di aprire la Home. */
export function parseWatchlist(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    return [...new Set(out)].slice(0, WATCHLIST_CAP);
  } catch {
    return [];
  }
}

export function serializeWatchlist(keys: Iterable<string>): string {
  return JSON.stringify([...new Set(keys)].slice(0, WATCHLIST_CAP));
}

export function toggleKey(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export type Watchlist = {
  saved: ReadonlySet<string>;
  isSaved: (key: string) => boolean;
  toggle: (key: string) => void;
  /** true finché la lettura dallo storage non è avvenuta: il primo render
   *  (server e client) deve disegnare la stessa cosa, cioè watchlist vuota. */
  loading: boolean;
};

const EMPTY: ReadonlySet<string> = new Set<string>();

export function useWatchlist(): Watchlist {
  // Si parte SEMPRE vuoti: il server non ha lo storage, e l'HTML deve
  // combaciare o React ricostruisce l'albero all'idratazione (#418).
  const [saved, setSaved] = useState<ReadonlySet<string>>(EMPTY);
  const [loading, setLoading] = useState(true);

  // #STORAGE-CRASH-0813: la lettura sta DENTRO un effect. Fuori, su Safari in
  // navigazione privata, l'accesso allo storage lancia e porta giù la pagina.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo storage non esiste sul server: leggerlo in render romperebbe l'idratazione (#STORAGE-CRASH-0813)
    setSaved(new Set(parseWatchlist(storageGet(WATCHLIST_KEY))));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- idem: il flag segue la stessa lettura
    setLoading(false);
  }, []);

  const toggle = useCallback((key: string) => {
    setSaved((prev) => {
      const next = toggleKey(prev, key);
      storageSet(WATCHLIST_KEY, serializeWatchlist(next)); // no-op se lo storage è vietato
      return next;
    });
  }, []);

  const isSaved = useCallback((key: string) => saved.has(key), [saved]);

  return { saved, isSaved, toggle, loading };
}
