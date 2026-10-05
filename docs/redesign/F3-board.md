# F3 — home e board v3c nel prodotto · cosa è fatto, cosa resta

Branch `betredge/v3c-board` (v3c-ds + v3c-data). Flag: `NEXT_PUBLIC_REDESIGN=1` **a build** (rewrite
in `next.config.ts` → `app/v3c/*`). Spento: `/` e `/predictions` invariati (HTML stessi byte e markup,
verificato su due build di produzione), `/v3c*` = 404.

## Fatto e verificato
- Home: fascia · board (12 righe) · banco tool · «Ieri» (vinte e perse dal registro sigillato) · FAQ visibile.
- `/predictions`: filtri sport · campionato · giorno, gruppo «Live now», cascata a vuoto, errore, scheletro.
- Dati: `buildBoardResponse` (lo stesso di `GET /api/v3/board`) e `/api/v3/yesterday`, lato server.
- Tennis: righe dal contratto attuale (`tennis[]`), nessun gap/mercato inventato.
- Copy EN+IT complete; chiavi per F10 in `docs/v3c-i18n-keys.md` (test che fallisce se ne manca una).

## Resta (con owner proposto)
1. **Merge del branch tennis** `betredge/v3c-tennis` quando avrà commit. La riga è già pronta: il contratto
   ha `market_p?` / `edge_pp?` OPZIONALI su `V3BoardTennisOutcome`; se arrivano, `TennisRow` disegna il
   punto mercato e il gap come nel calcio (test in `components/v3c/board/board.test.tsx`), altrimenti
   scrive «market comparison coming». Al merge: verificare che i nomi dei campi coincidano. — ui-andrea
2. **Free/Pro (F8, gated):** la board v3c mostra stima e gap di ogni partita a chiunque veda la pagina a
   flag acceso. Prima del cutover serve la proiezione per piano. — Andrea APPROVE
3. **`/predictions` pesa 675 KB di HTML** (65 KB gzip): 435 partite nel payload. Opzione: paginare per
   giorno lato server (`?day=`) o spedire le righe senza i link dei book e caricarli all'apertura. — ui-andrea
4. **FAQ**: due risposte descrivono ancora la card del desk di oggi («every card carries one number»).
   Riscriverle insieme al JSON-LD (unica fonte `lib/home-faq.ts`) in F9. — marketing-betredge
5. **Rotte di F4/F6**: «Price» punta a `/probability-view`, «Record» a `/history` (`V3C_ROUTES` in
   `components/v3c/V3cChrome.tsx`). Il tocco su una riga apre il pannello: la pagina partita è F4.
6. **Tracking partner**: usa `partner_click` esistente con `meta.surface = v3c_home|v3c_predictions`,
   `kind = chip|best_price`. Nessun nuovo evento in allowlist.
7. **Build locale**: `@playwright/test` è in package.json ma non nella `node_modules` condivisa → `tsc` e
   `next build` locali falliscono su `e2e/` e `playwright.config.ts` (22 errori, F1). Su Vercel l'install
   lo porta. Le build di verifica F3 sono state fatte spostando temporaneamente i due path.
8. Monogrammi senza colori club (nessun dato verificato) e tennis senza nazione: banda neutra, per scelta.
