# Supabase Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrare tutto Agentic Markets su un unico backend Supabase, sostituendo Neon DB su Python backend e dashboard-web.

**Architecture:** Il progetto Supabase `xcgvfrsrcphzfctfyukz` diventa il database unico. Python backend (15 agenti) si connette via connessione diretta PostgreSQL porta 5432. Dashboard-web sostituisce `@neondatabase/serverless` con il package `postgres` (raw SQL, zero riscrittura delle query). Client-portal è già su Supabase (no change).

**Tech Stack:** Supabase PostgreSQL, SQLAlchemy asyncpg (Python), `postgres` npm (dashboard-web), `@supabase/ssr` (client-portal già fatto)

---

## Prerequisiti (credenziali da Supabase dashboard)

- `SUPABASE_DB_PASSWORD` → da `supabase.com/dashboard/project/xcgvfrsrcphzfctfyukz/settings/database`
- `SUPABASE_SERVICE_ROLE_KEY` → da `supabase.com/dashboard/project/xcgvfrsrcphzfctfyukz/settings/api`

Stringhe di connessione risultanti:
- **Python asyncpg**: `postgresql+asyncpg://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
- **Dashboard-web (serverless)**: `postgresql://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

---

## File da modificare

| File | Azione |
|------|--------|
| `agentic-markets/.env` | Aggiornare `DATABASE_URL` → Supabase asyncpg |
| `dashboard-web/.env.local` | Aggiornare `DATABASE_URL` + aggiungere Supabase keys |
| `dashboard-web/package.json` | Aggiungere `postgres`, rimuovere `@neondatabase/serverless` |
| `dashboard-web/lib/db.ts` | Creare helper condiviso con `postgres` package |
| `dashboard-web/app/api/*/route.ts` (8 file) | Importare da `lib/db.ts` invece di neon inline |
| `client-portal/.env.local` | Aggiungere `SUPABASE_SERVICE_ROLE_KEY` |
| Vercel env vars (dashboard-web) | Aggiornare `DATABASE_URL` via Vercel CLI |

---

## Task 1: Creare tabelle in Supabase (Python init_db)

**Files:** `agentic-markets/.env` (temp), `core/db.py` (read-only)

- [ ] **Step 1:** Salvare il DATABASE_URL attuale (Neon) come backup
- [ ] **Step 2:** Impostare temporaneamente `DATABASE_URL` Supabase nel `.env`
- [ ] **Step 3:** Eseguire `init_db()` per creare le 20+ tabelle Python in Supabase

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
# Eseguire con la nuova DATABASE_URL Supabase
python -c "
import asyncio
import os
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
from core.db import init_db
asyncio.run(init_db())
print('Tabelle create!')
"
```

Expected: `Tabelle create!` senza errori

- [ ] **Step 4:** Commit `.env` aggiornato (senza commettere la password in chiaro — usare variabile)

---

## Task 2: Creare tabelle dashboard-web in Supabase

**Files:** SQL da eseguire nel Supabase SQL Editor

- [ ] **Step 1:** Aprire `supabase.com/dashboard/project/xcgvfrsrcphzfctfyukz/sql`
- [ ] **Step 2:** Eseguire il seguente SQL:

```sql
-- match_predictions (dashboard-web)
CREATE TABLE IF NOT EXISTS match_predictions (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR NOT NULL UNIQUE,
  league VARCHAR NOT NULL,
  league_name VARCHAR NOT NULL,
  home_team VARCHAR NOT NULL,
  away_team VARCHAR NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  p_home FLOAT NOT NULL,
  p_draw FLOAT NOT NULL,
  p_away FLOAT NOT NULL,
  lambda_home FLOAT,
  lambda_away FLOAT,
  odds_home FLOAT,
  odds_draw FLOAT,
  odds_away FLOAT,
  edge FLOAT,
  best_selection VARCHAR,
  model_matches INT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  enrichment JSONB,
  home_score INT,
  away_score INT,
  match_status TEXT DEFAULT 'SCHEDULED',
  match_type TEXT
);

-- understat_cache
CREATE TABLE IF NOT EXISTS understat_cache (
  league VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- match_research
CREATE TABLE IF NOT EXISTS match_research (
  match_id VARCHAR PRIMARY KEY,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  email_hash TEXT UNIQUE,
  points INT DEFAULT 0,
  bets_won INT DEFAULT 0,
  bets_total INT DEFAULT 0,
  pnl FLOAT DEFAULT 0,
  last_bet_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- events (analytics)
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  country TEXT,
  language TEXT,
  plan TEXT,
  partner_id TEXT,
  value FLOAT DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- deposits (client-portal — già creata? verifica)
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS per deposits
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users see own deposits" ON deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users insert own deposits" ON deposits FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## Task 3: Creare lib/db.ts in dashboard-web

**Files:**
- Create: `dashboard-web/lib/db.ts`
- Modify: `dashboard-web/package.json`

- [ ] **Step 1:** Installare `postgres` package

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
npm install postgres
npm uninstall @neondatabase/serverless
```

- [ ] **Step 2:** Creare `lib/db.ts`

```typescript
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!DB_URL) return [];
  const db = postgres(DB_URL, {
    ssl: "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  try {
    return (await db.unsafe(sql, params as postgres.ParameterOrJSON<never>[])) as T[];
  } catch (e) {
    console.error("DB error:", String(e));
    return [];
  } finally {
    await db.end({ timeout: 5 });
  }
}
```

- [ ] **Step 3:** Commit

```bash
git add lib/db.ts package.json package-lock.json
git commit -m "feat: add shared postgres db helper, remove neon dependency"
```

---

## Task 4: Aggiornare routes dashboard-web

**Files da modificare** (tutti usano lo stesso pattern):
- `app/api/predictions/route.ts`
- `app/api/history/route.ts`
- `app/api/leaderboard/route.ts`
- `app/api/track/route.ts`
- `app/api/live/route.ts`
- `app/api/data/route.ts`
- `app/api/health/route.ts`
- `app/api/research/route.ts`
- `app/api/tennis/route.ts`
- `app/api/tennis-analysis/route.ts`
- `app/api/tennis-bets/route.ts`

Per ogni route che contiene questo pattern:

```typescript
// PATTERN DA RIMUOVERE (in ogni route)
const DB_URL = process.env.DATABASE_URL;
async function dbQuery<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    return ((await (db as any).query(sql, params)) ?? []) as T[];
  } catch (e) {
    console.error("DB error:", String(e));
    return [];
  }
}
```

Sostituire con:

```typescript
// PATTERN DA AGGIUNGERE (in testa al file)
import { dbQuery } from "@/lib/db";
```

- [ ] **Step 1:** Aggiornare ogni route (vedi sopra)
- [ ] **Step 2:** Verificare che nessun file importi più `@neondatabase/serverless`

```bash
grep -r "neondatabase" ~/Desktop/sistema-andrea/agentic-markets/dashboard-web/app/ --include="*.ts"
# Expected: no output
```

- [ ] **Step 3:** Build check

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
npx tsc --noEmit
```

Expected: 0 errori

- [ ] **Step 4:** Commit

```bash
git add app/api/
git commit -m "feat: migrate all dashboard-web routes to shared supabase db helper"
```

---

## Task 5: Aggiornare env files

**Files:**
- `agentic-markets/.env`
- `dashboard-web/.env.local`
- `client-portal/.env.local`

- [ ] **Step 1:** Aggiornare `agentic-markets/.env`

```bash
# Sostituire DATABASE_URL con Supabase (asyncpg, session pooler porta 5432)
# DATABASE_URL=postgresql+asyncpg://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

- [ ] **Step 2:** Aggiornare `dashboard-web/.env.local`

```bash
# DATABASE_URL (transaction pooler porta 6543 per serverless)
# DATABASE_URL=postgresql://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
# NEXT_PUBLIC_SUPABASE_URL=https://xcgvfrsrcphzfctfyukz.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
# SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
```

- [ ] **Step 3:** Aggiungere `SUPABASE_SERVICE_ROLE_KEY` a `client-portal/.env.local`

---

## Task 6: Aggiornare Vercel env vars

- [ ] **Step 1:** Aggiornare DATABASE_URL su Vercel per dashboard-web

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
vercel env rm DATABASE_URL production --scope agenticmarkets-cb-1025s-projects -y
echo "postgresql://postgres.xcgvfrsrcphzfctfyukz:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" | vercel env add DATABASE_URL production --scope agenticmarkets-cb-1025s-projects
```

- [ ] **Step 2:** Aggiungere Supabase keys su Vercel per dashboard-web

```bash
echo "https://xcgvfrsrcphzfctfyukz.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --scope agenticmarkets-cb-1025s-projects
echo "[ANON_KEY]" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --scope agenticmarkets-cb-1025s-projects
echo "[SERVICE_ROLE_KEY]" | vercel env add SUPABASE_SERVICE_ROLE_KEY production --scope agenticmarkets-cb-1025s-projects
```

- [ ] **Step 3:** Redeploy

```bash
vercel --prod --yes --scope agenticmarkets-cb-1025s-projects
```

---

## Task 7: Test end-to-end

- [ ] **Step 1:** Test Python backend

```bash
cd ~/Desktop/sistema-andrea/agentic-markets
python -c "
import asyncio
from core.db import AsyncSessionLocal
from sqlalchemy import text
async def test():
    async with AsyncSessionLocal() as s:
        r = await s.execute(text('SELECT COUNT(*) FROM bets'))
        print('Bets count:', r.scalar())
asyncio.run(test())
"
```

- [ ] **Step 2:** Test dashboard-web locale

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
npm run dev
# Aprire http://localhost:3000/api/predictions e verificare risposta
```

- [ ] **Step 3:** Test client-portal auth (già funzionante — verificare che login non sia rotto)

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/client-portal
npm run dev
# Aprire http://localhost:3001 e verificare login
```
