# Passata di rifinitura v3c — `betredge/v3c-polish`

Branch locale `betredge/v3c-polish` (worktree `~/Desktop/01-BETREDGE/am-v3c-polish`), base `betredge/v3c-int` 79da258d. **Non pushato.** Aggiornato 06/10/2026 (ui-andrea).

## Come ho garantito che nulla scrivesse sul DB di produzione
- Il worktree non ha `.env*` con credenziali; la shell non ha variabili DB.
- Dev server e build locali girano con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399` = **finto Supabase** (`scripts/v3c/mock-db.ts`: righe FITTIZIE, conta gli statement non-SELECT → **0** a fine sessione) e con `NODE_OPTIONS=--require ./scripts/v3c/no-network.cjs`, che rifiuta ogni `fetch` lato server verso host non locali (bloccati: feed FortunePlay/YBets, ESPN, telemetria Next).
- Playwright e Lighthouse: `route.abort` / `--blocked-url-patterns` su `/api/track` e `/api/partner-click` (contati: 0 click partner, ogni `track` abortito) e su ogni host esterno.
- Kill solo sui PID avviati (`.polish-local/*.pid`), mai `pkill` generico.
- Conseguenza onesta: **nessun numero vero** è stato visto in questa passata. Squadre e giocatori nel mock hanno nomi veri per il layout; quote, probabilità ed esiti sono inventati.

## Fatto
1. **Una cornice sola.** `components/v3c/Chrome.tsx` (`SiteFrame`: barra, piè, barra in basso) per board, partita, record, tool e pagine di sito; `V3cChrome` la usa. Marchio ufficiale SVG (`public/brand/v3c/lockup.svg` via `<use>`, scritta navy/bianca per tema, ≥120 px). Nav: Board · Tools · Price check · Record · Books | News · Method · Pricing (le tre di sito spariscono sotto 1180 px e restano nel piè) + Sign in + tema; skip link. Piè: identità, Product/Trust/Account/Legal, 11 lingue (link hreflang sui tool, `LangSwitch` sulle altre), riga d'aiuto 18+, avvertenze, disclosure affiliati, impressum.
   **Helpline per paese: PUNTO D'INSERIMENTO** `HELPLINES_BY_COUNTRY` in `Chrome.tsx`, vuoto. Mostrati solo BeGambleAware e Gambling Therapy (link, nessun numero).
2. **Asset del kit** (copie pulite in `public/brand/v3c/…`, nessun hotlink): favicon STANDARD + apple-touch + manifest con maskable (`app/v3c/layout.tsx`, solo rotte v3c; la variante «small» non è usata); loader col marchio negli scheletri; 404 («Out of play», `app/v3c/not-found.tsx` + rewrite `fallback` → `/v3c/lost`, status 404 vero), errore («Lights flickered», `app/v3c/error.tsx` e stati d'errore board/partita/record), vuoto («Bench is empty», board vuota e record); sigillo grande `seal.svg` sul record e monogramma nel sigillo inline; targhetta Pro in /pricing; 11 icone tool (svgo, maschera CSS) al posto delle sigle + icone calcio/tennis nei filtri; OG per partita (`app/v3c/match/[id]/opengraph-image.tsx`, cifre dalla board vera, stesso esito guida) e per tool (`app/v3c/_og/tool-og.tsx`, esempio calcolato dal tool); selezione lime, scrollbar navy/filo lime, focus ring royal 2 px offset 3; freccia del marchio nelle CTA.
3. **Difetti:** FAQ home v3c senza «Base» (`lib/v3c/home-faq.ts`, visibile = JSON-LD; `lib/home-faq.ts` del sito di oggi intatto) e allineata a /pricing; ricevute del record deduplicate con la STESSA regola del record (`fetchTwinDroppedIds` → `NOT IN`, paginazione esatta, test); tool hub/pagine/OG con la **board vera** (ISR 300 s, SAMPLE solo come ripiego dichiarato), gap ed esito guida identici alla board; Kelly del price check = % grande + «€x di un bankroll di €y» con bankroll modificabile; book «Odds on site» in un blocco espandibile; «best» solo se strettamente più alto (partita, price check, board: «same at 2 books», niente CTA verso uno dei due); orario di cattura di ogni prezzo e dell'ultimo punto del grafico.
4. **A occhio** (mock, 1440/390, chiaro/scuro) — vedi tabella sotto. Corretti anche: conteggi chip home vs fascia («next 36 hours»), legenda tennis («tennis mostly the market price», prima diceva «model»), «News at hh:mm» letterale, esito guida di Books diverso dalla board, didascalia settimane del record, etichetta del grafico illeggibile sulla linea, input del price check su una riga a 390.
5. **Lighthouse** (mobile, build di produzione locale, mock): a11y **100** su home, board, partita, record, pricing, tool (corretto `label-content-name-mismatch` sul ponte tool). Perf 80–82, **LCP 4,7–5,0 s, CLS 0**. Sito attuale (build di main, stesso ambiente senza dati): perf 75, LCP 7,2–7,3 s, CLS 0,078 (home/predictions), tool 4,7 s. /predictions: payload compattato (`lib/v3c/board-pack.ts`, tabelle book/URL, andata e ritorno identica): −17% di RSC sul mock (2 book, URL corte); sui dati veri (435 partite, deep link lunghi) il risparmio è maggiore ma **non misurato**.
6. **Verifica:** `tsc` 0 · eslint 0 errori sui file toccati (1 warning preesistente in `lib/v3c/books.ts:78`) · vitest **249 file / 2978 test** (baseline 248/2970) · build flag OFF vs main ec106c52: **26/28 rotte identiche** (status, redirect, head SEO, JSON-LD, body, CSS per contenuto; sitemap/robots md5), le 2 diverse sono `/v3c` e `/v3c/lost` (404 su entrambi, rotte che main non ha) · build flag ON verde (1 avviso font preesistente).

| Pagina | Visto | Corretto |
|---|---|---|
| Home | 1440/390 chiaro+scuro | cornice, FAQ, chip «next 36 hours», icone sport, pari prezzo |
| /predictions calcio+tennis | 1440 chiaro/scuro, 390 scuro | legenda tennis, «same at 2 books», payload |
| /match con storico / senza / tennis | 1440 e 390 | blocco book, orari, etichetta grafico, OG |
| /price-check | 390 chiaro/scuro, 1440 | Kelly + bankroll, quote su una riga |
| /record | 1440 chiaro, 390 scuro | sigillo, ricevute senza doppioni, didascalia |
| /tools, Kelly, Margin, Parlay | 1440, 390 | icone, dati veri, gap = board, input 3 colonne |
| /pricing | 1440/390 | targhetta Pro, freccia CTA |
| /partners | 1440, 390 scuro | esito guida = board |
| /blog lista + articolo | 1440 (articolo fittizio) | titolo «Match notes» |
| /how-it-works, /leaderboard, /community, /invite | 1440, 390 scuro | solo cornice |
| 404 | 1440/390 chiaro+scuro | nuovo |
| /profilo | non rientra: gate `NEXT_PUBLIC_UX_NEW` spento → 404 | — |

## Non fatto / non verificato
- **Numeri veri**: nessuna pagina vista con dati di produzione (regola nuova). Coerenza fra pagine verificata sul mock e nel codice (stesso esito guida, stessi arrotondamenti).
- **Tennis, da guardare coi dati veri**: nella pagina partita di una riga `market_tempered` il titolo mostra il mercato (67%) e la tabella la stima servita (60%) — sul mock differiscono; con dati veri va verificato se coincidono, altrimenti è un'incoerenza da sistemare nel filone tennis.
- Sfondo login, barra di progresso con la freccia, header email: nessuna schermata v3c li ospita (login e checkout sono la Dashboard di oggi).
- Favicon: sulle rotte v3c Next aggiunge comunque `/favicon.ico` della root accanto al set v3c (il browser può scegliere l'una o l'altra); toglierlo cambierebbe il sito a flag spento.
- Lighthouse su /predictions con 435 partite vere; paginazione «per giorno» via `/api/v3/board` (riduzione maggiore) — proposta, non applicata.
- 9 lingue in fallback EN: chiavi nuove in `docs/redesign/v3c-f5-i18n-keys.md` (sezione polish).

## Serve da Andrea
1. Helpline per paese: chi le compila (legale-compliance) e con quale fonte.
2. OK a una paginazione per giorno di /predictions (dati via `/api/v3/board`).
3. Il cookie banner globale (mono, nero) stona con v3c: va ridisegnato nel suo filone?
4. Push del branch: solo presentazione + API in lettura, ma resta locale come da brief.

## File condivisi toccati
`components/v3c/v3c.css`, `components/v3c/Chrome.tsx`, `components/v3c/V3cChrome.tsx`, `components/v3c/BottomNav.tsx`, `components/v3c/Monogramma.tsx`, `components/v3c/Sigillo.tsx`, `lib/v3c/rewrites.ts` (+ `fallback`), `lib/v3c/queries.ts` (SELECT in più), `lib/v3c/copy.ts`, `lib/v3c/match-copy.ts`, `lib/i18n/v3c-tools/*`, `docs/v3c-i18n-keys.md`.

## Ripetere la verifica in locale
`npx tsx scripts/v3c/mock-db.ts &` poi `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 SUPABASE_SERVICE_ROLE_KEY=mock NEXT_PUBLIC_REDESIGN=1 NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs" npx next dev -p 3123`; nei test browser bloccare `/api/track` e `/api/partner-click`.

## Preview con dati reali — 06/10/2026 (programmatore-andrea)
Preview `betredge-b1jdakv57-betredge.vercel.app` (alias `betredge-git-betredge-v3c-polish-betredge.vercel.app`), redeploy di 543d7283 con `NEXT_PUBLIC_REDESIGN` solo Preview su questo branch.
- HTTP: 200 v3c su tutte le rotte del brief, 404 vero, /plans→308 /pricing, /history e /risultati→308 /record; betredge.com resta il sito vecchio.
- Tennis «market price only» (Akugue–Kostovic, Elo v4 ancorato al prezzo): testata 67% = mercato senza margine (non temperato), tabella «Estimate» 60% = stesso mercato con τ 1,68 (il numero servito e sigillato). La didascalia della testata diceva «temperature 1.68»: corretto in b387418e (non pushato), la τ ora è dichiarata accanto alla tabella.
- Coerenza board/partita/price check vs SELECT su prediction_log: Chicago–Vancouver 43/44/+0,9, Remo–Grêmio 40/42/+1,5, Internacional–Corinthians 28/29/+0,3, Gnistan–Inter Turku 25/23/−1,4: identici.
- Record: 2.047 sigillate (+1 rispetto al 2.046 atteso: un sigillo nuovo), 1.758 con esito, 1.603 appaiate, +0,0019 [−0,0006; +0,0043].
- Lighthouse mobile (preview vs betredge.com): home LCP 4,9 vs 7,4 s, board 5,2 vs 7,8, partita 4,9, record 4,5 vs 9,4 (/history, CLS 0,549); CLS v3c 0. HTML /predictions 728 KB (80 KB brotli) vs 49 KB oggi.
- Restano: «−0.0 pp» (zero negativo) su board/partita/price check; breadcrumb «Board › —» su partita tennis uscita dalla board senza torneo; og:image punta a `/v3c/...`.
