// #FREEZE-KICKOFF-0911 (APPROVE Andrea) — iniziato il match, il pronostico non
// si muove piu'.
//
// Perche'. Misurato sui 14 giorni precedenti: 613 partite portavano snapshot
// calcolati DOPO il fischio (1.701 in tutto, il piu' tardivo a 723 minuti), e
// 559 di quelle erano davvero CAMBIATE — fino a 43,5 punti percentuali. Una
// percentuale che si sposta a partita in corso non e' piu' un pronostico, e chi
// aveva letto un numero ne ritrovava un altro.
//
// Cosa NON tocca, che e' il punto: si congela il GIUDIZIO, non la partita. I
// punteggi live e `match_status` viaggiano su un UPDATE separato
// (app/api/live/route.ts), il settlement su un altro ancora
// (app/api/cron/settle) — entrambi scrivono colonne diverse su righe che il
// ricalcolo semplicemente smette di riscrivere. La storia resta intera: tutti
// gli snapshot pre-match in `prediction_log` restano, smettiamo solo di
// aggiungerne di nuovi a palla che rotola. E il board continua a mostrare la
// riga, perche' la lettura e' gia' limitata a `kickoff > NOW() - 150 minuti`.
//
// Il track record non c'entra e non era in pericolo: `pick_ledger` sigilla la
// pick e non la riscrive (misurato: 80 pick, ZERO con `captured_at` successivo
// al fischio, ZERO partite con due pick diverse). Questo e' un fatto sul board,
// non sull'integrita' dello storico.

/**
 * La partita e' iniziata, quindi il pronostico va lasciato dov'e'?
 *
 * @param kickoffIso orario di inizio come lo fornisce football-data
 * @param adesso     iniettabile per i test; di norma "ora"
 */
export function pronosticoDaCongelare(
  kickoffIso: string | null | undefined,
  adesso: number = Date.now(),
): boolean {
  if (!kickoffIso) return false;

  // `T00:00:00` e' il segnaposto di football-data per un orario ANCORA IGNOTO
  // (8 partite nella finestra misurata), non una partita di mezzanotte. Un
  // segnaposto e' nel passato per quasi tutta la giornata: congelare su
  // un'ora finta zittirebbe una partita che non e' partita. In dubbio si
  // ricalcola — cioe' si resta al comportamento di prima.
  if (kickoffIso.includes("T00:00:00")) return false;

  const ms = Date.parse(kickoffIso);
  if (!Number.isFinite(ms)) return false; // data illeggibile: nessun congelamento

  return ms <= adesso;
}
