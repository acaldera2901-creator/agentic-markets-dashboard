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
