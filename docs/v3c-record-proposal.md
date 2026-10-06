# PROPOSAL — F6 `/record`: il track record pubblico passa al registro sigillato

Stato: **NON eseguita.** Codice su branch `betredge/v3c-record`, dietro `NEXT_PUBLIC_REDESIGN`. Nessuna scrittura DB, nessun deploy, nessuna env in Production. Serve **APPROVE di Andrea** (cifre pubbliche) + parere di `legale-compliance` sul copy marcato ⚖.

## 1. Cosa cambia per l'utente

| | Prima (`/history`, oggi) | Dopo (`/record`, a flag acceso) |
|---|---|---|
| Fonte | `/api/v2/history` → `unified_predictions` | `pick_ledger` + `pick_settlement(_current)` (+ `prediction_log` solo per il mercato al sigillo) |
| Metrica di testa | hit-rate delle pick mostrate (`win_rate`, Wilson) | Brier della stima **affiancato** al Brier del mercato, ciascuno con IC 95%, + differenza con IC |
| Calcio/tennis | mischiati in una lista | separati: calcio = record; tennis = sezione a parte che dice che il numero sigillato è per lo più il mercato |
| Ricevute | won/lost per riga | vinte E perse con sigillo UTC, quota, mercato %, stima %, gap col segno, esito, impronta SHA-256 ricalcolabile |
| Correzioni | invisibili | sezione propria: prima → dopo, motivo, conteggio per causa |
| ROI / CLV / hit-rate | hit-rate presente | **assenti** |
| URL | `/history` 200, `/risultati` | `/history` e `/risultati` → **308** `/record` (query conservata); sitemap elenca `/record`; canonical `/record` |

A flag **spento** non cambia nulla: `v3cRedirects()` restituisce `[]`, `/record` e `/v3c/record` sono 404, sitemap invariata (test in `lib/v3c/record-f6.test.ts`, `app/v3c/v3c-routes.test.tsx`).

## 2. Numeri pubblicati (prima → dopo) — verificati con SQL indipendente il 06/10/2026

Query SELECT scritte a mano sul progetto Supabase `izscgffubtakzvwxchqt`, senza passare dal codice dell'app:

| Numero mostrato | Pagina | SQL indipendente | Esito |
|---|---|---|---|
| Stime calcio sigillate | 2,180 | 2180 | = |
| «On record since» | 14 Jun 2026 | min(captured_at) 2026-06-14 12:01 UTC | = |
| Calcio con esito | 1,888 | 1888 | = |
| Coppie con mercato al sigillo | 1,733 | 1733 | = |
| Brier stima | 0.6130 (IC 0.6005–0.6256) | 0.6130 (0.6005–0.6256) | = |
| Brier mercato | 0.6105 | 0.6105 | = |
| Differenza | +0.0025 | +0.0025 | = |
| Tennis sigillati | 2,982 | 2982 | = |
| Correzioni | 271 | 271 | = |

### ⚠ Da decidere prima del lancio: partite gemelle

La stessa SQL trova **134 coppie di righe gemelle** nella popolazione calcio (stesse squadre, kick-off a meno di 4 giorni, spesso stesso risultato: es. Botafogo–Grêmio 16/09, Sabadell–Andorra 03/10 e 04/10). È lo stesso fenomeno delle correzioni «twin fixture row». Non è un bug di F6: la popolazione è quella di `GET /api/v3/record` già esistente.

Contandole una volta sola (tenendo la riga col `source_id` minore):

| | Oggi | Senza gemelle |
|---|---|---|
| Calcio con esito | 1,888 | 1,754 |
| Coppie con mercato | 1,733 | 1,599 |
| Brier stima / mercato | 0.6130 / 0.6105 | 0.6134 / 0.6116 |
| Differenza (IC 95%) | +0.0025 (+0.0002 … +0.0049) | +0.0018 (−0.0006 … +0.0043) |
| Frase di verdetto | «The market is slightly better than ours» | **«On this sample the two cannot be told apart»** (lo sceglie il codice da solo: IC attraversa lo zero) |

Raccomandazione: dedup nella query del registro (sola lettura, nessuna migrazione) **prima** di accendere il flag in produzione; la frase cambia da sola. Owner: programmatore-andrea / ml-engineer-agentic. Serve APPROVE perché cambia cifre pubbliche.

## 3. Copy da approvare (EN fonte, IT completa — `lib/v3c/copy-record.ts`)

- ⚖ `record.kpi.verdict.market_better` — «The market is slightly better than ours. We publish it anyway.»
- ⚖ `record.kpi.verdict.tie` — «On this sample the two cannot be told apart. We publish it either way.»
- ⚖ `record.kpi.verdict.ours_lower` — «Ours is lower on this sample. A sample, not a promise.»
- `record.kpi.blend` — «Football estimate = 30% our model + 70% the market, margin removed.»
- ⚖ `record.tennis.lede` — «Most sealed tennis numbers are the market price, tempered. They are shown, never counted as ours.»
- ⚖ `record.receipts.recipeNote` — «The ledger stores no hash; this one is computed from the sealed fields, not at the seal.»
- ⚖ `record.receipts.noReturn` — «No return figure: it would not be independent of us.»

Elenco completo delle chiavi: `docs/v3c-i18n-keys.md` § `/record (F6)`.

## 4. Parere legale (preliminare, da confermare con `legale-compliance`)

- Nessun claim di performance (niente «battiamo il mercato», ROI, CLV, hit-rate): il verdetto è scelto dall'IC, non dal marketing, e dice quando il mercato è meglio. In linea con FTC/ASA (claim comparativi sostanziati) e DSA art. 25 (nessun dark pattern).
- ⚖ L'impronta SHA-256 è calcolata **ora** dai campi sigillati, non al momento del sigillo: il copy lo dice esplicitamente; non va presentata come «prova crittografica del sigillo». Se si vuole quel claim, serve un hash scritto al sigillo (migrazione, fuori F6).
- Le «gemelle» (§2) gonfiano n del 7%: pubblicare prima del dedup significa un n non corretto in una pagina che si chiama «record». Consiglio: dedup prima del lancio.

## 5. Change-spec

File (solo branch, nessuna esecuzione in prod): `app/v3c/record/page.tsx` (nuovo), `components/v3c/record/*` (nuovi), `components/v3c/record.css` (nuovo), `lib/v3c/{copy-record,receipts,record-data.server,record-view,record-f6.test}.ts` (nuovi), `lib/v3c/{contracts,queries,record,rewrites}.ts` (aggiunte), `next.config.ts` (spread di `v3cRedirects`), `app/sitemap.ts` (`/history`→`/record` solo a flag acceso), `components/v3c/{Chrome,V3cChrome}.tsx` (link nav `/record` — file condivisi, modifica di una riga), `docs/v3c-i18n-keys.md`.

DB: solo SELECT. `contracts.ts` aggiunge `estimate_ci95`/`market_ci95` opzionali a `V3RecordResponse` (additivo, `/api/v3/record` resta compatibile).

## 6. Rollback

Spegnere `NEXT_PUBLIC_REDESIGN` e ridistribuire: redirect e rewrite spariscono a build time, `/history` torna 200. Nessun dato da ripristinare. I 308 sono cacheati dai browser: se si teme un rollback, lanciare prima con `permanent: false` (307) per una settimana.

## 7. Verifica fatta (06/10/2026, dev server flag acceso)

- `tsc --noEmit` 0 errori · eslint file toccati 0 · vitest 239 file / 2870 test verdi (baseline preview 238 / 2849).
- Playwright 1440 e 390, chiaro e scuro, `/record`, `?sport=all`, `?sport=tennis`: overflow 0, 0 errori console, scatti guardati uno per uno.
- Lighthouse accessibility 100 (chiaro e scuro, emulazione mobile).
- `curl`: `/history` 308 → `/record`, `/risultati` 308 → `/record`, `/history?x=1` → `/record?x=1`, `/record` 200.

Non verificato: `next build` di produzione col flag acceso, preview Vercel, le altre 9 lingue (fallback EN, F10), `lib/app-tab-paths.ts` punta ancora a `/history` (a flag acceso un hop 308 in più: da riallineare in F10 o al lancio).
