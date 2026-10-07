# v3c · punteggi live (#V3C-LIVESCORES, 07/10/2026, branch `betredge/v3c-livescores`)

Richiesta di Andrea: «voglio che si vedano i risultati in tempo reale dei match live». Solo informazione:
il dato live non tocca registro, sigillo, stime né settlement.

## Fonti esaminate (misurate il 07/10)

| Fonte | Già in uso / pagata | Calcio | Tennis | Latenza | Quota / costo | Termini |
|---|---|---|---|---|---|---|
| **ESPN site API** (`site.web.api.espn.com`, `lib/espn.ts`) | in uso: `/api/live`, `/api/tennis-live`, recupero settlement | punteggio, stato (1T/HT/2T/FT/dts/rigori), **minuto**, gol/rigori/autogol/rossi con minuto e giocatore | set e game, tie-break, **chi serve** (spesso), ritiro, vincitore; **niente punti del game**; solo ATP/WTA (+ doppi), niente ITF/Challenger | ≈ pari a Sofascore (3/3 confronti entro 1 min) | nessuna chiave, nessuna quota; risposta tennis ≈ 0,8 MB per circuito | API pubblica non documentata, nessun contratto: rischio termini (uso commerciale) **già accettato** dal codice in produzione, non nuovo |
| **The Odds API `/scores`** (piano 5M crediti/mese, `core/odds_api_client.py`) | pagata, usata dal settlement | solo punteggio + completed, **nessun minuto, nessun evento**; copertura calcio parziale | **nessuna** | ~30 s (doc) | 1 credito a chiamata per sport (2 con `daysFrom`) | licenza d'uso regolare |
| football-data.org (`lib/football-data.ts`) | in uso (free tier, top-5) | punteggio, minuto | — | — | 10 req/min | lascia partite finite in IN_PLAY con punteggi sbagliati (misurato 31/08, 3 su 5): scartata |
| feed partner BetConstruct | quote pre-match | — | — | — | — | non è un feed punteggi: non usato |

**Scelta: ESPN**, l'unica fonte già in uso con minuto, eventi e set; nessun abbonamento nuovo, nessuno scraping HTML.
Alternativa con licenza piena: The Odds API `/scores` (solo punteggio calcio, niente tennis); costo stimato con
cache 20 s e ~4 leghe live: ≈ 12 crediti/min di partite in corso, trascurabile sui 5M.

## Endpoint `GET /api/v3/live`
Flag-gated come gli altri `/api/v3` (404 a flag spento e non admin). Una SELECT su `unified_predictions`
(righe pubblicate con kick-off fra −180′ e +15′), poi solo gli scoreboard ESPN delle leghe/giorni presenti.
Cache: 20 s per istanza con build condivisa + `public, s-maxage=20, stale-while-revalidate=40` a flag acceso
(`private, no-store` sul percorso admin). Errori di fonte in `coverage.failed_feeds`; DB giù → 503.

## Abbinamento e tasso misurato
id ESPN nel nostro id (`espn:…`, `tennis:espn:…`) → per id, orientamento sui nomi; altrimenti calcio: stessa
lega, kick-off ±30′, identità forte su entrambe le squadre (`tokenSquadra`, + «B» = «II», plurali), un solo
candidato; tennis: kick-off ±12 h, stessi giocatori (token di `canonicalPlayerKey`), singolo con singolo.
Su righe reali 26/09–07/10: **calcio 87/103 (84 %)** — i 16 mancanti non sono nello scoreboard ESPN a quell'ora
(rinvii/fixture vecchie); **tennis `tennis:espn` 91/95 (96 %)** — i 4 mancanti hanno avversario cambiato in ESPN;
**tennis partner 121/650 (19 %)**: quasi tutto ITF/Challenger, che ESPN non copre → «punteggio n.d.».
Leghe senza ESPN: POL, VEI.

## Cosa resta
- Calcio live su dati veri **non verificato** (nessuna partita del board in corso durante il lavoro: prime alle 22:30 UTC).
- Tennis ITF/Challenger (≈ 80 % delle righe tennis partner): nessuna fonte lecita gratuita in uso.
- Le righe «Finita» restano nel gruppo «Live now» della board finché la board le tiene (150′).
- «Live now» in home compare dopo la prima risposta (piccolo spostamento del layout, CLS non misurato).

---

# live2 · più fonti per i punteggi live (#V3C-LIVE2, 07/10/2026, branch `betredge/v3c-live2` da `v3c-final2`)

Segnalazione di Andrea sulla preview: «mancano score alla maggior parte dei match live».

## Misura sulla preview (`betredge-z3gbsb8ht`, `vercel curl` su /api/v3/board e /api/v3/live, 10:36 UTC)
- Calcio: **0 righe nella finestra** (prima partita del giorno alle 16:00 UTC): oggi non misurabile dal vivo.
- Tennis: **89 righe nella finestra, 8 con punteggio (9 %)**. ESPN (`tennis:espn`, Samsun Open + Shanghai) 5/5 sul board;
  righe partner **63 sul board, 1 con punteggio**. Le righe partner non hanno torneo nel DB (`league = 'Partner feed'`,
  `tournament: null` nel board): «ITF/Challenger» è dedotto, non letto.
- Board calcio (213 righe, 31 leghe): **171 hanno id `oddsapi:<evento>`** → abbinabili per id esatto a The Odds API `/scores`.

## Fonti (ordine di priorità per il calcio: ESPN → API-Football → The Odds API)
| Fonte | Cosa dà | Piano misurato 07/10 | Uso live2 |
|---|---|---|---|
| ESPN site API | invariata | — | prima fonte, come prima |
| API-Football (`API_FOOTBALL_DIRECT_KEY`, api-sports.io) | `fixtures?live=all`: TUTTE le partite in corso con minuto, gol, rossi | **Free: 100 req/giorno, 10/min**; `live=all` servito anche su Free (verificato: 20 partite); 42 già usate alle 10:40 dalla pipeline. `API_FOOTBALL_KEY` (RapidAPI) = 403 «not subscribed» | ≤ 40 letture/giorno, 1 ogni 5 min, stop se l'header dice ≤ 25 rimaste |
| The Odds API `/scores` (`ODDS_API_KEY`) | punteggio + completed, niente minuto/eventi | 5M crediti/mese, **4.927.110 rimasti**; 1 credito/chiamata per sport key (2 con `daysFrom=1`) | ≤ 20.000 crediti/giorno, 1 lettura ogni 30 s per sport key, stop sotto `ODDS_RESERVE` (8000) |
| football-data.org | scartata (vedi sopra) | — | — |

Costo stimato The Odds API: con 4–6 leghe in corso ≈ 8–12 crediti/min solo nelle finestre di gioco (< 0,5 % del mese).
Manopole env (tutte opzionali): `LIVE_APIF_DAILY`, `LIVE_APIF_MIN_INTERVAL_S`, `LIVE_APIF_RESERVE`, `LIVE_ODDS_DAILY`,
`LIVE_ODDS_MIN_INTERVAL_S`, `LIVE_ODDS_RESERVE`. Con API-Football Pro (7.500/giorno): `LIVE_APIF_DAILY=4000`, `LIVE_APIF_MIN_INTERVAL_S=20`.

## Come funziona
- `lib/v3c/live-apifootball.ts`, `lib/v3c/live-oddsapi.ts`: parser puri (fixture registrate in `tests/fixtures/live-sources/`).
- `lib/v3c/live-fuse.ts`: abbinamento (id `oddsapi:` esatto; altrimenti kick-off ±30′, una squadra con identità forte e
  l'altra almeno contenuta — «PSV» ⊂ «PSV Eindhoven» —, stessi marcatori U19/W/II/III, un solo candidato) e fusione per
  riga: vince l'`updated_at` più recente, parità → ESPN → API-Football → Odds API; minuto/gol presi da un'altra fonte solo
  se stesso stato e stesso punteggio. Autogol di API-Football non mostrati come evento (lato non verificato).
- `lib/v3c/live-quota.ts`: budget per istanza (backoff 30 s→10 min, Retry-After, riserva sull'header del provider,
  budget giornaliero UTC, intervallo per risorsa). **Limite dichiarato:** istanze serverless diverse non condividono il
  contatore; il tetto vero è la riserva letta dall'header del provider.
- Le fonti a pagamento si leggono SOLO per righe di calcio già iniziate e senza punteggio ESPN.
- `/api/v3/live`: per riga `source` e `updated_at`; in testa `sources[]` (ok/idle/off/degraded, motivo, consumo, rimanenti)
  e `degraded`. Cache 20 s invariata. Nessuna scrittura su DB.
- UI: nessuna fonte → «Kick-off 14:20» (calcio) / «Start 10:45» (tennis), mai «Live», mai un minuto; la riga di fonte
  nomina la fonte vera; il fallback prima della prima lettura non mostra più i minuti dal calcio d'inizio («62′»).

## Verifica fatta
- API-Football vs sito pubblico J.League (jleague.jp, Emperor's Cup 07/10 ~10:55 UTC): **10/10 punteggi identici**
  (es. FC Tokyo–Shonan 2-0 HT, gol 14′ Yamada e 34′ in entrambi).
- Odds API `/scores` su 31 sport key del board (daysFrom=3): punteggi presenti per le partite concluse di ARG (8), PD2 (7),
  MLS (1); le altre leghe non avevano partite concluse negli ultimi 3 giorni (pausa nazionali): copertura delle altre
  leghe **non dimostrata**, solo dichiarata dal provider.

## Tennis ITF/Challenger — nessuna fonte lecita gratuita (decisione di Andrea)
- Il feed partner BetConstruct (FortunePlay/YBets), da cui nascono le righe partner, porta punteggi e set anche in gioco
  ed è già usato in produzione per quote e risultati; NON l'ho usato per il live: è un'API interna del sito del partner,
  senza licenza dati scritta. Serve un sì esplicito di Andrea (o un ok scritto del partner).
- Con licenza (prezzi pubblici 07/10): api-tennis.com 40 $/mese (8.000 req/giorno, ITF+Challenger, prova 14 gg);
  Goalserve tennis 150 $/mese (ATP/WTA/Challenger/ITF, punto per punto); livetennisapi.com da 29,99 $; Sportradar su preventivo.
- Niente scraping di Sofascore/Flashscore.
