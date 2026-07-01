# PROPOSAL #FORTUNEPLAY-LIVE-ODDS-1 — Quote live FortunePlay + deep-link partita sulle card

**Origine:** piano `docs/superpowers/plans/2026-06-30-fortuneplay-live-odds.md`. Branch `feat/fortuneplay-live-odds`.
**Stato:** ✅ `APPROVE #FORTUNEPLAY-LIVE-ODDS-1` — Andrea, 2026-07-01.
Decisioni Andrea:
1. **Approvato.**
2. **Teniamo il deep-link** (la scommessa passa dal sito FortunePlay) — nessun fallback-a-landing per le partite nel feed. Env `SPORTSBOOK_FORTUNEPLAY_CODE`/`_URL` da settare da Andrea su Vercel col codice affiliate quando disponibile (finché vuoto, deep-link senza `?stag=`).
3. **Review legale del copy → prima del go-live del progetto** (non bloccante per merge/preview).

## Task
Mostrare la **quota live FortunePlay** sulle card (calcio/tennis/WC), con **value del modello vs quota FP**, e trasformare "Place bet" in un **deep-link alla pagina-partita** FortunePlay (con param affiliate), fallback al landing attuale.

## Approccio scelto
Endpoint server `GET /api/fortuneplay-odds`: **un solo** fetch della lista BetConstruct (TTL-cache 30s, cap 20 pagine) → quote indicizzate per `team_pair_key`. Il FE fa poll ~30s e fa merge sulle card. **Zero chiamate per-card.** Chiavi di join calcolate in TS su entrambi i lati (nessuna dipendenza dal path Python→DB). Degradazione pulita: partita non nel feed / endpoint down → card **identica a oggi** (landing link).

## COSA CAMBIERÀ ESATTAMENTE

| Voce | Dettaglio |
|---|---|
| File nuovi | `lib/tennis-names.ts`, `lib/team-pair-key.ts`, `lib/fortuneplay-live.ts`, `lib/fortuneplay-url.ts`, `lib/fortuneplay-board.ts`, `app/api/fortuneplay-odds/route.ts` + 6 test |
| File modificati | `app/app/page.tsx` (stato+poll+riga quota+bottone), `app/globals.css` (classi `.fp-odds-row/.fp-odds-label/.fp-odds-val/.fp-edge`) |
| Endpoint nuovo | `GET /api/fortuneplay-odds` (force-dynamic, ritorna `{ odds: { <team_pair_key>: {…, matchUrl, prefilled} } }`) |
| DB / migration | **nessuno** |
| Env da configurare su Vercel | `SPORTSBOOK_FORTUNEPLAY_URL` (default `https://www.fortuneplay.com`), `SPORTSBOOK_FORTUNEPLAY_CODE` (**il codice affiliate** — oggi vuoto) |
| Modello/prediction, scraper Python, adapter Stake/Roobet, registry multi-book | **INTOCCATI** |

**Prima → dopo (card):**
- Sotto il readout Mercato/Modello/Edge compare una riga `Quota FortunePlay <x.xx>` + pill `value <n>%` (solo se value>0), **solo card sbloccate/non-preview**.
- Bottone "Place bet": `onClick` apre `fp.matchUrl` (deep-link `/{locale}/sports/{slug}-{id}?stag=CODE`) quando la partita è nel feed; **altrimenti il landing attuale** (`mediaroosters.com/aacugmydl8`, invariato).

## Reversibilità / rollback
Revert del branch/PR. Nessuna migration, nessuno stato persistente. Se si azzera l'env o si spegne il route, le card tornano allo stato attuale (landing).

## Blast radius
Solo serving delle card nella tab "bets". Degradazione = **esattamente lo stato di oggi**. Nessun impatto su pagamenti/DB/auth.

## Piano di verifica (fatto finora)
- ✅ Build produzione OK, route `/api/fortuneplay-odds` compilato.
- ✅ 8/8 test TS verdi (tennis-names, team-pair-key, parse, fetch+TTL, url, board, sportsbooks-resolver, sportsbooks-books).
- ✅ Smoke test live: 430 partite parsate, quote decimali corrette, deep-link ben formati.
- ✅ **Pattern URL confermato** aprendo una partita reale su fortuneplay.com: il sito stesso usa `href="/it/sports/england-dr-congo-71068823"` → pattern `/{locale}/sports/{slug}-{id}` corretto.
- ⏳ **Visual check da loggato** (calcio/tennis/WC) della riga quota + degradazione — da fare prima del merge.

## ⚠️ PUNTI CHE SOLO ANDREA/FORTUNEPLAY POSSONO CHIUDERE (bloccanti go-live)
1. **Attribuzione affiliate del deep-link.** Il param BetConstruct è `stag` (da robots.txt). NON è confermato che un deep-link diretto `?stag=CODE` **attribuisca la commissione** — le reti spesso richiedono il passaggio dal redirect di tracking (il nostro link è lo short-link `mediaroosters`). **Da confermare dalla dashboard affiliate FortunePlay**: (a) formato deep-link ufficiale che preserva l'attribuzione, (b) valore del CODE/param. → poi setto `SPORTSBOOK_FORTUNEPLAY_CODE`/`_URL` su Vercel.
   - Finché non confermato: il deep-link migliora la UX (utente atterra sulla partita giusta) ma **l'attribuzione non è garantita**. Se preferisci zero rischio ricavo, si tiene `matchUrl = landing` finché non hai il formato ufficiale (1 riga nel route).
2. **OK legale sul copy** "value indicativo del modello vs quota FortunePlay" + disclaimer +18 → `legale-compliance`. Bloccante.

## Owner esecuzione
Andrea (via Claude Code) per merge + config env dopo APPROVE.

## Serve OK da
Andrea o Michele (`APPROVE #FORTUNEPLAY-LIVE-ODDS-1`) + `legale-compliance` (copy).
