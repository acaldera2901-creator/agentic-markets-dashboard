# Hotfix B1 — Shopify `orders/paid` senza grant (#SHOPIFY-CLAIM-1022)

**Opzionale.** Serve solo se il deploy unico (#553) **non** va in produzione oggi e
`00-letture.sh` mostra ordini orfani (`stale`/`pending` dal 26/07). Se #553 va
oggi, il fix entra con lei: questa PR si chiude senza merge.

## La PR, già aperta (draft)
- **PR #554** `hotfix/shopify-b1-1022` → `main`, head `44e629d5`
  (https://github.com/acaldera2901-creator/agentic-markets-dashboard/pull/554).
- Contenuto: cherry-pick di `131a39c5` (gate di idempotenza senza `RETURNING`) e
  `2be41e61` (se la SELECT del gettone fallisce, si cancella solo la propria riga),
  più un commit di test (UUID fisso in `rail-hooks.test.ts`, come nel branch).
- **Nessuna migration, nessuna env, nessuna dipendenza dalle migration affiliate.**
  File: `app/api/shopify/webhook/route.ts` + 3 file di test.
- Conflitti risolti solo nei test: su `main` restano le aspettative di `main`
  (commissione al **netto**, la base lorda è v3 e arriva con #553); cambia solo il
  mock della SELECT del gettone. Nessun test dei rami v3 è stato portato.

## Verificato (locale, 22/10)
- `pg.integration.test.ts` su Postgres 18 usa e getta: 17/17 verdi. Il test B1
  (`exec_sql` vero: 1 grant, redelivery `duplicate`, 3 consegne concorrenti → 1 grant)
  **fallisce con la `route.ts` di `main`**: `{received:true,duplicate:true}`.
- vitest completa: 3609 verdi (17 saltati = PG senza URL). `tsc --noEmit` 0 errori.
  eslint 0 errori (1 warning preesistente: `describe` inutilizzato in `route.test.ts`).
- **Non verificato**: comportamento in produzione (la `exec_sql` di prod non è stata
  letta: Production Reads negato). Lo dice `00-letture.sh`, sezione E.

## Se Andrea lo vuole (gate: `APPROVE #SHOPIFY-CLAIM-1022` sullo SHA `44e629d5…`)
1. CI verde su #554 (GitHub). `gh pr ready 554` poi
   `gh pr merge 554 -R acaldera2901-creator/agentic-markets-dashboard --squash --delete-branch --match-head-commit <SHA completo>`.
2. Deploy automatico Vercel. Verifica (read-only): al prossimo ordine reale
   `SELECT event_id, status, last_error FROM shopify_events WHERE event_type='orders/paid' ORDER BY processed_at DESC LIMIT 5`
   → `granted` (non più `pending`→`stale`). Nessun modo di provarlo senza un ordine vero.
3. Rollback: `git revert <squash>` + PR, oppure promote del deployment precedente.

## Limiti — da sapere prima di scegliere
- **Non recupera gli ordini già persi.** Dopo il fix: entro 30 giorni → P-B1.2
  (UPDATE a `unresolved` + `shopify-reconcile`), oltre 30 giorni →
  `recupera-ordini-orfani.ts` (gate `#SHOPIFY-ORPHANS-1022`).
- **Sposta `main`.** Dopo questo merge `main` ≠ `d78b5221`: la #553 va ribasata (i
  due commit diventano vuoti), CI rifatta, **nuovo APPROVE** sullo SHA nuovo, e
  `passo4-merge.sh --main-atteso <nuovo main>`. Per questo, se il deploy unico è di
  oggi, conviene **non** usare il hotfix.
- Due push su `main` ravvicinati: Vercel annulla i deploy intermedi. Fra il hotfix e
  #553 aspettare il deploy verde del primo.
