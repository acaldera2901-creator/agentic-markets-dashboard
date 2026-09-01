// #UNLOCKED-FIRST-0831 — ordine della board: le righe SBLOCCATE aprono la sezione.
//
// Perché esiste come modulo invece di una riga dentro il comparatore: è una
// regola commerciale, non un dettaglio di rendering. Il 31/08 la quota del piano
// free è passata a 3 pick al giorno per sport e il prodotto le consegnava
// davvero — ma la board ordina per ORARIO, quindi finivano sparse fra 136 schede
// coperte. Misurato su produzione con 3 righe sbloccate su 15: la prima aperta
// era la SESTA scheda. Dal punto di vista dell'utente free il prodotto dava una
// pick sola, ed è così che è stato segnalato.
//
// Il confronto è deliberatamente cieco al piano: per il Pro tutte le righe sono
// sbloccate e per l'anonimo nessuna, quindi ritorna 0 e l'ordine resta quello di
// prima. Vale solo dove esiste un confine — free e base — che è esattamente dove
// serve.

/** Righe sbloccate prima delle coperte. 0 quando stanno dalla stessa parte del
 *  confine, così il chiamante prosegue coi suoi criteri (live, orario, edge…). */
export function compareUnlockedFirst(
  a: { locked?: boolean },
  b: { locked?: boolean }
): number {
  if (!!a.locked === !!b.locked) return 0;
  return a.locked ? 1 : -1;
}
