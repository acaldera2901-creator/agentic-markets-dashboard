# Deployment Guide — Agentic Markets

## Ambienti

| Ambiente | Supabase | URL | Quando |
|---|---|---|---|
| **Staging** | `izscgffubtakzvwxchqt` (aziendale — stesso DB di prod) | Vercel Preview URLs | Ogni push su branch feature |
| **Production** | `izscgffubtakzvwxchqt` (aziendale) | agentic-markets-roan.vercel.app | Solo dopo verifica su staging |

> Dal 2026-06-05 il progetto personale `xcgvfrsrcphzfctfyukz` è dismesso: tutti gli ambienti
> puntano al progetto aziendale (org Maven Agency). Attenzione: staging e prod condividono il DB —
> gli account di test creati in Preview finiscono in `auth.users` di produzione.

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

### Applicare una migration (unico DB — aziendale)
```bash
export PGPASSWORD='<SUPABASE_DB_PASSWORD>'
PROD_DB="postgresql://postgres.izscgffubtakzvwxchqt:<SUPABASE_DB_PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
/opt/homebrew/opt/postgresql@18/bin/psql "$PROD_DB" -f supabase/migrations/nuova_migration.sql
```
→ Testa prima che il frontend Preview funzioni, poi verifica prod.

---

## Credenziali rapide

### Production + Staging (Supabase aziendale — Maven Agency)
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
