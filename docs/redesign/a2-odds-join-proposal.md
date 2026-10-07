# PROPOSAL — A2: the top-league football matches without a market (prod pipeline, NOT executed)

Filone fixdata (#REDESIGN-V3C), 07/10/2026. Serve **APPROVE di Andrea** prima di qualsiasi esecuzione.
Nulla di quanto segue è stato eseguito: solo SELECT sul DB e lettura del codice.

## Il difetto (QA-REPORT A2)
37 partite delle 5 leghe top sulla board senza mercato né prezzi (es. Liverpool–Man City «model only 42%», Inter–Parma).

## Cosa ho misurato (SELECT, 07/10 ~15:40 UTC)
- Le partite della board di PL, LaLiga, Bundesliga, Ligue 1 e Serie A hanno id **football-data** (`560598`, `558582`…), non `oddsapi:*`: il loro mercato viene SOLO dal prediction_log scritto da `app/api/predictions/route.ts` (cron refresh ogni 2 h) → `fetchOdds(code)` → `abbinaQuote`.
- Righe di prediction_log con quota, per partita (ultimi ~7 giorni, ~55–77 snapshot ciascuna):

| Lega | snapshot con quota | ultima quota | ultimo snapshot |
|---|---|---|---|
| Premier League (9 partite) | 2 per partita | 02/10 16:01 | 07/10 12:01 |
| LaLiga (8/9) | 2 | 05/10 02:01 | 07/10 12:01 |
| Bundesliga (8/9) | 2 | 06/10 06:01 | 07/10 12:01 |
| Ligue 1 (9) | **0** | — | 07/10 12:01 |
| Serie A (5/6) | 9 | 07/10 12:01 (l'ultimo) | 07/10 12:01 |
| Inter–Parma, Augsburg–Bayern, Elche–Celta | **0** | — | 07/10 12:01 |

- Le quote ESISTONO nel DB, da un'altra pipeline: `odds_snapshots` (collector Python, `source='odds_api'`) ha Arsenal–Leeds catturata alle 13:28 da 23 book incluso Pinnacle, Inter–Parma (`2026-10-10:inter milan|parma`), Dortmund–Bremen, Liverpool–Man City (anche Roobet). Quindi non manca il dato: manca l'aggancio nel path TS.
- La quota è OK: `source_quota_log.odds_api_remaining` = 214.474 usati su 5M (gate aperto, riserva 8.000).
- Il codice v3c legge correttamente: `fetchBoardSources` prende l'ULTIMO snapshot di prediction_log, che ha `odds_home = null`. Ripiegare su uno snapshot vecchio (2–5 giorni) mostrerebbe un prezzo stantìo come attuale: scartato.

## Cause (due, distinte)
1. **[D, da verificare con la sonda sotto]** `fetchOdds` viene chiamata **in parallelo per tutte le leghe** (`Promise.all(codes.map(fetchOdds))`, route.ts:413), ognuna con un possibile secondo tentativo su 422. The Odds API limita le richieste concorrenti (429 `EXCEEDED_FREQ_LIMIT`); `fetchOdds` su `!r.ok` ritorna `[]` **in silenzio**. Coerente con il dato: la Serie A (prima chiave di `LEAGUES`) aggancia quasi sempre, le altre leghe solo in un giro isolato ciascuna (02/10, 05/10, 06/10), la Ligue 1 mai.
2. **[V, dal codice]** Inter–Parma: la fonte quote scrive «Inter Milan», football-data «FC Internazionale Milano». `normName` → `inter milan` vs `internazionale milano`: chiave esatta diversa e sovrapposizione di token 0 (soglia 0,6 di `matchModelTeam`) → `abbinaQuote` = `nessuna`. È il «limite noto» dichiarato in `lib/odds-join.ts` (alias espliciti, mai abbassare la soglia). Probabile anche per Bayern («Bayern Munich» vs «FC Bayern München») e Celta.

## COSA CAMBIERÀ ESATTAMENTE (se APPROVE)
File di produzione (path condiviso col sito attuale, non v3c):
1. `lib/odds-api.ts` · `fetchOdds`: registrare lo status non-2xx (`console.warn("[odds] <league> HTTP <status>")`) invece di tornare `[]` muti. Prima→dopo: stesso valore di ritorno, in più una riga di log.
2. `app/api/predictions/route.ts:413`: da `Promise.all(codes.map(fetchOdds))` a richieste **in sequenza** (o concorrenza 2 con 250 ms fra una e l'altra). Prima→dopo: ~9 chiamate parallele → seriali; il cron dura qualche secondo in più (il batch aspetta già 62 s per football-data).
3. `lib/odds-join.ts`: mappa alias esplicita, solo coppie verificate a mano: `inter milan ↔ internazionale milano`, `bayern munich ↔ bayern munchen`, `celta vigo ↔ rc celta de vigo` (da confermare con la sonda). Con test in `odds-join.test.ts` (il test che oggi fissa Bayern come NON abbinato va aggiornato di proposito).

Comandi: nessuna migrazione, nessuna scrittura manuale. Branch + PR, deploy normale dopo APPROVE.

**Sonda read-only prima di toccare il codice (costo: 5 crediti × 1 regione, una volta):** una GET `/v4/sports/soccer_epl/odds?regions=eu&markets=h2h` e 5 GET in parallelo, guardando status e `x-requests-remaining`. Se le parallele danno 429 la causa 1 è confermata; se no, il log del punto 1 la troverà al primo cron.

- **Reversibilità:** revert del commit; nessun dato toccato.
- **Blast radius:** il path football del sito attuale (match_predictions, prediction_log, unified_predictions) — più partite con quota = più righe con stima 70/30 e gap anziché «model only». Nessun effetto sui pagamenti o sul registro sigillato già scritto.
- **Verifica:** dopo il primo cron, `SELECT competition, count(*) FILTER (WHERE odds_home IS NOT NULL) …` sull'ultimo snapshot per partita delle 5 leghe: atteso ≥ 90% con quota (oggi PL/LaLiga/BL/L1 = 0%). Sulla board v3c: le 37 righe passano da «model only» a mercato + stima + gap.
- **Owner esecuzione:** programmatore (path predictions) · **Serve OK da:** Andrea.

## Alternativa solo v3c (decisione, non eseguita)
Leggere il mercato dalle `odds_snapshots` del collector Python (Pinnacle, già nel DB, ≤ 2 h) quando prediction_log non lo ha. Fattibile in sola lettura, ma la **stima mostrata** resterebbe il modello puro (il blend 70/30 servito e sigillato è calcolato senza quel mercato): mostrare mercato e stima di due fonti diverse cambierebbe il significato del gap. Non l'ho fatto: serve una scelta di Andrea (e di ml-engineer sul blend).
