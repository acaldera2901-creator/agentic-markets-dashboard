# Backend Schema Redesign — Agentic Markets

**Data:** 2026-06-06 · **Stato:** approvato (design) · **Owner:** Andrea
**Ispirazione:** progetto Supabase `hotlist` (org Maven) — core normalizzato con FK, snapshot append-only, RLS come unico access control, enum nativi.

---

## 1. Contesto e obiettivi

Oggi il backend è split su due DB (Neon per la pipeline Python, Supabase per il frontend) con ~30 tabelle, di cui 10+ vuote, naming incoerente (`match_id` / `match_external_id` / `external_event_id`), 4 tabelle sovrapposte per le predizioni, zero FK, enrichment jsonb senza schema, RLS quasi assente e un RPC `exec_sql` esposto come canale di lettura.

**Obiettivo:** un solo DB Supabase (progetto "Agentic project", org Maven, `izscgffubtakzvwxchqt`) con **19 tabelle**, FK reali, enum nativi, RLS completa, una sola cartella di migrations. Copertura: core predizioni multi-sport, utenti/piani/pagamenti, bets+risk (dormiente al lancio), learning snellito, analytics/observability.

**Approccio scelto (A):** core unificato sport-agnostic (`events`, `odds_snapshots`, `predictions`) + tabelle detail sottili per sport. Football e tennis condividono pipeline, settlement e frontend; aggiungere uno sport = 1 tabella detail + seed.

## 2. Convenzioni

- `snake_case`; ID esterni **sempre** `external_id` + colonna `source` (es. `api_football`, `espn`, `odds_api`), con `UNIQUE(source, external_id)`.
- Ogni tabella: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (salvo log ad alto volume: `bigint GENERATED ALWAYS AS IDENTITY`), `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, trigger `moddatetime` su `updated_at`.
- Enum Postgres nativi per gli stati; `numeric` per soldi/quote; `timestamptz` ovunque.
- Snapshot **append-only** (mai UPDATE): `odds_snapshots`, `prediction_log`, `bankroll_snapshots`, `tracking_events`.
- `jsonb` consentito solo per: snapshot di features di modello, multipliers di rischio, meta di analytics. Mai per dati di business interrogabili dal frontend.
- Scritture: solo `service_role` (pipeline Python via asyncpg + API routes server-side). Il client pubblico legge direttamente le tabelle con anon/authenticated key sotto RLS. L'RPC `exec_sql` viene eliminato.

## 3. Enum

```sql
create type event_status      as enum ('scheduled','live','finished','cancelled');
create type prediction_status as enum ('pending','won','lost','void','pushed');
create type bet_status        as enum ('pending','won','lost','void');
create type bet_mode          as enum ('paper','live');
create type plan              as enum ('free','pending_payment','base','premium','admin');
create type payment_status    as enum ('pending','confirmed','failed','refunded');
```

## 4. Core sportivo

```sql
-- Lookup sport (seed: football, tennis)
create table sports (
  key   text primary key,          -- 'football' | 'tennis'
  title text not null
);

-- Leghe / tornei. predictability = profilo analitico mantenuto dalla pipeline
-- (ex league_profiles: strength_tier, market_efficiency, recommended_edge_min…)
create table competitions (
  id             uuid primary key default gen_random_uuid(),
  sport_key      text not null references sports(key),
  source         text not null,
  external_id    text not null,
  name           text not null,
  country        text,
  tier           integer,
  predictability jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (source, external_id)
);

-- Evento generico: football (squadre) e tennis (giocatori in home/away).
-- Settlement: score + status scritti qui dal settlement agent.
create table events (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  source         text not null,
  external_id    text not null,
  home_name      text not null,
  away_name      text not null,
  starts_at      timestamptz not null,
  status         event_status not null default 'scheduled',
  home_score     integer,
  away_score     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (source, external_id)
);
create index idx_events_starts_at on events (starts_at);
create index idx_events_status    on events (status);

-- Detail 1:1 per sport (proprietà dell'evento, non output di modello)
create table football_event_details (
  event_id uuid primary key references events(id) on delete cascade,
  venue    text,
  round    text,
  is_derby boolean default false
);

create table tennis_event_details (
  event_id uuid primary key references events(id) on delete cascade,
  surface  text,            -- clay | grass | hard
  tour     text,            -- atp | wta | challenger
  round    text,
  best_of  integer
);

-- Storico quote, append-only (pattern hotlist)
create table odds_snapshots (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references events(id) on delete cascade,
  bookmaker   text not null,
  market      text not null,         -- h2h | totals | …
  selection   text not null,         -- home | away | draw | over | under
  price       numeric not null,
  line        numeric,
  captured_at timestamptz not null default now()
);
create index idx_odds_event on odds_snapshots (event_id, market, selection, captured_at desc);

-- Predizione corrente servita: 1 riga per (evento, modello), upsert.
-- p_draw NULL per il tennis. Sport-specific (Elo, serve form, xG, lambda)
-- in feature_snapshot.
create table predictions (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  model_key        text not null,        -- 'football-dc' | 'football-worldcup' | 'tennis-elo'
  model_version    text not null,
  p_home           numeric not null,
  p_draw           numeric,
  p_away           numeric not null,
  pick             text,                 -- home | away | draw | over | under | NULL (no value)
  pick_price       numeric,
  edge_pct         numeric,
  confidence       integer,              -- 1-10
  status           prediction_status not null default 'pending',
  is_published     boolean not null default false,
  plan_access      plan not null default 'free',
  feature_snapshot jsonb,
  computed_at      timestamptz not null default now(),
  settled_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, model_key)
);
create index idx_predictions_published on predictions (is_published, status);

-- Audit immutabile di ogni predizione servita al client (calibrazione su
-- ciò che l'utente ha visto davvero). Solo service_role.
create table prediction_log (
  id            bigint generated always as identity primary key,
  prediction_id uuid references predictions(id) on delete set null,
  event_id      uuid not null,
  model_key     text not null,
  model_version text not null,
  p_home        numeric, p_draw numeric, p_away numeric,
  pick          text,
  pick_price    numeric,
  edge_pct      numeric,
  served_at     timestamptz not null default now(),
  result        text,
  settled_at    timestamptz
);

-- Stato del modello tennis (invariata rispetto a oggi)
create table elo_ratings (
  player     text primary key,
  overall    numeric not null,
  clay       numeric,
  grass      numeric,
  hard       numeric,
  updated_at timestamptz not null default now()
);
```

## 5. Bets e risk (dormiente al lancio)

```sql
-- Una sola tabella per tutti gli sport (fonde bets + tennis_bets).
-- pnl valorizzato al settlement (oggi sempre NULL: bug noto).
create table bets (
  id            uuid primary key default gen_random_uuid(),
  prediction_id uuid references predictions(id),
  event_id      uuid not null references events(id),
  mode          bet_mode not null default 'paper',
  selection     text not null,
  price         numeric not null,
  stake         numeric not null,
  status        bet_status not null default 'pending',
  pnl           numeric,
  external_ref  text,                 -- id bookmaker/exchange se live
  placed_at     timestamptz not null default now(),
  settled_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Audit Kelly / circuit breaker
create table risk_decisions (
  id            uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references predictions(id),
  approved      boolean not null,
  final_stake   numeric,
  multipliers   jsonb,                -- fattori compositi (kelly, drawdown, variance…)
  circuit_level integer,
  skip_reason   text,
  created_at    timestamptz not null default now()
);

-- Fonde bankroll_history + variance_budget_log, append-only
create table bankroll_snapshots (
  id            bigint generated always as identity primary key,
  bankroll      numeric not null,
  peak_bankroll numeric not null,
  drawdown      numeric not null,
  circuit_level integer not null default 0,
  variance      jsonb,                -- budget varianza settimanale
  recorded_at   timestamptz not null default now()
);
```

## 6. Utenti, piani, pagamenti

```sql
-- Server-authoritative, login passwordless via email (modello attuale conservato)
create table profiles (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  name           text,
  plan           plan not null default 'free',
  requested_plan plan,
  language       text default 'en',
  timezone       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ex deposits; tx_hash si sposta qui da profiles
create table payments (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  amount       numeric not null,
  currency     text not null default 'USD',
  method       text,
  tx_hash      text,
  status       payment_status not null default 'pending',
  confirmed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table leaderboard (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  display_name text not null,
  points       integer not null default 0,
  bets_won     integer not null default 0,
  bets_total   integer not null default 0,
  pnl          numeric,              -- mai serializzato verso il client
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

## 7. Learning e observability

```sql
-- Sostituisce le 8 tabelle learning vuote con un unico log di calibrazione
create table calibration_log (
  id          bigint generated always as identity primary key,
  scope       text not null check (scope in ('global','competition','model')),
  scope_key   text,                  -- competition_id / model_key, NULL se global
  window_days integer not null,
  n           integer not null,
  hit_rate    numeric,
  brier       numeric,
  roi         numeric,
  clv         numeric,
  computed_at timestamptz not null default now()
);

-- ex events (rinominata: collisione col core sportivo). Append-only.
create table tracking_events (
  id         bigint generated always as identity primary key,
  event_type text not null,
  session_id text,
  profile_id uuid references profiles(id) on delete set null,
  plan       text,
  partner_id text,
  value      numeric,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create table agent_heartbeats (
  agent_name text primary key,
  last_seen  timestamptz not null default now(),
  status     text,
  detail     text
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  title      text not null,
  body       text,
  target     text,
  sent       boolean not null default false,
  meta       jsonb,
  created_at timestamptz not null default now()
);
```

## 8. RLS

RLS abilitata su **tutte** le tabelle. Scritture: solo `service_role` (nessuna policy INSERT/UPDATE/DELETE per anon/authenticated, salvo le eccezioni sotto).

| Tabella | anon | authenticated | service_role |
|---|---|---|---|
| `sports`, `competitions` | SELECT | SELECT | ALL |
| `events` (+ details) | SELECT se `status <> 'cancelled'` | idem | ALL |
| `odds_snapshots` | SELECT | SELECT | ALL |
| `predictions` | SELECT se `is_published AND plan_access = 'free'` | SELECT se `is_published` e piano del profilo ≥ `plan_access` | ALL |
| `leaderboard` | SELECT (senza `pnl`: escluso da column grant) | idem | ALL |
| `tracking_events` | INSERT con validazione in policy (`char_length` su event_type/session_id, pattern `partnership_inquiries` di hotlist) | idem | ALL |
| `profiles`, `payments` | — | SELECT/UPDATE solo propria riga | ALL |
| `bets`, `risk_decisions`, `bankroll_snapshots`, `prediction_log`, `calibration_log`, `elo_ratings`, `agent_heartbeats`, `notifications` | — | — | ALL |

Note:
- Il gating per piano in RLS richiede di mappare l'utente autenticato al suo `profiles.plan`. Finché l'auth resta passwordless custom (sessione gestita dalle API routes, non da Supabase Auth), le letture "per piano" passano dalle API routes server-side con service key + proiezione per tier (logica attuale di `access-projection`). La policy authenticated è predisposta per la migrazione futura a Supabase Auth.
- `exec_sql` RPC: **eliminato** nella migration finale (oggi è un canale SQL arbitrario legato alla service key).

## 9. Scritture: chi scrive cosa

| Writer | Tabelle | Note |
|---|---|---|
| ModelAgent (Python) | `events` (upsert su source+external_id), `predictions` (upsert su event_id+model_key), `prediction_log`, `competitions.predictability` | via asyncpg, session pooler |
| TennisModelAgent | idem + `tennis_event_details`, `elo_ratings` | |
| Odds ingestion | `odds_snapshots` (bulk insert) | append-only |
| ResultSettlement | `events.score/status`, `predictions.status/settled_at`, `bets.status/pnl`, `prediction_log.result` | idempotente: tocca solo righe `pending` |
| RiskManager / Trader | `risk_decisions`, `bets`, `bankroll_snapshots` | dormiente al lancio |
| API routes (Next.js) | `profiles`, `payments`, `leaderboard`, `notifications`, `tracking_events` | service key server-side |
| Monitor | `agent_heartbeats` | |
| Learning job | `calibration_log` | batch periodico |

Pattern di errore (da hotlist): ogni job ritorna un oggetto `debug` con conteggi ed errori per-evento + quota API residua; upsert con `onConflict`; settlement che processa solo `pending` (riesecuzione sicura).

## 10. Migrations e piano di adozione

Una sola cartella: `supabase/migrations/` gestita via Supabase CLI. La cartella `db/migrations/` (Neon) viene archiviata.

1. `0001_enums_core.sql` — extensions (`citext`, `moddatetime`), enum + sports/competitions/events/details/odds/predictions/prediction_log/elo
2. `0002_users_payments.sql` — profiles/payments/leaderboard
3. `0003_risk_learning_obs.sql` — bets/risk/bankroll/calibration/tracking/heartbeats/notifications
4. `0004_rls.sql` — tutte le policy + revoca `exec_sql`
5. `0005_seed.sql` — sports, competitions correnti (EPL, leghe attive, WC, tour tennis)

**Adozione (senza big-bang):**
1. Migrations applicate sul progetto Supabase "Agentic project" (oggi vuoto) — nessun impatto sul DB attuale.
2. Adapter Python: `core/db.py` → asyncpg verso Supabase; doppia scrittura (vecchio+nuovo) per un periodo di verifica.
3. Backfill: `unified_predictions` + `tennis_predictions` + storico → nuovo schema via script one-off.
4. Switch frontend (API routes → nuove tabelle), verifica reale, poi dismissione Neon e drop tabelle legacy.
5. Staging: branch Supabase o progetto separato — staging e prod **non** condividono più il DB.

L'esecuzione (migrations sul DB, switch, dismissioni) è task medium/high → passerà dal gate PROPOSAL/APPROVE prima di toccare qualsiasi ambiente.

## 11. Cosa si elimina

- DB Neon (dopo verifica) e relativo ORM duplicato
- Tabelle: `matches`, `match_predictions`, `unified_predictions`, `tennis_predictions`, `tennis_bets`, `bankroll_history`, `variance_budget_log`, `league_profiles` (→ `competitions.predictability`), `understat_cache`, `match_research`*, `match_classifications` (→ `football_event_details` + feature_snapshot), `deposits` (→ `payments`), e le 8 learning vuote (`league_predictability_log`, `derby_registry`, `data_trust_log`, `temporal_audit_log`, `prediction_explanations`, `feature_memory`, `error_patterns_log`, `prediction_reasoning`)
- RPC `exec_sql`

\* `match_research` (narrative del researcher): se al momento della migrazione risulta usata dal frontend, confluisce in `predictions.feature_snapshot.research`; altrimenti si droppa.

## 12. Testing

- pgTAP o script SQL di verifica per: vincoli unique, FK, comportamento enum, policy RLS (anon non legge `prediction_log`, anon legge solo published free, ecc.)
- Test di idempotenza settlement (doppia esecuzione = stesso risultato)
- Verifica parità dati durante la doppia scrittura (conteggi e spot-check vecchio vs nuovo)
