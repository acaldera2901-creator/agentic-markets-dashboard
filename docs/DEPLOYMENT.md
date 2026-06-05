# Deployment Guide — Agentic Markets

## Ambienti

| Ambiente | Supabase | URL | Quando |
|---|---|---|---|
| **Staging** | `xcgvfrsrcphzfctfyukz` (personale) | Vercel Preview URLs | Ogni push su branch feature |
| **Production** | `izscgffubtakzvwxchqt` (aziendale) | agentic-markets-roan.vercel.app | Solo dopo verifica su staging |

---

## Workflow standard

```
1. Crea branch  →  git checkout -b feature/nome-modifica
2. Sviluppa     →  modifica codice + schema staging se necessario
3. Push         →  git push origin feature/nome-modifica
4. Verifica     →  Vercel genera Preview URL → testa su staging DB
5. OK?          →  apri PR su main (o mergia direttamente)
6. Production   →  git push origin main → deploy automatico su prod
```

---

## Modifiche al DB (schema)

### Su Staging prima
```bash
export PGPASSWORD='PswCaldera22.'
STAGING_DB="postgresql://postgres:PswCaldera22.@db.xcgvfrsrcphzfctfyukz.supabase.co:5432/postgres"
psql "$STAGING_DB" -f supabase/migrations/nuova_migration.sql
```
→ Testa che il frontend Preview funzioni.

### Su Production solo se tutto OK
```bash
export PGPASSWORD='<SUPABASE_DB_PASSWORD>'
PROD_DB="postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_POOLER_HOST>:5432/postgres"
/opt/homebrew/opt/postgresql@18/bin/psql "$PROD_DB" -f supabase/migrations/nuova_migration.sql
```

---

## Credenziali rapide

### Staging (Supabase personale)
- **URL:** https://xcgvfrsrcphzfctfyukz.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/xcgvfrsrcphzfctfyukz
- **DB password:** PswCaldera22.

### Production (Supabase aziendale — Maven Agency)
- **URL:** https://izscgffubtakzvwxchqt.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/izscgffubtakzvwxchqt
- **DB password:** configurala localmente come secret, non committarla.
- **Connessione pooler:** `postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_POOLER_HOST>:5432/postgres`

---

## Note operative
- Non modificare mai direttamente `.env.local` (production) — cambia le env vars su Vercel
- Il backend Python usa sempre `DATABASE_URL` dal `.env` — punta a production
- Per testare Python localmente contro staging: cambia temporaneamente `DATABASE_URL` nel `.env`
- ⚠️ Manutenzione pooler eu-west-1: 1 giugno 2026 ore 14:00 (breve downtime)
