// #LIVE-TICKER-PARITY-0831 — chi ha diritto di stare nel ticker «In play».
//
// Il ticker leggeva la mappa live GREZZA e mostrava qualunque voce con stato
// IN_PLAY/PAUSED. Misurato il 31/08/2026, due modi in cui quella mappa mente:
//
//   · football-data lascia partite FINITE con lo stato IN_PLAY. Interrogata
//     direttamente, la finestra ieri→oggi rendeva 5 partite del 30/08 ancora
//     IN_PLAY/PAUSED a 15-17 ORE dal fischio d'inizio, coi punteggi finali già
//     scritti (Lazio-Genoa 0-0, Cagliari-Inter 0-1, Monaco-Marsiglia 1-0,
//     Deportivo-Valencia 3-1, Cambuur-Twente 0-2). ESPN, per confronto, non le
//     elencava più: erano semplicemente finite.
//   · gli scoreboard ESPN rendono TUTTE le partite live della lega, anche quelle
//     per cui non abbiamo una predizione — annunciate nel ticker e introvabili
//     fra le schede.
//
// La difesa non è un controllo sull'orario (la mappa live non porta il kickoff):
// è partire dai FIXTURE IN BOARD. Chi è in board sta per costruzione dentro la
// finestra dei 150 minuti, quindi una partita di ieri non può entrare; e il
// ticker non può più annunciare una partita che l'utente non trova.
// Il tennis questo filtro lo aveva già («parity with /api/tennis board»).

export type TickerLive = {
  match_status?: string | null;
  home_team?: string | null;
  away_team?: string | null;
};

/** Gli stati che valgono «adesso in campo». Tutto il resto non entra. */
export function isLiveNow(status?: string | null): boolean {
  return status === "IN_PLAY" || status === "PAUSED";
}

/**
 * Le voci del ticker calcio: una per fixture in board che risulta live adesso.
 * `resolve` è l'abbinamento fixture → punteggio live, ed è lo STESSO che usano
 * le schede (`match_id` con fallback sui nomi, più l'orientamento casa/fuori):
 * passarlo dall'esterno evita di avere due meccanismi che possono divergere.
 */
export function liveFootballOnBoard<
  P extends { match_id: string },
  S extends TickerLive,
>(board: readonly P[], resolve: (p: P) => S | undefined): Array<readonly [string, S]> {
  const out: Array<readonly [string, S]> = [];
  const visti = new Set<string>();
  for (const p of board) {
    const s = resolve(p);
    if (!s || !isLiveNow(s.match_status) || !s.home_team || !s.away_team) continue;
    // Due fixture che risolvono sullo stesso punteggio (duplicati in board)
    // non devono comparire due volte nella striscia.
    const k = `${s.home_team}|${s.away_team}`;
    if (visti.has(k)) continue;
    visti.add(k);
    out.push([p.match_id, s] as const);
  }
  return out;
}
