# PROPOSAL — quote di RollXO, N1 Bet, Wildz e Beazt nel best price e nella raccolta prezzi

Stato: **NON ESEGUITA.** Serve `APPROVE` di Andrea (deploy + scritture su `partner_price_history` di produzione).
Branch: `betredge/v3c-partners` (F7). Data: 06/10/2026.
Legenda: **[V]** misurato/verificato · **[A]** stima o assunzione.

## 1. Task
Andrea: il «best price» deve mostrare le quote di tutti i partner possibili, non solo FortunePlay e YBets.
Sul branch c'è il codice; i nuovi book **non leggono niente** finché una variabile non li accende.
Questa proposta è l'accensione, più la raccolta storica.

## 2. Com'è oggi [V]
| Cosa | Chi | Frequenza | Book |
|---|---|---|---|
| Quote correnti del board | `/api/v3/board` → `fetchAllBooks()` (`lib/betconstruct-feed.ts`) dal vivo, cache 30 s per istanza, stale-while-revalidate | a richiesta | FortunePlay, YBets |
| Storia prezzi | cron Vercel `/api/predictions/refresh` (`0 */2 * * *`, `maxDuration` 300 s) → `registraPrezziPartner()` (`lib/partner-prezzi.ts`) → INSERT a blocchi di 100 in `partner_price_history` | ogni 2 ore | FortunePlay, YBets (~9.090 righe/giorno ciascuno, misura del 05/10) |
| Partite tennis dai partner | stesso cron → `ingestPartnerTennis()` (`lib/partner-fixtures.ts`) | ogni 2 ore | FortunePlay, YBets |

`partner_price_history.bookmaker` è `text` libero: **nessuna migrazione serve**.

## 3. COSA CAMBIERÀ ESATTAMENTE

### 3a. Accensione (board, preview e poi produzione)
- Variabile `BETREDGE_PARTNER_FEEDS=rollxo,n1bet,wildz,beazt`
  - prima in **Preview** (`vercel env add BETREDGE_PARTNER_FEEDS preview`), redeploy della preview del branch;
  - in **Production** solo al merge del redesign, con lo stesso valore.
- Prima → dopo: `book_prices` passa da 2 a fino a 6 book; `coverage.with_book_price` da `{fortuneplay, ybets}` a 6 chiavi.
- Misurato dal vivo in locale (05/10 ~23:20 UTC = 06/10 01:20 ora italiana, sola lettura, `scripts/partners/probe-partner-feeds.ts`) [V]:
  - partite calcio del board con almeno una quota: **103 → 183 su 213**;
  - con 6 book: 82; con 0 book: 30;
  - per book (calcio / tennis): FortunePlay 103/163, YBets 103/163, RollXO 106/163, N1 Bet 103/163,
    Wildz 162/121, Beazt 162/121 (Wildz con l'aggancio tollerante ai nomi, §5).
- Il sito attuale **non cambia**: `BOOKS` (FortunePlay, YBets) non è toccato, quindi `/api/fortuneplay-odds`,
  la scheda partita e il menu «Piazza la scommessa» restano identici con o senza variabile.

### 3b. Raccolta storica (collector)
Una riga in `lib/partner-prezzi.ts`, oggi NON applicata sul branch:
```diff
-import { fetchAllBooks } from "./betconstruct-feed";
+import { fetchAllPriceBooks } from "./price-books";
 ...
-  const perBook = await fetchAllBooks();
+  const perBook = await fetchAllPriceBooks();
```
`fetchAllPriceBooks()` restituisce gli stessi `{ book, map }` con `book.key` = `rollxo` / `n1bet` / `wildz` / `beazt`
per i book accesi: il resto della funzione non cambia. Senza la variabile scrive esattamente come oggi.
`ingestPartnerTennis()` **non** cambia (la scoperta delle partite resta FortunePlay/YBets).
Non cambiano neppure la line-movement e il `gap` del tennis (`lib/v3c/line-movement.ts`, `marketAtSeal`):
continuano a leggere solo FortunePlay/YBets — scelta voluta, la misura sigillata non cambia fonte.

### 3c. Carico
| | Oggi | Dopo | Note |
|---|---|---|---|
| GET al feed per giro del board (per istanza calda, ogni ≥30 s) | ≤ 2×24 | ≤ 4×24 BetConstruct + 4 Altenar | Altenar: cache 5 min, una richiesta alla volta, 1,5 s fra due richieste, ~3 MB per book |
| Righe/giro del collector | ~1.515 [V] | ~4.700 [A] | stima dalla dimensione dei feed (954/921/1.183/1.183 partite, ~80% nell'orizzonte di 10 giorni) |
| Righe/giorno | ~18.200 [V] | ~56.000 [A] | ~1,7 M righe/mese; la tabella ha già gli indici per partita e per data |
| RPC INSERT/giro | ~16 | ~47 [A] | se il giro supera la scadenza, `esito.saltati` lo dice nel log (#REFRESH-1001) |
User-agent: BetConstruct come oggi (browser, uguale al feed già in uso); Altenar identificabile
`BetRedgePriceBot/1.0 (+https://betredge.com; partner price comparison; read-only)`.

## 4. ToS e liceità (da decidere, non da assumere)
- **Nessun accordo scritto** su nessuno dei quattro feed, come per FortunePlay e YBets oggi. Termini d'uso degli operatori **non letti** [V].
- RollXO, N1 Bet: stessa API pubblica e stesso livello di rischio del feed FortunePlay già in produzione. Rete: N1 Partners.
- Wildz, Beazt: il widget è servito dall'host di **Altenar** (`sb2frontend-altenar2.biahosted.com`), senza autenticazione e senza
  challenge; il sito del partner invece è dietro Cloudflare Turnstile — **non** lo tocchiamo e non aggiriamo nessuna verifica. Rete: Rootz (wildzaffiliates).
- Raccomandazione: prima dell'accensione in Production, una riga ai due affiliate manager (N1 Partners, Rootz) per conferma scritta.
- Esclusi, con motivo esposto nel campo `books[].reason`: Hollywin (`region_restricted`: da DE l'API risponde con la SPA, da US «Restricted region»; nessun aggiramento),
  BetScore/Casea/Stonevegas (`awaiting_partner_feed`: fornitore sportsbook non determinato — Altenar risponde 400 alle integrazioni con quei nomi),
  VeloBet/GG.BET/BetWinner/FeliceBet (`awaiting_partner_feed`: nessun feed pubblico visto, Andrea scrive ai partner), slotsbonus (`no_sportsbook`).

## 5. Limiti noti
- **Nomi Altenar.** Wildz scrive «PSV», «KuPS», «Botafogo-RJ»: la chiave esatta aggancia 72/213 partite. Il board usa un aggancio tollerante
  stretto (`lib/v3c/fixture-match.ts`: solo calcio, calcio d'inizio ±30 min, entrambe le squadre compatibili, un solo candidato) → 162/213;
  le 90 unioni del 06/10 sono state lette una per una, nessuna sbagliata. **Il collector invece scrive la chiave del book**: per ~56% delle partite
  pubblicate la storia Wildz/Beazt non si ritrova con la chiave del board, quindi il ripiego su `price_history` (feed giù) per loro copre meno.
  Upgrade: scrivere anche la chiave del board quando l'aggancio tollerante la trova (proposta separata).
- **Wildz = Beazt**: stesse quote al centesimo (11.732 su 11.732 nel campione) — stesso trading. RollXO e N1 Bet coincidono spesso con FortunePlay
  (es. Chicago Fire–Vancouver 2.84/3.69/2.19 su tutti e quattro). Il confronto è onesto ma il prezzo migliore cambia di rado.
- **Deep-link**: RollXO e N1 Bet hanno le pagine partita (`/en/sports/soccer/{slug}-m-{id}` risponde e mostra le quote), ma un link diretto con
  attribuzione N1 Partners non è verificato → si usa la landing affiliata. Wildz/Beazt: solo home.
- **Tennis** Altenar senza aggancio tollerante (121/187): nomi di persona, rischio di unione sbagliata più alto.

## 6. Reversibilità / rollback
- Board: togliere `BETREDGE_PARTNER_FEEDS` (o lasciarne solo alcune chiavi) + redeploy → torna a 2 book. Nessun dato da ripristinare.
- Collector: revert della riga in `lib/partner-prezzi.ts` (o variabile vuota). Le righe già scritte sono innocue (nessun processo di prodotto
  decide su di esse); se si vogliono togliere: `DELETE FROM partner_price_history WHERE bookmaker IN ('rollxo','n1bet','wildz','beazt')` —
  irreversibile, solo su richiesta esplicita.

## 7. Blast radius
`/api/v3/board`, home/predictions v3c (solo dietro `NEXT_PUBLIC_REDESIGN`), cron `/api/predictions/refresh` (tempo del giro).
Non toccati: sito attuale, pagamenti, `pick_ledger`, record, settlement, line-movement, gap tennis.

## 8. Piano di verifica (dopo l'esecuzione)
1. Preview: `GET /api/v3/board` → `coverage.with_book_price` ha 6 chiavi; `books` di Chicago Fire–Vancouver ha 6 `live_feed`.
2. Tre quote RollXO/N1/Wildz confrontate a occhio con la pagina del partner (Wildz va aperta da Andrea: il sito chiede la verifica Turnstile).
3. Dopo il primo giro del cron: `SELECT bookmaker, count(*) FROM partner_price_history WHERE captured_at > now() - interval '3 hours' GROUP BY 1`
   → 6 book; log `[prezzi-partner]` senza `SALTATI`.
4. `npx vitest run` verde (fixture registrate, nessun accesso dal vivo nei test).

## 9. Già verificato sul branch [V]
- Quote del feed = quote della pagina del partner (render headless da IP DE, 05/10 ~23:30 UTC = 06/10 01:30 ora italiana), 12 prezzi su 12:
  RollXO Chicago Fire–Vancouver 2.84/3.69/2.19 · RollXO Braunschweig–Holstein Kiel 2.61/3.61/2.38 ·
  N1 Bet KuPS–AC Oulu 1.50/3.71/5.10 · N1 Bet Chicago Fire–Vancouver 2.84/3.69/2.19.
- Ripetuto il 06/10 ~02:10 UTC (feed via `fetchBookBoard`, pagina partita renderizzata headless e guardata), 6 prezzi su 6:
  RollXO Arsenal–Leeds United 1.34/4.90/7.70 · N1 Bet AS Monaco–Toulouse 1.57/4.20/4.90.
- Wildz **non** confrontato col sito: Cloudflare Turnstile sia da Chrome sia headless; non si aggira. Valori del widget da far controllare:
  Chicago Fire–Vancouver 2.71/3.75/2.25, KuPS–AC Oulu 1.58/4.00/5.67, Braunschweig–Holstein Kiel 2.55/3.50/2.38.

## Owner e approvazione
- Owner esecuzione: programmatore (Claude Calde — Aziendale), su branch + preview.
- Serve OK da: **Andrea** (`APPROVE` in `ch_deploy_gate`), idealmente dopo la conferma dei due affiliate manager (§4).
