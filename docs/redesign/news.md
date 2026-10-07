# Redesign v3c · News live da FotMob (branch `betredge/v3c-news`)

Debito accettato da Andrea il 05/10/2026 (rischio ToS/copyright, owner Andrea): vedi
`PIANO-COSTRUZIONE.md` «News da FotMob» e `legale/LAUNCH-BLOCKERS.md` R6/R7.
Questa versione **non usa il DB**: sostituisce la tabella `news_notes` di
`docs/v3c-news-proposal.md` con la cache di Next (nessuna migrazione da approvare).

## Come si accende
| Variabile (server) | Dove | Effetto |
|---|---|---|
| `NEWS_FOTMOB_ENABLED=1` | solo Preview | accende feed, riscrittura, note in pagina partita e «Most moved today». Assente/`0` = spento: nessuna richiesta a FotMob, nessuna chiamata LLM, /blog come prima |
| `ANTHROPIC_API_KEY` | Preview | riscrittura con Claude (`claude-opus-5-5`, effort low, output JSON). Senza chiave: ripiego «titolo di FotMob, non riscritto» + link |
| `NEWS_REWRITE_MODEL` | opzionale | altro modello |
| `NEWS_FOTMOB_FEED_URL`, `NEWS_REWRITE_API_URL` | solo test locali | puntano a `scripts/v3c/mock-news.ts` |

**Spegnimento:** togliere `NEWS_FOTMOB_ENABLED` (o metterla a `0`) e ridistribuire la preview: le pagine
tornano come prima. Nessun dato da cancellare (la cache Next si svuota col deploy, tag `v3c-news`).

## Guardrail, dove stanno
- Solo `https://www.fotmob.com/topnews/feed?format=rss`; robots.txt letto (cache 6 h) e rispettato; UA
  `BetRedgeNews/1.0 (+https://www.betredge.com/about; info@betredge.com)` — `lib/v3c/news/feed.ts`.
- Feed in cache 15 min (`unstable_cache`, anche l'errore: niente raffiche); al massimo 12 voci — `news.server.ts`.
- Una riscrittura per voce, per sempre (chiave = guid + modello + versione prompt); solo gli errori transitori
  (rete, HTTP) si ritentano, al massimo ogni 15 min per voce.
- Prompt: solo fatti dell'originale, niente aggiunte, niente scommesse/quote, ≤60 parole, EN+IT, «insufficient»
  se non c'è un fatto. Controllo meccanico dopo: lessico vietato, niente prezzi, nessuna sequenza di 6 parole
  copiata, titolo originale mai riprodotto — `rewrite.ts`. Le altre 9 lingue mostrano l'EN con «In English».
- Ogni nota: fonte, ora, «Leggi l'originale ↗» (`rel="nofollow noopener noreferrer"`), etichetta
  «Rewritten with AI from FotMob» (o «Headline from FotMob, not rewritten»), e info@ per la rimozione in 24 h.
- Nessuna immagine, nessun sottotitolo: `media:thumbnail` non viene mai letto (test).
- Partite: matching deterministico con alias (`teams.ts`), «News at hh:mm», mai «a causa di».

## Cosa resta / non verificato
- Il feed **non è in tempo reale**: 20 articoli editoriali (anteprime, analisi) in ~2 settimane, l'ultimo del
  02/10 alle 07/10. Nessuna categoria per lega né feed per lega/squadra nel feed: il filtro lega usa le leghe
  delle partite del board che la nota nomina.
- Riscrittura con Claude provata solo contro il finto endpoint locale: la forma della richiesta reale
  (`output_config.format`, `fallbacks: "default"`) non è stata verificata senza una chiave.
- In Preview Vercel oggi non c'è `ANTHROPIC_API_KEY` né `AI_GATEWAY_API_KEY` (verificato con `vercel env ls`).
- ToS FotMob («uso sistematico non consentito») e revisione legale prima di accendere: R7 di LAUNCH-BLOCKERS.
