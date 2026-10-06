# Fidelity pass v3c — prototipo (proto-v3c) contro costruito

Branch locale `betredge/v3c-fidelity` (da `origin/betredge/v3c-polish` 5c790291), worktree `~/Desktop/01-BETREDGE/am-v3c-fidelity`. **Non pushato.** 06/10/2026, ui-andrea.

Metodo: scatti del prototipo (`redesign/screens-v3c/`, 1440 e 390, chiaro e scuro) contro la build locale (dev server + finto Supabase `scripts/v3c/mock-db.ts`, fetch esterni bloccati da `no-network.cjs`, `/api/track` abortito in Playwright) alle stesse larghezze e temi. Scatti prima: `.fid/before/`, dopo: `.fid/after/` (locali, non versionati). Contact sheet finale: `docs/redesign/fidelity-after.png`.

Fuori perimetro (filone `live`, branch `betredge/v3c-live`): quante partite mostrare, link verso il vecchio sito, quote dei partner. Qui solo struttura visiva, grafici, loghi e banner.

## Differenze trovate, una per riga

| # | Pagina | Elemento | Prototipo | Costruito prima | Stato |
|---|---|---|---|---|---|
| 1 | Home | Hero | fascia da regia navy con bordo LED | fascia senza banner; il kit (§3) assegna all'hero il banner calcio | **Corretto**: banner `hero-football` del kit dietro la fascia, velo navy a sinistra, AVIF/WebP 720/1200, dimensioni esplicite |
| 2 | Home, /predictions | Colonna «Open → now» | tape a gradini per riga (sky) + stima come prezzo equo (lime) | assente | **Corretto**: tape vero da `partner_price_history` (ultime 72 h, linea principale = book con più catture, come il grafico della partita), a gradini, ≤16 punti, nessun tape con <2 catture («no history») |
| 3 | Home, /predictions | Colonne Market / Estimate | due colonne di numeri (sky / lime evidenziato) | una scala 0–100% con i due punti | **Corretto**: due colonne come il prototipo; la scala resta nel pannello degli esiti e sulla pagina partita |
| 4 | Home 390 | Ledger a due livelli | riga 1: ora · partita · gap + «44% → 48%»; riga 2: tape · «2.02 → 2.15» · book | riga 2 = scala | **Corretto** |
| 5 | Home 390 | Legenda sotto i filtri | solo desktop | visibile anche a 390 (3 righe sopra la board) | **Corretto**: solo desktop |
| 6 | Home | «Ieri» | striscia di numeri: Settled · Expected in favour · Observed · Brier estimate · Brier market + «Full record» | titolo «Yesterday, won and lost», due blocchi vinte/perse e un elenco di partite vinte/perse | **Corretto**: striscia del prototipo; Brier della stima e del mercato al sigillo sulle STESSE righe appaiate (stessa regola del record), n dichiarato; niente elenco vinte/perse |
| 7 | Home | «What moved a price today» (notizie legate al prezzo) | 3 notizie con orario e movimento | assente | **Non mostrato di proposito**: nessun dato reale di notizie legate a una partita; si mostra la FAQ (stessa fonte del JSON-LD) |
| 8 | Partita | Grafico «since opening» | gradini + evento annotato («Kean ruled out · 11:40») + etichette dirette | gradini + etichette dirette, nessun evento | **Corretto**: evento vero annotato = il sigillo («Sealed · hh:mm», `pick_ledger.captured_at`), linea tratteggiata. Le notizie restano solo se il dato esiste |
| 9 | Partita | «More on today's board» | righe della board (tape, prezzo, mercato, stima, gap, book) | righe minime: ora, partita, gap | **Corretto**: stesse colonne della board con tape vero; niente chip del book (la CTA della pagina è una sola, nel passo 3) |
| 10 | Partita | Testata | titolo su carta, senza fascia | dentro la fascia navy | Lasciato: la fascia è la grammatica di tutte le altre pagine costruite; differenza dichiarata |
| 11 | Partita | Box «Alert · Free» accanto al passo 3 | presente | «Your book shows another price? Check it» | Lasciato: gli alert non sono live (Pricing lo dice: «Not live yet»); mostrarlo sarebbe una promessa |
| 12 | Books | Hero | fascia | fascia | **Aggiunto**: banner `partner-crowd` del kit (zona loghi lasciata al blocco partner sotto) |
| 12b | /predictions | Hero | fascia | fascia | **Aggiunto**: banner `hero-tennis` del kit (la home ha quello calcio) |
| 13 | Pricing | Hero | fascia «Free shows the gap. Pro shows why.» | fascia | **Aggiunto**: banner `hero-football` (la composizione del kit usa quella frase su quel banner) |
| 14 | Tutte | Marchio | lockup PNG | lockup SVG ufficiale (`public/brand/v3c/lockup.svg`) in header e footer | Già fedele (polish): verificato a occhio su ogni pagina |
| 15 | News lista | Colonna destra | blocco partner «Most moved today» | box «Match notes are coming» | Lasciato: richiede notizie legate al prezzo (nessun dato) e tocca il blocco partner (filone `live`) |
| 16 | Record | Struttura | KPI · affidabilità con n e IC · bin · settimane atteso/osservato · righe | stessa struttura, più ricca (tennis a parte, correzioni, ricevute) | Già fedele |
| 17 | Tools hub, tool | Struttura | gruppi per domanda, riga input → risultato, tabella «same maths on today's board» | uguale | Già fedele |
| 18 | Price check | Struttura | tre prezzi, tabella, scala, tool, best price | uguale (+ scelta partita, bankroll) | Già fedele |
| 19 | 404/500 | Illustrazioni del kit | — | «Out of play», «Lights flickered» (polish) | Già presenti; 404 verificato sulla build di produzione |
| 20 | Header 390 | «Sign in» | solo marchio + tema | marchio + Sign in + tema | Lasciato (account raggiungibile da mobile) |
| 21 | Leaderboard, community, invite, metodo, articolo | — | nessun prototipo | solo cornice v3c | Nessun confronto possibile |

## Dati
- Tape: `lib/v3c/tape.ts` (puro, testato) + `lib/v3c/tape-data.server.ts` (una SELECT su `partner_price_history`, `fetchTapeHistory`, ultime 72 h). In errore la board esce senza tape, mai con un tape inventato.
- «Ieri»: `fetchSealedDay` legge anche il mercato al sigillo (LEFT JOIN LATERAL su `prediction_log`, stessa regola di `SEALED_FOOTBALL_SQL`); `buildYesterday` aggiunge `brier: { n, estimate, market } | null` al contratto `v3.yesterday.1` (campo opzionale, additivo).
- Nessun «SAMPLE» nelle pagine v3c renderizzate (controllato sull’HTML di 11 rotte).

## Verifica (06/10, locale, finto Supabase)
- `tsc` 0 · eslint 0 errori/0 warning sui file toccati · vitest **251 file / 2986 test** (baseline 249 / 2979; +2 file: `lib/v3c/tape.test.ts`, `lib/v3c/yesterday-brier.test.ts`, +1 test board).
- Build flag OFF contro main ec106c52 (stesso ambiente, build fatte da me): **29/32 rotte identiche** (status, redirect, head SEO, JSON-LD, body, CSS; sitemap/robots md5). Le 3 diverse sono `/v3c`, `/v3c/lost`, `/v3c/tools/kelly-criterion/og.png`: 404 su entrambe, rotte che main non ha. Confronto fatto sul codice di b2e3fef4; dopo ho toccato solo file importati dalle pagine v3c (Banner, BoardFascia, fidelity.css, asset).
- Build flag ON verde (1 avviso font preesistente). Playwright sulla build: 17 rotte × 1440/390 × chiaro/scuro = 68 scatti, overflow 0, errori console 0 oltre alle richieste `/api/track` abortite apposta (72) e al 401 preesistente di /invite senza sessione.
- Lighthouse mobile (build ON, 2 giri, stessa macchina e mock) — baseline polish 5c790291 → fidelity: a11y 100 → **100** su home, board, partita, pricing, books. CLS 0 → **0**. LCP home 4,4 → **5,0 s**, board 4,7–4,8 → **4,9–5,1**, partita 4,8 → **4,8**, pricing 4,2–4,7 → **4,9–5,0**, books 5,1 → **5,2–5,4**. L'elemento LCP ora è il banner (AVIF 7–16 KB a 720 px, preload in testa, nessun doppio download): +0,2/0,6 s simulati dove c'è il banner. Senza banner su mobile l'LCP tornerebbe quello di prima: decisione di Andrea.

## Non fatto / non verificato
- Numeri veri: tutto visto sul finto Supabase. Le cifre del tape e del Brier di ieri vanno confrontate con SELECT sul DB vero (non eseguite: nessuna credenziale in questo worktree, regola del brief).
- Peso dei tape su /predictions con ~435 partite vere: misurato solo sul mock.
- «Ieri» non deduplica i gemelli espn/oddsapi (comportamento preesistente di `fetchSealedDay`): da allineare al record nel filone dati.
