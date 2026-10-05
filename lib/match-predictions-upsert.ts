// lib/match-predictions-upsert.ts — l'upsert di match_predictions scritto da
// computeAndStore (app/api/predictions/route.ts). Sta in un modulo suo perche'
// il test (lib/match-predictions-upsert.test.ts) lo esegue su un Postgres vero
// (PGlite) con la stessa stringa che dbQuery manda a exec_sql.
//
// Regole della riga (#RECORD-ATOMICO-0930, audit agentic_codex 29/09 + revisione
// indipendente al gate del 02/10):
//
// 1. Tripla, quote, edge e pick sono UN record: si scrivono insieme, dello stesso
//    giro. Prima un COALESCE per colonna teneva quote/edge/pick del giro
//    precedente quando il nuovo non aveva prezzo; ma senza prezzo la tripla non
//    e' blendata (blendWithMarket = identita'), quindi la riga univa
//    probabilita' del solo modello con pick, quota ed edge calcolati su un'altra
//    distribuzione. Stesso difetto per una riga tornata non affidabile: il suo
//    best_selection null veniva ignorato e restava la pick vecchia.
//
// 2. Un giro SENZA quote non tocca la riga che ne aveva. fetchOdds torna vuoto
//    per un'intera lega (quota guard dell'Odds API o errore): sovrascrivere
//    vorrebbe dire togliere pick/quota/edge a tutta la lega, l'adapter la
//    declasserebbe a paper con pick NULL e, se e' l'ultimo giro prima del
//    kickoff, la partita si chiuderebbe void. Quindi il record resta quello
//    dell'ultimo giro col prezzo — intero, compresi computed_at (il dato e' di
//    allora: la freschezza lo deve dire) ed enrichment. prediction_log registra
//    comunque il giro senza quote: il log e' cio' che si e' calcolato, la riga
//    e' cio' che si serve.
//    Una riga che il prezzo non l'ha mai avuto si aggiorna normalmente (stima
//    del solo modello su stima del solo modello).
//
// 3. Il kickoff si aggiorna sempre (#KICKOFF-UPDATE-0930): un anticipo/rinvio
//    restava al primo orario visto e l'adapter lo copia in unified.starts_at
//    (freeze, scadenza, settlement). Mai pero' con il segnaposto di mezzanotte
//    non confermato ($19 = enrichment.time_confirmed).
//
// I commenti stanno qui e non dentro la stringa SQL: exec_sql la incapsula in
// `SELECT ... FROM (<stmt>) t` e un `--` sull'ultima riga si mangerebbe la
// parentesi di chiusura.

// "Questo giro non ha prezzo, la riga esistente si'": l'oggetto odds e' tutto o
// niente (vedi computeAndStore), quindi basta odds_home.
const KEEP_PREVIOUS =
  "EXCLUDED.odds_home IS NULL AND match_predictions.odds_home IS NOT NULL";

const RECORD_COLUMNS = [
  "p_home", "p_draw", "p_away", "lambda_home", "lambda_away",
  "odds_home", "odds_draw", "odds_away", "edge", "best_selection",
  "model_matches", "enrichment",
] as const;

const recordSet = RECORD_COLUMNS.map(
  (c) => `${c}=CASE WHEN ${KEEP_PREVIOUS} THEN match_predictions.${c} ELSE EXCLUDED.${c} END`
).join(",\n           ");

export const MATCH_PREDICTIONS_UPSERT_SQL = `INSERT INTO match_predictions (
           match_id, league, league_name, home_team, away_team, kickoff,
           p_home, p_draw, p_away, lambda_home, lambda_away,
           odds_home, odds_draw, odds_away, edge, best_selection, model_matches,
           enrichment, computed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,NOW())
         ON CONFLICT (match_id) DO UPDATE SET
           ${recordSet},
           computed_at=CASE WHEN ${KEEP_PREVIOUS} THEN match_predictions.computed_at ELSE NOW() END,
           kickoff=CASE WHEN $19::boolean THEN EXCLUDED.kickoff ELSE match_predictions.kickoff END`;
