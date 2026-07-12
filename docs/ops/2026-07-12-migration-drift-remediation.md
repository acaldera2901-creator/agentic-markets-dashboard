# Bonifica drift migration Supabase (progetto `izscgffubtakzvwxchqt`) — PROPOSAL

**Data:** 2026-07-12 · **Autore:** Andrea via Claude Code · **Stato:** PROPOSAL — da approvare (Tommy in council + gate Andrea) PRIMA di eseguire
**DB:** Supabase `izscgffubtakzvwxchqt` ("Agentic project") — **condiviso** (lane Andrea + Tommy)

## Perché ora
Scoperto durante SP3 mentre stavo per aggiungere 2 colonne consenso a `profiles`. Il singolo ALTER additivo è stato applicato **direttamente** (via MCP `apply_migration`, non `db push`) proprio per non innescare il drift. Ma il drift resta e va bonificato prima del prossimo `supabase db push`, altrimenti quel comando proverà a ri-eseguire migration già applicate → errori o modifiche inattese.

## Diagnosi (verificata read-only, 2026-07-12)
Confronto file locali `supabase/migrations/` ↔ storico remoto `schema_migrations`:
- **22 allineate** (versione identica locale/remoto).
- **19 remote-only** (applicate sul DB, senza file locale): `backoffice_affiliate_geo/touch_fn/click_stats` (3), `event_overview_stats_views`, `profile_plan_counts_view`, `bets_summary_view`, `activate_pending_profile*` (4), `soft_predictions*` (2), + le "gemelle" con timestamp diverso (sotto).
- **10 local-only** (file locale non nello storico remoto): di cui 8 sono **gemelle** delle remote-only con **timestamp diverso** (stessa migration logica, versione diversa): `paygate_orders` (loc `20260627130000` / rem `20260627231830`), `segments`, `crm_lifecycle`, `crm_marketing_opt_in`, `marketing_opt_in_at`, `paygate_claim_rpc`, `paygate_ipn_token`, `paypal_orders`; + 2 (`20260617_stripe_events`, `20260619_profiles_password_reset`).

**Punto chiave (verificato sul DB reale):** lo **schema è completo e corretto** — `stripe_events` esiste, le colonne reset di `profiles` esistono, tutte le gemelle sono già applicate. ⇒ **NESSUNA migration realmente pendente. Tutta la divergenza è solo bookkeeping** (la tabella `schema_migrations` e i nomi-file locali non concordano sulle versioni). Nessun dato o schema da cambiare.

## Causa radice
Il **backend-switch del 2026-06-05** (vedi `.backups/2026-06-05-backend-switch/`) ha ri-datato i file di migration locali; inoltre alcune migration (backoffice, viste, funzioni activate, soft_predictions) sono state applicate **direttamente** (MCP/dashboard) senza creare il file locale. Risultato: storico remoto e file locali divergono sulle versioni, pur avendo lo **stesso schema effettivo**.

## Vincolo di sicurezza NON negoziabile
La bonifica è **solo riconciliazione di bookkeeping**: **NON si deve MAI ri-eseguire o revertire DDL** (lo schema è già la verità). Nessun `DROP`, nessun replay. Snapshot/backup del DB prima. Finestra di manutenzione. DB condiviso ⇒ **OK di Tommy in council + gate Andrea** prima di toccare.

## Opzioni

### Opzione A — Baseline reset (consigliata, più pulita)
1. **Snapshot/backup** del DB (Supabase point-in-time o dump).
2. `supabase db pull` → genera **un baseline unico** che riflette lo schema reale attuale.
3. **Archiviare** i vecchi file in `supabase/migrations/_archive/` (non cancellare — audit).
4. Allineare `schema_migrations` al baseline (il pull gestisce il repair).
5. Verifica: `supabase migration list` mostra locale == remoto; `supabase db push` è un **no-op**.
→ *Pro:* un solo stato canonico d'ora in poi, elimina tutte le gemelle. *Contro:* perde la storia granulare (mitigato dall'archivio).

### Opzione B — Repair chirurgico
Per ogni versione disallineata: `supabase migration repair --status applied <versione-remota>` e/o `--status reverted <versione-locale-fantasma>`, + creare i file locali mancanti dalle DDL remote. `repair` tocca **solo** la tabella bookkeeping, non esegue DDL.
→ *Pro:* conserva la storia. *Contro:* ~29 operazioni, error-prone, va guidato dall'output di `supabase migration list`.

## Raccomandazione
**Opzione A** (baseline) — a rischio più basso e definitiva, dato che lo schema è la verità e le gemelle non aggiungono valore storico. Da eseguire in finestra concordata con Tommy, con snapshot prima.

## Verifica finale (entrambe le opzioni)
- `supabase migration list` → locale e remoto coincidono, 0 divergenze.
- `supabase db push --dry-run` → nessuna migration da applicare.
- Smoke test app (login/board) invariato.

## Gate
Medium/high su DB condiviso → **PROPOSAL in council per Tommy** + **APPROVE Andrea** prima di eseguire. Nulla si tocca finché entrambi non danno l'OK.
