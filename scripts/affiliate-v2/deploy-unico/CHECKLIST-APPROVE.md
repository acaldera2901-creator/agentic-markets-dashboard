# Deploy unico affiliati — checklist per Andrea (#AFFILIATE-PLATFORM-1022)

**Dove:** nel worktree del branch `integ/affiliate-platform-1022`, allo SHA approvato
(`git checkout <SHA>`). **Serve:** `vercel login` (team `betredge`), `gh auth`, `psql`/`pg_dump` ≥ versione del server,
un env file privato con `SUPABASE_DB_URL` (connessione diretta), `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ADMIN_SECRET` (+ `SHOPIFY_VARIANT_*` solo per gli orfani).
Ogni script: **dry-run di default**, `--esegui` per applicare, ti fa scrivere una frase di conferma,
stampa il rollback, verifica dopo, scrive il log in `~/deploy-unico-1022-log/` (700: contiene email clienti).
```bash
D=scripts/affiliate-v2/deploy-unico
E="--env-file /percorso/env.privato"
S=<SHA-approvato-di-40-caratteri>
export DEPLOY_APPROVED_SHA="$S"
export DEPLOY_RUN_ID="affiliate-$(date -u +%Y%m%dT%H%M%SZ)"
```

Riutilizza lo stesso run ID solo per questo rilascio/target. I marker scadono dopo
24 ore e non valgono se cambia SHA, progetto, sito o connessione DB. Le migrazioni
includono `20261023120000` (uscita/rientro e termini) e `20261023130000` (storni
anticipati persistenti). Quest'ultima richiede approvazione prima di applicarla.

I flag non segreti vengono letti dalle API del progetto Vercel, mai da `env run`
(che carica anche `.env` locali). Un flag `sensitive` non è verificabile: fermarsi,
riportare i nomi senza valori e concordare la normalizzazione dei soli flag.
Valori richiesti: payout `off`, accounting assente oppure `0`, hash secret assente;
mode `shadow` prima del rilascio e `live` soltanto al passo 7. Non rendere leggibili
chiavi, token o credenziali. La modifica delle env non aggiorna i deploy esistenti.


## 1. Leggi (5 min, niente scritture)
- `$D/00-letture.sh $E --sha $S` → **VERDETTO VAI / NON VAI** + condizioni. NON VAI = ti fermi lì.
- Guarda la sezione E: ordini orfani sì/no, e le righe `unresolved` senza marcatore valuta
  (se ci sono: controlla in Shopify Admin che siano in USD **prima** del merge).

## 2. Approvi (in `ch_deploy_gate`)
- `APPROVE #AFFILIATE-PLATFORM-1022` sullo SHA `$S` (PROPOSAL: `scratchpad/proposal-deploy-unico.md`).
- Separati, solo se servono: `APPROVE #SHOPIFY-ORPHANS-1022` (orfani oltre 30 gg) ·
  `APPROVE #SHOPIFY-CLAIM-1022` (hotfix #554, solo se il deploy unico slitta: `hotfix-b1.md`).

## 3. Esegui, in quest'ordine (prima senza `--esegui`, poi con)
| # | Comando | Frase | Se fallisce |
|---|---|---|---|
| 0 | `$D/passo0-backup.sh $E --esegui` | `BACKUP` | fermati; nulla è cambiato |
| 2 | `$D/passo2-migration.sh $E --sha $S --esegui` | `APPLICA MIGRATION AFFILIATE` | psql è una transazione unica: errore = nulla applicato. Se fallisce solo `migration repair`, rilancia il comando stampato. Verifiche KO dopo → **non** fare il merge, rollback stampato |
| 3 | `$D/passo3-env-terms.sh --esegui` | `TERMINI V3` | rimetti il valore precedente stampato. Fallo **subito prima** del 4 |
| 4 | `$D/passo4-merge.sh $E --sha $S --esegui` | `MERGE 553` | si rifiuta se main ≠ d78b5221, head ≠ $S, CI non verde, DB senza migration, termini non v3. Dopo il merge: rollback = promote del deploy precedente + `git revert` dello squash |
| 5 | `$D/passo5-deploy-verifica.sh $E --codice <CODICE_ATTIVO> --chiama-cron` | `CHIAMA CRON` | aspetta fino a 20 min il deployment READY dello SHA di merge nel progetto corretto, poi ~25 controlli. KO → **stop**, promote del deploy precedente |
| 6 | `$D/passo6-backfill-v3.sh $E --esegui` | `BACKFILL V3 N RIGHE` | rifiuto (righe in payout/con storni) → rettifica manuale (PROPOSAL passo 6). Rollback: il file `*-backfill-v3-rollback.sql` generato |
| 7 | `$D/passo7-mode-live.sh $E --esegui` | `AFFILIATE LIVE` | **ultimo**. Imposta `live` e redeploya. KO → `AFFILIATE_MODE` al valore stampato + promote del deploy stampato |
| 8 | `$D/passo8-notifica-v3.sh $E` | — | solo lettura: TSV dei destinatari; invii tu a mano e annoti data UTC + Message-ID |
| 9 | `$D/passo9-bo.sh $E --bo-dir <checkout BO> --bo-sha <SHA PR #2> --esegui` | `BO MERGE` | env BO prima del merge (così il deploy del BO le prende). Rollback: revert PR BO + `vercel env rm` |

Ordini orfani (dopo il 5, solo con il loro APPROVE): entro 30 gg → P-B1.2 della PROPOSAL;
oltre 30 gg → `npx tsx $D/recupera-ordini-orfani.ts $E` (anteprima), poi
`--esegui --gate SHOPIFY-ORPHANS-1022 --ordini id1,id2` (solo id verificati in Shopify Admin), conferma per ordine,
rollback con `--rollback <file.json> --esegui`.

## Regole se qualcosa va storto
- Un passo KO = **non** passi al successivo. Il messaggio dice cosa è stato toccato e il rollback.
- Prima del 4 tutto è compatibile col codice in produzione: puoi fermarti senza danni.
- Dopo il 4: il rollback del codice è il promote in Vercel (immediato); il DB resta (compatibile col codice vecchio).
- Niente push su `main` fra il 4 e il 5 verde. `AFFILIATE_HASH_SECRET` e `AFFILIATE_PAYOUTS` **non** si toccano oggi.

## Storni anticipati (1023)
Il webhook conserva il primo payload di ogni evento in `affiliate_reversal_inbox`.
Se manca la commissione, resta in attesa. Il cron reconcile ripassa al massimo 100
storni associabili per esecuzione, dopo il recupero delle commissioni; le righe con
rimborso in attesa non maturano. Duplicati non cambiano importo né generano due storni.
Le operazioni manuali conservano il comportamento immediato precedente.
Rollback del codice: lasciare tabella e funzioni additive, non cancellare eventi
in attesa; il blocco di maturazione protegge il saldo fino al replay. Un errore DB
prima del primo salvataggio continua a richiedere l'alert operativo e il recupero
con lo stesso event_ref. Non è un sistema di invio dei pagamenti.
