// Rolling publication window (#019, APPROVE Andrea 2026-06-06).
//
// Predictions are computed and served only for the next N days, refreshed
// daily: closer matches carry more information (squads, injuries, mature
// markets), so the served percentages are stronger than publishing the whole
// slate at once with weak distant edges. ALL sports — current and future —
// must respect this window. Keep in sync with config/settings.py
// (PREDICTION_WINDOW_DAYS).
export const PREDICTION_WINDOW_DAYS = 10;

// #V2-ROW-CAP-0803 — tetto di righe che /api/v2/predictions legge dal DB.
//
// Era `LIMIT 100` scritto nella query, ed è rimasto invisibile finché il filtro
// di coverage scartava quasi tutto il football: le righe buttate lasciavano
// spazio sotto il tetto. Chiuso #V2-FOOTBALL-COVERAGE-0802 le righe passano
// tutte, e misurato il 2026-08-03 la finestra ne contiene **139** (75 tennis +
// 64 football) — cioè il tetto ne tagliava 39, e in silenzio.
//
// Il dimensionamento NON va fatto su quel 139: il 03/08 il calendario dei club
// è ancora fermo (Liga 15/08, PL e Ligue 1 21/08, Serie A e B 22/08,
// Bundesliga 28/08). Quello è il minimo stagionale, non il caso normale. Con
// tutte le leghe in corso il volume atteso su una finestra di 10 giorni è
// diverse volte tanto, quindi il tetto sta a 1000: abbondante sul picco
// plausibile, ma pur sempre un tetto — la WHERE è già selettiva (finestra,
// published, non storica, non demo) e una query senza limite su una tabella
// che cresce è un'altra categoria di rischio.
//
// La lezione però non è il numero, è che il troncamento non deve essere muto:
// vedi `isRowCapReached` e il warn nella route.
export const V2_MAX_ROWS = 1000;

/**
 * True quando la lettura ha toccato il tetto, cioè il calendario più lontano
 * potrebbe essere troncato (l'ORDER BY è `starts_at ASC`, quindi a cadere sono
 * sempre le partite più in là nel tempo).
 *
 * Esiste per un motivo preciso: il difetto di #V2-ROW-CAP-0803 non è stato il
 * tetto in sé, ma il fatto che nessuno potesse accorgersene. Un `count` uguale
 * al limite è indistinguibile da "ci sono esattamente tante partite" se non lo
 * si dichiara.
 */
export function isRowCapReached(rowCount: number): boolean {
  return rowCount >= V2_MAX_ROWS;
}
