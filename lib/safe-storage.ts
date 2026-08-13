// lib/safe-storage.ts — #STORAGE-CRASH-0813
//
// `localStorage` non è sempre disponibile: Safari in navigazione privata, i
// browser interni delle app (WhatsApp/Instagram/Telegram) e i profili coi cookie
// bloccati fanno LANCIARE anche una semplice `getItem`. Una lettura nuda dentro
// un render o un `useEffect` non resta un errore locale: risale fino al boundary
// globale e l'utente vede la schermata d'errore al posto del sito. È successo il
// 2026-08-13 — riprodotto con Playwright, stack alla mano.
//
// Regola: nel codice client si passa da qui. Una preferenza persa è un
// inconveniente; una pagina che non carica è un cliente perso.

/** Il valore, o `null` se assente **o** se lo storage è vietato. */
export function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Scrive; ritorna `false` se lo storage è vietato (no-op silenzioso). */
export function storageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
