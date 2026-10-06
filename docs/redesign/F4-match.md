# F4 — pagina partita `/match/[id]` e `/price-check` · cosa è fatto, cosa resta

Branch `betredge/v3c-match` (da `betredge/v3c-preview`). Flag `NEXT_PUBLIC_REDESIGN=1` a build: rewrite
`/match/:id` → `app/v3c/match/[id]`, `/price-check` → `app/v3c/price-check`. Spento: i due URL non
esistono (404 di sempre) e le pagine v3c rispondono 404 (`v3cProductOn()`), test in `app/v3c/v3c-routes.test.tsx`.

## Fatto e verificato (06/10)
- Pagina partita in 3 passi: 1) mercato → stima (70/30 dichiarato) → gap, margine, nastro, tabella esiti;
  2) il perché: storico prezzi (solo punti catturati, nessuna curva inventata; 0 punti = riquadro vuoto
  dichiarato, 1 punto = «One price so far»), eventi, sigillo con link al record, tool EV·Kelly·Margin
  precompilati; 3) best price SOLO qui: N book, con quota o «Odds on site» (link reali da `lib/affiliate.ts`).
- Tennis: tutto ciò che dà il contratto v3.board.2; gap solo dove c'è (oggi nessuna partita lo ha).
- `/price-check`: scegli la partita o digita le quote; implied, margine, mercato senza margine, stima e gap;
  riga «Your X is already at or above every connected book» se il prezzo digitato batte i book.
- Price check è voce di menu («Price check») e riga nel hub Tools.
- Stati: scheletro, errore, 404 con fascia v3c («No match here», status 404 vero).
- tsc 0, eslint 0 sui file toccati, vitest 240 file / 2869 test (baseline 238 / 2849).
- Playwright 1440/390 chiaro/scuro su 6 pagine (calcio con storico, senza storico, 1 cattura, tennis,
  404, price check): overflow 0, 0 errori console (sul 404 solo il 404 del documento, atteso).
- Lighthouse a11y 100 su partita calcio, tennis, price check (chiaro e scuro). Il 404 non è misurabile
  da Lighthouse (rifiuta documenti con status 404).
- SQL indipendente (partner_price_history, Gnistan–Inter Turku): FortunePlay 98 catture, pareggio 3.45;
  YBets 3.51; prima cattura 27/09 16:02 UTC = come in pagina.

## File condivisi toccati (aggiunte minime)
`V3cShell.tsx` (prop `boot`, per il not-found), `V3cChrome.tsx` (rotta Price → /price-check, prop `boot`),
`Nastro.tsx` (prop opzionale `gap`: il nastro mostra lo stesso gap della pagina, prima diceva «gap −2»
accanto a «in line −1.5»), `board/BoardRow.tsx` (link «The match →» nel pannello), `copy.ts` (1 chiave),
`rewrites.ts` (2 rewrite), route `line-movement` (logica spostata in `lib/v3c/line-movement-service.ts`, stesso contratto).

## Resta / decisioni
1. **11 book «Odds on site»** sotto i 2 con quota: la lista è lunga, soprattutto a 390. Opzione: mostrare
   i book con quota + «altri 11 book» espandibile. — Andrea decide
2. **Free/Pro (F8)**: stima e gap visibili a chiunque a flag acceso, come la board. — Andrea APPROVE
3. **Kelly nel price check** mostra «€2» su un bankroll di default €500 (default del tool F5): valutare
   se mostrare solo la %. — ui-andrea
4. **Grafico vs best price**: il grafico finisce all'ultima cattura dello storico, il best price è la
   lettura più recente della board: possono differire di qualche centesimo (tennis visto: 1.57 vs 1.60).
5. 9 lingue in fallback EN: chiavi nuove in `docs/v3c-i18n-keys-match.md` (F10).
6. Pagine partita `noindex, follow` finché F9 non decide la SEO per partita.
