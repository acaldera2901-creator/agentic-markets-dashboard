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

---

## Aggiornamento fixdata2 — 07/10 ~17:40 UTC (solo SELECT, nessuna chiamata a The Odds API)

**Misura attuale (QA-2: 12 partite top-4 senza mercato sulla board).** Ultimo snapshot di prediction_log per
partita, prossimi 10 giorni, id football-data:

| Lega | partite | con quota | ultima riga con quota |
|---|---|---|---|
| SA | 12 | 12 | 07/10 14:01 |
| PD | 13 | 13 | 07/10 14:01 |
| BL1 | 15 | 14 | 07/10 14:01 — manca Augsburg–Bayern |
| FL1 | 11 | 9 | 07/10 14:01 — mancano Lens–Lyon, Rennes–Auxerre |
| **PL** | 14 | **0** | **02/10 16:01** |
| CL | 18 | 0 | 06/10 00:01 (non sulla board di oggi) |

**Sonda sul join (odds_snapshots, collector Python, ultime 6 h):** il mercato c'è per tutte e 12, con Pinnacle:
`arsenal|leeds united` 25 book, `crystal palace|nottingham forest` 25, `everton|hull city` 25,
`liverpool|manchester city` 25, `coventry city|newcastle united` 25, `augsburg|bayern munich` 24,
`lyon|rc lens` 22, `auxerre|rennes` 22.

**Cosa cambia nella diagnosi.**
1. La causa «richieste parallele → 429» è **indebolita**: oggi SA/PD/BL1/FL1 agganciano quasi tutto nello stesso
   `Promise.all`; è la **sola Premier League** che non aggancia nulla da 5 giorni. Il difetto è specifico della chiamata
   EPL (status non-2xx o 422 sul set di mercati) o del suo parse — non visibile dal DB perché `fetchOdds` torna `[]` muto.
   Il punto 1 della change-spec (loggare lo status) resta il primo passo e basta a decidere; il punto 2 (seriale) diventa
   facoltativo, da fare solo se il log mostra 429.
2. I 3 buchi fuori dalla PL sono **alias** (confermati dai nomi in odds_snapshots): `bayern munich ↔ fc bayern münchen`,
   `lyon ↔ olympique lyonnais` + `rc lens ↔ racing club de lens`, `rennes ↔ stade rennais fc 1901`. Da aggiungere alla
   mappa del punto 3 (insieme a `inter milan ↔ internazionale milano`, oggi agganciata).

**Cosa fa già la v3c senza questa PROPOSAL (fixdata2 N3, sul branch, nessuna scrittura).** Dove prediction_log non ha il
mercato, la board lo ricava dai prezzi REALI dei book partner (de-vig per book, media), lo dichiara («Market from the
partner books' prices») e applica la stessa stima dichiarata 0,3·modello + 0,7·mercato con il guard 15/25 pp sopra.
Sulla board del 07/10 15:26: 10 delle 12 tornano ad avere mercato (Palace–Forest e Hull–Everton e Chelsea–Bournemouth
finiscono «no value», 16–23 pp); Augsburg–Bayern e Rennes–Auxerre non hanno nessun book partner → «Model only: no market
to compare», senza stima. **Questo non sostituisce la PROPOSAL**: la stima servita e sigillata di quelle partite resta il
modello puro (il blend del pipeline è calcolato senza mercato); il fix vero è a monte.

- **Owner esecuzione:** programmatore (path predictions) · **Serve OK da:** Andrea. Ancora NON eseguita.

---

## Aggiornamento fixdata3 — giro delle 16:01 UTC del 07/10 (solo SELECT, nessuna chiamata a The Odds API)

**Misura (prediction_log, partite con kick-off dal 07/10, partite distinte con quota / partite per giro).**

| Lega | 12:01 | 14:01 | 16:01 |
|---|---|---|---|
| SA | 12/14 | 14/14 | **0/14** |
| PD | 0/15 | 14/15 | 14/15 |
| BL1 | 0/16 | 14/16 | **0/16** |
| FL1 | 0/13 | 10/13 | **0/13** |
| PL | 0/15 | 0/15 | 0/15 |

- **Inter–Parma** (FC Internazionale Milano–Parma Calcio 1913) e **Brest–Angers** (Stade Brestois 29–Angers SCO):
  quota presente alle 14:01, **null alle 16:01** (e null alle 12:01).
- Sulla board (QA-3, 16:45–17:20 UTC): 33 partite top senza mercato memorizzato (PL 9, BL1 9, FL1 9, SA 6);
  **29 leggono il mercato dai book partner** (fixdata2 N3, dichiarato «Market from the partner books' prices»),
  **4 restano «Model only: no market to compare»** (Augsburg, Rennes, Inter–Parma, Brest–Angers), senza stima.

**Cosa cambia nella diagnosi.** Il vuoto è per **lega intera** e a intermittenza (0 → 14 → 0 a codice invariato),
non per squadra: è la chiamata `fetchOdds(code)` che torna `[]`, prima ancora del join per nome. L'indagine parallela
sull'hotfix del matcher (`redesign/proposals/regressione-quote-1607.md`, altro agente) conclude che l'hotfix non ne è la
causa; questo filone non ha toccato `lib/summer-leagues.ts` né la pipeline di produzione.
Conseguenza sulla change-spec qui sopra: il **punto 1 (una riga di log per lega in `fetchOdds`: status HTTP, n. eventi,
`x-requests-remaining`) diventa il primo e unico passo** prima di decidere il rimedio (seriale/retry/ultima quota buona);
punto 2 solo se il log mostra 429; punto 3 (alias) invariato.

- **Owner esecuzione:** programmatore (path predictions) · **Serve OK da:** Andrea. **Ancora NON eseguita.**
