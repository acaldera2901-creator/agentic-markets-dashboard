# Redesign v3c · News live da FotMob (branch `betredge/v3c-news` → `betredge/v3c-news2`)

Debito accettato da Andrea il 05/10/2026 e il 07/10/2026 (rischio ToS «uso automatico sistematico»,
copyright e diritto degli editori; owner Andrea): vedi `PIANO-COSTRUZIONE.md` «News da FotMob» e
`legale/LAUNCH-BLOCKERS.md` R6/R7. **Non usa il DB**: cache di Next al posto della tabella
`news_notes` di `docs/v3c-news-proposal.md` (nessuna migrazione da approvare).

## news2 (07/10): la pagina, non solo il RSS
Il RSS `https://www.fotmob.com/topnews/feed?format=rss` porta ~20 articoli editoriali (l'ultimo del
02/10 letto il 07/10): non sono notizie fresche. Le notizie fresche stanno su
`https://www.fotmob.com/en/news` (`/it/news` incorpora la stessa lista inglese).

**Com'è fatta la pagina (misurato 07/10, GET fra 10:35 e 10:52 UTC):** documento Next.js
pages-router; la lista **non** è nel markup HTML ma nel JSON incorporato
`<script id="__NEXT_DATA__">`, in `props.pageProps.fallback["/api/worldnews?lang=en&page=1"]`:
20 voci con `id`, `title`, `lead` (solo alcune), `gmtTime` (ISO assoluta), `sourceStr` (FotMob, SI,
The Analyst), `page.url` (relativa su fotmob.com o assoluta verso l'editore), `imageUrl`,
`sourceIconUrl`. Nessuna lega/categoria. Leggiamo il JSON dalla pagina scaricata: **mai** `/api`.
**Freschezza:** voce più recente 6 min, mediana 7,6 h, la più vecchia 14,3 h; 8 voci nelle ultime 2 h
(≈35–40 al giorno). Fra le letture a 10:35, 10:42, 10:49, 10:52: 0 voci nuove (arrivano a grappoli
dopo le partite).

## Come si accende
| Variabile (server) | Dove | Effetto |
|---|---|---|
| `NEWS_FOTMOB_ENABLED=1` | solo Preview | accende pagina+RSS, riscrittura, note in pagina partita e «Most moved today». Assente/`0` = spento: nessuna richiesta, nessuna chiamata LLM, /blog come prima (solo guide) |
| `ANTHROPIC_API_KEY` | Preview | riscrittura diretta con Claude **Haiku 4.5** (`claude-haiku-4-5`) |
| oppure `AI_GATEWAY_API_KEY` | Preview | stessa riscrittura via Vercel AI Gateway (`anthropic/claude-haiku-4.5`) |
| oppure `NEWS_REWRITE_PROVIDER=gateway` | Preview | AI Gateway **senza chiave**, col token OIDC del deployment (OIDC attivo sul progetto `betredge`, verificato 07/10). Serve credito AI Gateway sul team |
| `NEWS_REWRITE_MODEL` | opzionale | altro modello (id Anthropic o id Gateway) |
| `NEWS_FOTMOB_PAGE_URL`, `NEWS_FOTMOB_FEED_URL`, `NEWS_REWRITE_API_URL` | solo test locali | puntano a `scripts/v3c/mock-news.ts` |

Senza nessuna credenziale LLM: **nessuna richiesta a FotMob** e la pagina dice «news in arrivo» con le
guide (decisione di Andrea: mai un titolo originale senza riscrittura).

**Spegnimento:** togliere `NEWS_FOTMOB_ENABLED` e ridistribuire. Nessun dato da cancellare (tag cache `v3c-news`).

## Guardrail, dove stanno
- Fonti: pagina `/en/news` (`lib/v3c/news/page.ts`) prima, RSS (`feed.ts`) seconda; unione senza doppioni per
  guid / link / id topnews / titolo normalizzato, ordinate per data, max 20.
- robots.txt letto (cache 6 h) e rispettato per ogni path; `/api` rifiutato nel codice (`assertNotApi`) anche se
  robots lo permettesse. UA `BetRedgeNews/1.0 (+https://www.betredge.com/about; info@betredge.com)`.
- Frequenza: UNA GET per fonte per rinfresco — pagina ogni 10 min, RSS ogni ora (`unstable_cache`, condivisa fra
  le istanze; anche l'errore è in cache). Per istanza: 4xx/5xx/429/rete → attesa 10, 20, 40 … min (max 6 h, o il
  `Retry-After` se più lungo). 403 / challenge Cloudflare / pagina senza dati → la fonte **si spegne da sola**
  sull'istanza, `console.error` con l'istruzione, la pagina mostra «fonte in pausa». Nessun aggiramento.
- Riscrittura una volta per voce (chiave guid + modello + versione prompt `v2`); solo gli errori HTTP/rete si
  ritentano, al più ogni 15 min. Prompt: solo fatti (chi/cosa/quando/dove), ≤60 parole, EN+IT, niente quote,
  scommesse o claim. Controllo meccanico dopo (EN **e** IT): lessico vietato (anche stake/profit/free bet/bonus/
  vincite), niente prezzi, nessuna sequenza di 6 parole uguale a titolo o lead, titolo mai riprodotto.
  Ciò che non passa **non si mostra**.
- Ogni nota: fonte originale («SI via FotMob»), ora, «Read the original ↗» (`nofollow noopener noreferrer`),
  «Rewritten with AI from <fonte>», info@ per la rimozione in 24 h. Nessuna immagine, icona o sottotitolo.
- Partite: matching deterministico con alias (`teams.ts`), «News at hh:mm», mai «a causa di». Filtro per lega
  dalle squadre del board che la nota nomina (la fonte non dà la lega; lo sport è sempre calcio).

## Costo stimato della riscrittura
Haiku 4.5: $1 / $5 per MTok. Per nota ≈ 600 token in (prompt di sistema + voce) e ≈ 250 out (JSON EN+IT):
≈ $0,0006 + $0,00125 ≈ **$0,002 a nota** → ~40 note/giorno ≈ **$0,08 al giorno** (~$2,4/mese). Via AI Gateway
stesso listino (regionale +10%).

## Cosa resta / non verificato
- La riscrittura reale (Anthropic o Gateway) non è stata chiamata: nessuna chiave in locale. Forma della
  richiesta verificata solo contro il finto endpoint; passaggio di `output_config.format` attraverso il Gateway
  non verificato (il parser accetta anche JSON in un blocco ```json, mai prosa).
- Credito AI Gateway del team non verificabile in sola lettura (402/403 `customer_verification_required` se manca).
- Il blocco è persistente per istanza; fra istanze vale la cache condivisa (lo stato «bloccato» resta in cache
  10 min, poi al massimo un nuovo tentativo) finché qualcuno non spegne `NEWS_FOTMOB_ENABLED`.
- ToS FotMob e revisione legale prima di accendere fuori da Preview: R7 di LAUNCH-BLOCKERS.
