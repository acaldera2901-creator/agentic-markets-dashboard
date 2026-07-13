# Runbook DB — backup, restore, staging (BetRedge / Supabase `izscgffubtakzvwxchqt`)

> #GOLIVE-HIGH: creato dall'audit go-live 2026-07-13 (finding "staging condivide il DB di
> produzione e non esiste alcuna procedura di backup/rollback documentata").
> Il DB contiene dati di clienti PAGANTI (`profiles.plan`, `paygate_orders`): trattarlo come prod a tutti gli effetti.

## 1. Backup — stato e verifica (da fare UNA volta, poi trimestrale)

- L'org Supabase (Maven Agency) è su piano **Pro** → include **daily backups** con retention 7 giorni.
  Verifica: Dashboard → Project `izscgffubtakzvwxchqt` → Database → Backups.
  - [ ] Confermare che i daily backup esistano e siano recenti (colonna "Created at").
  - [ ] Valutare upgrade a **PITR** (Point-in-Time Recovery, add-on): granularità 2 min vs 24h.
    Con soldi veri nel DB, 24h di perdita massima è il compromesso attuale — accettato finché
    i volumi sono bassi, da rivedere al crescere degli ordini/giorno.
- Backup manuale on-demand (prima di migration rischiose — vedi §3):
  ```bash
  # dal pooler prod (connection string in Vercel env / 1Password — MAI committarla)
  pg_dump "$SUPABASE_DB_URL" --schema=public --format=custom \
    --file="backup-$(date +%Y%m%d-%H%M).dump"
  ```

## 2. Restore — procedura (testarla su un progetto scratch PRIMA di averne bisogno)

1. **Da dashboard** (preferito): Database → Backups → Restore. ⚠️ Ripristina l'INTERO DB
   allo snapshot: le scritture successive (ordini!) vanno riconciliate a mano — esporta prima
   `paygate_orders`/`profiles` correnti se il danno è circoscritto a una tabella.
2. **Chirurgico da dump manuale** (tabella singola):
   ```bash
   pg_restore --data-only --table=<tabella> backup-YYYYMMDD.dump | psql "$SUPABASE_DB_URL"
   ```
3. Dopo ogni restore: girare `/api/cron/paygate-reconcile` a mano (con CRON_SECRET) per
   riallineare i grant, e verificare `paid AND granted_at IS NULL = 0`.
- [ ] **Drill**: eseguire un restore di prova su progetto Supabase scratch e annotare qui il tempo.

## 3. Migration — disciplina

- Ogni migration va nel repo (`supabase/migrations/`) — mai SQL a mano non versionato
  (lezione: drift `weekly_pick_orders`, tabella nata fuori dalle migration).
- Prima di migration DISTRUTTIVE (DROP/ALTER di colonne con dati): backup manuale §1.
- Apply su prod SOLO con APPROVE (deploy-gate). Le migration marcate `GATED` in testa
  aspettano APPROVE esplicito.

## 4. Staging vs produzione — rischio attuale e rimedio

**Stato attuale (rischio accettato SOLO temporaneamente):** i deploy **Preview** Vercel
condividono il DB di prod E hanno `SUPABASE_SERVICE_ROLE_KEY` nelle env Preview →
qualunque branch, anche sperimentale, può scrivere senza limiti sui dati dei clienti.

**Rimedio raccomandato (in ordine di costo):**
1. **Togliere `SUPABASE_SERVICE_ROLE_KEY` (e `SUPABASE_URL`) dalle env Preview** —
   le preview perdono l'accesso al DB (le route API rispondono 503 fail-closed via
   `getSupabaseAdminClient() → null`). Le preview servono per UI/CSS; il login in preview
   è già rotto da tempo (env NEXT_PUBLIC non wired) quindi la perdita funzionale è minima.
   ⚠️ GATED: cambia il comportamento delle preview → APPROVE prima di rimuovere.
2. **Supabase Branching** (feature Pro): branch DB effimero per le preview con dati seed —
   da valutare quando il flusso di sviluppo lo giustifica.
3. Progetto Supabase staging separato con seed sintetico (costo gestione più alto).

## 5. Env critiche (riferimento rapido)

Vedi `.env.example` (completo dal 2026-07-13). Spegnimento d'emergenza pagamenti:
`NEXT_PUBLIC_PAYGATE_ENABLED=false` + redeploy (il server rifiuta con 503, il client
nasconde i bottoni — kill-switch server-side attivo dal #GOLIVE-QW-B).
Alerting cron: settare `ALERT_WEBHOOK_URL` (vedi `lib/ops-alert.ts`).
