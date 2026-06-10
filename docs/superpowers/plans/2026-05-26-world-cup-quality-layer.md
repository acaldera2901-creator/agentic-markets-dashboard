# World Cup Bets Quality Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a canonical `unified_predictions` table and `/api/v2/predictions` endpoint that power a credible World Cup Bets Desk, with access-control, timestamp hygiene, autonomous publication, and signal explanations.

**Architecture:** A new `unified_predictions` table in Supabase holds canonical predictions for all sports. An adapter in `lib/unified-adapter.ts` syncs football data from `match_predictions` into the unified schema after every model refresh. A new `/api/v2/predictions` route serves the canonical shape with access-control; the legacy `/api/predictions` route remains untouched so the existing UI never breaks.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase JS client via `exec_sql` RPC, `lib/db.ts` `dbQuery` helper (string-interpolation style — follow existing pattern exactly).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create (SQL) | `db/migrations/001_unified_predictions.sql` | DDL for `unified_predictions` table |
| Create | `lib/unified-adapter.ts` | Type, adapter functions, explanation generator, sync logic |
| Modify | `app/api/predictions/route.ts` | Call `syncMatchPredictionsToUnified()` at end of POST |
| Create | `app/api/v2/predictions/route.ts` | Canonical GET with filters + access control |
| Create | `app/api/v2/history/route.ts` | Settled predictions from `unified_predictions` |

---

## Task 1: SQL Migration — `unified_predictions` table

**Files:**
- Create: `db/migrations/001_unified_predictions.sql`

- [ ] **Step 1.1: Create the migration file**

```sql
-- db/migrations/001_unified_predictions.sql
CREATE TABLE IF NOT EXISTS unified_predictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id       TEXT,
  sport                   TEXT NOT NULL DEFAULT 'football',
  competition             TEXT NOT NULL,
  league                  TEXT,
  event_name              TEXT NOT NULL,
  home_team               TEXT,
  away_team               TEXT,
  player_one              TEXT,
  player_two              TEXT,

  -- Market
  market                  TEXT NOT NULL DEFAULT '1X2',
  pick                    TEXT,
  bookmaker               TEXT NOT NULL DEFAULT 'model composite',
  odds                    NUMERIC(6,2),
  fair_odds               NUMERIC(6,2),
  edge_percent            NUMERIC(8,4),
  confidence_score        INTEGER,
  risk_level              TEXT NOT NULL DEFAULT 'medium',
  stake_suggestion        NUMERIC(6,2),
  closing_odds            NUMERIC(6,2),
  closing_line_value      NUMERIC(8,4),

  -- Status / Classification
  status                  TEXT NOT NULL DEFAULT 'upcoming',
  signal_type             TEXT NOT NULL DEFAULT 'signal',
  source                  TEXT NOT NULL DEFAULT 'model',
  model_version           TEXT NOT NULL DEFAULT 'football-v1',
  plan_access             TEXT NOT NULL DEFAULT 'base',
  is_historical           BOOLEAN NOT NULL DEFAULT FALSE,
  is_live                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_paper                BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo                 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Time
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at            TIMESTAMPTZ,
  starts_at               TIMESTAMPTZ NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  settled_at              TIMESTAMPTZ,

  -- Result / Performance
  result                  TEXT,
  pnl                     NUMERIC(10,2),
  stake                   NUMERIC(10,2),
  roi                     NUMERIC(8,4),
  notes                   TEXT,
  explanation             TEXT NOT NULL DEFAULT '',

  -- World Cup specific
  world_cup_stage         TEXT,
  group_name              TEXT,
  venue                   TEXT,
  neutral_venue           BOOLEAN DEFAULT FALSE,
  team_news_summary       TEXT,
  market_movement_summary TEXT,

  -- Source reference (for dedup / sync)
  source_table            TEXT,
  source_id               TEXT,

  CONSTRAINT unified_predictions_source_unique UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_up_status        ON unified_predictions(status);
CREATE INDEX IF NOT EXISTS idx_up_sport         ON unified_predictions(sport);
CREATE INDEX IF NOT EXISTS idx_up_competition   ON unified_predictions(competition);
CREATE INDEX IF NOT EXISTS idx_up_starts_at     ON unified_predictions(starts_at);
CREATE INDEX IF NOT EXISTS idx_up_plan_access   ON unified_predictions(plan_access);
CREATE INDEX IF NOT EXISTS idx_up_is_historical ON unified_predictions(is_historical);
```

- [ ] **Step 1.2: Run the migration in Supabase**

Open Supabase dashboard → SQL Editor → paste the contents of `001_unified_predictions.sql` → Run.

Expected: "Success. No rows returned."

Alternatively via CLI (requires IPv6):
```bash
psql "postgresql://postgres:<DB_PASSWORD_REDACTED_ROTATED_2026-06-10>@db.xcgvfrsrcphzfctfyukz.supabase.co:5432/postgres" \
  -f db/migrations/001_unified_predictions.sql
```

- [ ] **Step 1.3: Verify the table exists**

In Supabase SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'unified_predictions'
ORDER BY ordinal_position;
```

Expected: 47 rows, one per column defined above.

- [ ] **Step 1.4: Commit the migration file**

```bash
git add db/migrations/001_unified_predictions.sql
git commit -m "feat: add unified_predictions table (canonical bets schema)"
```

---

## Task 2: `lib/unified-adapter.ts` — Adapter, explanation generator, sync

**Files:**
- Create: `lib/unified-adapter.ts`

- [ ] **Step 2.1: Create `lib/unified-adapter.ts`**

```typescript
// lib/unified-adapter.ts
import { dbQuery } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnifiedPrediction = {
  id: string;
  external_event_id: string | null;
  sport: string;
  competition: string;
  league: string | null;
  event_name: string;
  home_team: string | null;
  away_team: string | null;
  player_one: string | null;
  player_two: string | null;
  market: string;
  pick: string | null;
  bookmaker: string;
  odds: number | null;
  fair_odds: number | null;
  edge_percent: number | null;
  confidence_score: number | null;
  risk_level: string;
  stake_suggestion: number | null;
  closing_odds: number | null;
  closing_line_value: number | null;
  status: string;
  signal_type: string;
  source: string;
  model_version: string;
  plan_access: string;
  is_historical: boolean;
  is_live: boolean;
  is_paper: boolean;
  is_verified: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  starts_at: string;
  expires_at: string;
  settled_at: string | null;
  result: string | null;
  pnl: number | null;
  stake: number | null;
  roi: number | null;
  notes: string | null;
  explanation: string;
  world_cup_stage: string | null;
  group_name: string | null;
  venue: string | null;
  neutral_venue: boolean;
  team_news_summary: string | null;
  market_movement_summary: string | null;
  source_table: string | null;
  source_id: string | null;
};

type MatchPredictionRow = {
  id: number;
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  enrichment: {
    form_home?: string;
    form_away?: string;
    injuries_home?: string[];
    injuries_away?: string[];
    research?: string;
    match_type?: string;
    api_advice?: string;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORLD_CUP_KEYWORDS = ["world cup", "fifa", "wc 2026", "wc2026"];

function detectCompetition(league: string, leagueName: string): string {
  const lower = leagueName.toLowerCase();
  if (WORLD_CUP_KEYWORDS.some((k) => lower.includes(k))) return "World Cup";
  if (league === "CL") return "Champions League";
  if (league === "EL") return "Europa League";
  return leagueName;
}

function computeStatus(kickoff: string): string {
  const hoursUntil = (new Date(kickoff).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil > 24) return "upcoming";
  if (hoursUntil > 0) return "open";
  return "pending_settlement";
}

function computeRisk(edge: number | null): string {
  if (edge == null) return "medium";
  if (edge > 0.04) return "low";
  if (edge > 0.02) return "medium";
  return "high";
}

function pickOdds(row: MatchPredictionRow): number | null {
  if (row.best_selection === "HOME") return row.odds_home;
  if (row.best_selection === "DRAW") return row.odds_draw;
  if (row.best_selection === "AWAY") return row.odds_away;
  return null;
}

function pickProb(row: MatchPredictionRow): number {
  if (row.best_selection === "HOME") return row.p_home;
  if (row.best_selection === "DRAW") return row.p_draw;
  return row.p_away;
}

function generateFootballExplanation(row: MatchPredictionRow): string {
  const pick = row.best_selection ?? "N/A";
  const edgePct = row.edge != null ? `${(row.edge * 100).toFixed(1)}%` : "unknown";
  const confidence = `${Math.round(pickProb(row) * 100)}%`;
  const enr = row.enrichment;

  const formNote =
    enr?.form_home && enr?.form_away
      ? ` Recent form: ${row.home_team} ${enr.form_home}, ${row.away_team} ${enr.form_away}.`
      : "";

  const injuryNote =
    enr?.injuries_home?.length || enr?.injuries_away?.length
      ? " Injury data considered."
      : "";

  const adviceNote = enr?.api_advice ? ` External model note: ${enr.api_advice}.` : "";

  return (
    `Poisson model signal. Pick: ${pick} | Edge: ${edgePct} over implied market probability` +
    ` | Model confidence: ${confidence}.` +
    formNote +
    injuryNote +
    adviceNote +
    " This signal is informational and does not guarantee an outcome. Bet responsibly."
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function matchPredictionToUnifiedInsert(row: MatchPredictionRow) {
  const competition = detectCompetition(row.league, row.league_name);
  const isWorldCup = competition === "World Cup";
  const odds = pickOdds(row);
  const prob = pickProb(row);
  const fairOdds = prob > 0 ? Math.round((1 / prob) * 100) / 100 : null;
  const edgePct =
    row.edge != null ? Math.round(row.edge * 10000) / 100 : null;
  const confidence = Math.round(prob * 100);
  const neutral = row.enrichment?.match_type === "NEUTRAL_VENUE";

  const teamNews =
    row.enrichment?.injuries_home?.length || row.enrichment?.injuries_away?.length
      ? `${row.home_team}: ${row.enrichment?.injuries_home?.join(", ") || "none"} | ${row.away_team}: ${row.enrichment?.injuries_away?.join(", ") || "none"}`
      : null;

  return {
    external_event_id: row.match_id,
    sport: "football",
    competition,
    league: row.league,
    event_name: `${row.home_team} vs ${row.away_team}`,
    home_team: row.home_team,
    away_team: row.away_team,
    market: "1X2",
    pick: row.best_selection,
    bookmaker: "market composite",
    odds: odds != null ? Math.round(odds * 100) / 100 : null,
    fair_odds: fairOdds,
    edge_percent: edgePct,
    confidence_score: confidence,
    risk_level: computeRisk(row.edge),
    status: computeStatus(row.kickoff),
    signal_type: "signal",
    source: "model",
    model_version: "football-poisson-v1",
    plan_access: isWorldCup ? "base" : "base",
    is_historical: false,
    is_live: false,
    is_paper: false,
    is_verified: false,
    is_demo: false,
    published_at: new Date().toISOString(),
    starts_at: row.kickoff,
    expires_at: row.kickoff,
    explanation: generateFootballExplanation(row),
    neutral_venue: neutral,
    team_news_summary: teamNews,
    source_table: "match_predictions",
    source_id: row.match_id,
  };
}

// ─── Sync function (called after every football model refresh) ────────────────

export async function syncMatchPredictionsToUnified(): Promise<number> {
  const rows = await dbQuery<MatchPredictionRow>(
    `SELECT id, match_id, league, league_name, home_team, away_team, kickoff,
            p_home, p_draw, p_away, odds_home, odds_draw, odds_away,
            edge, best_selection, enrichment
     FROM match_predictions
     WHERE kickoff > NOW() - INTERVAL '1 hour'
     ORDER BY kickoff ASC
     LIMIT 200`
  );

  let synced = 0;
  for (const row of rows) {
    const d = matchPredictionToUnifiedInsert(row);
    await dbQuery(
      `INSERT INTO unified_predictions (
        external_event_id, sport, competition, league, event_name,
        home_team, away_team, market, pick, bookmaker,
        odds, fair_odds, edge_percent, confidence_score, risk_level,
        status, signal_type, source, model_version, plan_access,
        is_historical, is_live, is_paper, is_verified, is_demo,
        published_at, starts_at, expires_at, explanation,
        neutral_venue, team_news_summary, source_table, source_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
      )
      ON CONFLICT (source_table, source_id) DO UPDATE SET
        odds              = EXCLUDED.odds,
        fair_odds         = EXCLUDED.fair_odds,
        edge_percent      = EXCLUDED.edge_percent,
        confidence_score  = EXCLUDED.confidence_score,
        risk_level        = EXCLUDED.risk_level,
        status            = EXCLUDED.status,
        explanation       = EXCLUDED.explanation,
        team_news_summary = EXCLUDED.team_news_summary,
        neutral_venue     = EXCLUDED.neutral_venue,
        updated_at        = NOW()
      WHERE unified_predictions.settled_at IS NULL`,
      [
        d.external_event_id, d.sport, d.competition, d.league, d.event_name,
        d.home_team, d.away_team, d.market, d.pick, d.bookmaker,
        d.odds, d.fair_odds, d.edge_percent, d.confidence_score, d.risk_level,
        d.status, d.signal_type, d.source, d.model_version, d.plan_access,
        d.is_historical, d.is_live, d.is_paper, d.is_verified, d.is_demo,
        d.published_at, d.starts_at, d.expires_at, d.explanation,
        d.neutral_venue, d.team_news_summary, d.source_table, d.source_id,
      ]
    );
    synced++;
  }
  return synced;
}

// ─── Access control (applied in API routes) ───────────────────────────────────

export function applyAccessControl(
  row: UnifiedPrediction,
  planAccess: string
): Partial<UnifiedPrediction> {
  if (planAccess === "premium") return row;

  if (planAccess === "base") {
    // Base can see pick, edge, confidence — not CLV/stake
    const { closing_line_value, stake_suggestion, ...rest } = row;
    void closing_line_value;
    void stake_suggestion;
    return rest;
  }

  if (planAccess === "free") {
    // Free: event meta only, no pick/edge/confidence
    return {
      id: row.id,
      sport: row.sport,
      competition: row.competition,
      league: row.league,
      event_name: row.event_name,
      home_team: row.home_team,
      away_team: row.away_team,
      starts_at: row.starts_at,
      status: row.status,
      signal_type: row.signal_type,
      plan_access: row.plan_access,
      is_paper: row.is_paper,
      is_demo: row.is_demo,
    };
  }

  // Public / locked visitor
  return {
    id: row.id,
    sport: row.sport,
    competition: row.competition,
    event_name: row.event_name,
    home_team: row.home_team,
    away_team: row.away_team,
    starts_at: row.starts_at,
    status: row.status,
    plan_access: row.plan_access,
  };
}
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 2.3: Commit**

```bash
git add lib/unified-adapter.ts
git commit -m "feat: add unified-adapter — sync match_predictions to unified_predictions"
```

---

## Task 3: Update `POST /api/predictions/route.ts` — call sync after refresh

**Files:**
- Modify: `app/api/predictions/route.ts` (last ~10 lines of the `POST` handler)

- [ ] **Step 3.1: Add the import at the top of `app/api/predictions/route.ts`**

At line 1, add after the existing imports:
```typescript
import { syncMatchPredictionsToUnified } from "@/lib/unified-adapter";
```

- [ ] **Step 3.2: Update the `POST` handler to call sync**

Find the `POST` export (near line 532) and replace it:

```typescript
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await computeAndStore();
  const synced = await syncMatchPredictionsToUnified();
  return NextResponse.json({ ...result, synced_to_unified: synced, at: new Date().toISOString() });
}
```

- [ ] **Step 3.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 3.4: Commit**

```bash
git add app/api/predictions/route.ts
git commit -m "feat: sync match_predictions → unified_predictions after every model refresh"
```

---

## Task 4: Create `GET /api/v2/predictions/route.ts` — canonical endpoint

**Files:**
- Create: `app/api/v2/predictions/route.ts`

- [ ] **Step 4.1: Create the directory**

```bash
mkdir -p ~/Desktop/sistema-andrea/agentic-markets/dashboard-web/app/api/v2/predictions
```

- [ ] **Step 4.2: Create `app/api/v2/predictions/route.ts`**

```typescript
// app/api/v2/predictions/route.ts
import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction, applyAccessControl } from "@/lib/unified-adapter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");
  const planAccess  = searchParams.get("plan_access") ?? "public";

  const conditions: string[] = [
    "starts_at > NOW()",
    "expires_at > NOW()",
    "published_at IS NOT NULL",
    "is_historical = FALSE",
  ];

  if (sport && sport !== "all") {
    conditions.push(`sport = '${sport.replace(/'/g, "''")}'`);
  }
  if (competition && competition !== "all") {
    conditions.push(`competition ILIKE '%${competition.replace(/'/g, "''")}%'`);
  }
  if (status && status !== "all") {
    conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  }

  const rows = await dbQuery<UnifiedPrediction>(
    `SELECT * FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       competition = 'World Cup' DESC,
       starts_at ASC
     LIMIT 100`
  );

  const predictions = rows.map((row) => applyAccessControl(row, planAccess));

  return NextResponse.json(
    {
      predictions,
      meta: {
        source: "database",
        generated_at: new Date().toISOString(),
        count: predictions.length,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } }
  );
}
```

- [ ] **Step 4.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4.4: Test the endpoint locally (if dev server is running)**

```bash
curl "http://localhost:3000/api/v2/predictions?plan_access=base" | jq '.meta'
```

Expected: `{ "source": "database", "count": <N>, "generated_at": "..." }`

- [ ] **Step 4.5: Commit**

```bash
git add app/api/v2/predictions/route.ts
git commit -m "feat: add /api/v2/predictions canonical unified endpoint with access control"
```

---

## Task 5: Create `GET /api/v2/history/route.ts` — settled predictions history

**Files:**
- Create: `app/api/v2/history/route.ts`

- [ ] **Step 5.1: Create the directory**

```bash
mkdir -p ~/Desktop/sistema-andrea/agentic-markets/dashboard-web/app/api/v2/history
```

- [ ] **Step 5.2: Create `app/api/v2/history/route.ts`**

```typescript
// app/api/v2/history/route.ts
import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";

export const dynamic = "force-dynamic";

type HistoryRow = Pick<
  UnifiedPrediction,
  | "id" | "sport" | "competition" | "event_name" | "home_team" | "away_team"
  | "player_one" | "player_two" | "market" | "pick" | "odds" | "status"
  | "result" | "pnl" | "signal_type" | "is_paper" | "is_verified" | "is_demo"
  | "starts_at" | "settled_at" | "notes" | "world_cup_stage" | "group_name"
>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const limit       = Math.min(Number(searchParams.get("limit") ?? 100), 300);

  const conditions: string[] = ["is_historical = TRUE"];

  if (sport && sport !== "all") {
    conditions.push(`sport = '${sport.replace(/'/g, "''")}'`);
  }
  if (competition && competition !== "all") {
    conditions.push(`competition ILIKE '%${competition.replace(/'/g, "''")}%'`);
  }

  const rows = await dbQuery<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, odds, status,
            result, pnl, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY COALESCE(settled_at, starts_at) DESC
     LIMIT ${limit}`
  );

  const total    = rows.length;
  const won      = rows.filter((r) => r.result === "won").length;
  const lost     = rows.filter((r) => r.result === "lost").length;
  const paper    = rows.filter((r) => r.is_paper).length;
  const verified = rows.filter((r) => r.is_verified).length;

  return NextResponse.json({
    history: rows,
    stats: {
      total,
      won,
      lost,
      void: rows.filter((r) => r.result === "void").length,
      pending: rows.filter((r) => r.result === "pending" || r.result == null).length,
      paper,
      verified,
      win_rate:
        won + lost > 0
          ? `${((won / (won + lost)) * 100).toFixed(1)}%`
          : null,
    },
  });
}
```

- [ ] **Step 5.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5.4: Commit**

```bash
git add app/api/v2/history/route.ts
git commit -m "feat: add /api/v2/history for settled predictions with stats"
```

---

## Task 6: Add World Cup competition support + stale prediction cleanup

**Files:**
- Modify: `app/api/predictions/route.ts` (LEAGUES map + cleanup query)
- Modify: `lib/unified-adapter.ts` (world_cup_stage detection)

- [ ] **Step 6.1: Add `WC` to LEAGUES in `app/api/predictions/route.ts`**

Find (around line 22):
```typescript
const LEAGUES: Record<string, string> = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
};
```

Replace with:
```typescript
const LEAGUES: Record<string, string> = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
  WC: "World Cup",
};
```

- [ ] **Step 6.2: Add `world_cup_stage` detection to `lib/unified-adapter.ts`**

Add this helper function after `detectCompetition` (before `computeStatus`):

```typescript
function detectWorldCupStage(leagueName: string): string | null {
  const lower = leagueName.toLowerCase();
  if (!WORLD_CUP_KEYWORDS.some((k) => lower.includes(k))) return null;
  // api-football.com and football-data.org encode round in league_name or separate field
  if (lower.includes("final") && !lower.includes("semi") && !lower.includes("quarter")) return "final";
  if (lower.includes("semi")) return "semi";
  if (lower.includes("quarter")) return "quarter";
  if (lower.includes("round of 16") || lower.includes("round16")) return "round16";
  return "group";
}
```

Update `matchPredictionToUnifiedInsert` to use it — find the line:
```typescript
    source_table: "match_predictions",
```

And add the world_cup_stage field above it by replacing this block in the return object:

Find:
```typescript
    neutral_venue: neutral,
    team_news_summary: teamNews,
    source_table: "match_predictions",
    source_id: row.match_id,
```

Replace with:
```typescript
    neutral_venue: neutral,
    team_news_summary: teamNews,
    world_cup_stage: detectWorldCupStage(row.league_name),
    source_table: "match_predictions",
    source_id: row.match_id,
```

Also update the INSERT in `syncMatchPredictionsToUnified` to include `world_cup_stage`.

Find the INSERT columns list (look for `team_news_summary, source_table, source_id`):
```typescript
        neutral_venue, team_news_summary, source_table, source_id
      ) VALUES (
```

Replace with:
```typescript
        neutral_venue, team_news_summary, world_cup_stage, source_table, source_id
      ) VALUES (
```

Update the values count `$30,$31,$32,$33` to `$30,$31,$32,$33,$34`:
Find:
```typescript
        $30,$31,$32,$33
      )
```
Replace with:
```typescript
        $30,$31,$32,$33,$34
      )
```

Update the params array — find:
```typescript
        d.neutral_venue, d.team_news_summary, d.source_table, d.source_id,
```
Replace with:
```typescript
        d.neutral_venue, d.team_news_summary, d.world_cup_stage ?? null, d.source_table, d.source_id,
```

Also add `world_cup_stage` to the return object of `matchPredictionToUnifiedInsert` — after `team_news_summary`:
```typescript
    world_cup_stage: detectWorldCupStage(row.league_name),
```

- [ ] **Step 6.3: Add unified_predictions stale cleanup to `syncMatchPredictionsToUnified`**

At the end of `syncMatchPredictionsToUnified`, before `return synced`, add:

```typescript
  // Move expired predictions to historical and mark stale active ones
  await dbQuery(
    `UPDATE unified_predictions
     SET status = 'pending_settlement', updated_at = NOW()
     WHERE is_historical = FALSE
       AND expires_at < NOW()
       AND status IN ('open', 'upcoming')
       AND settled_at IS NULL`
  );
```

- [ ] **Step 6.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6.5: Commit**

```bash
git add app/api/predictions/route.ts lib/unified-adapter.ts
git commit -m "feat: add World Cup league (WC), stage detection, stale prediction cleanup"
```

---

## Task 7: Deploy to Vercel and smoke-test

**Files:** none changed, deployment only.

- [ ] **Step 7.1: Run full TypeScript check**

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/dashboard-web
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7.2: Deploy to Vercel production**

```bash
vercel --prod --yes --scope agenticmarkets-cb-1025s-projects
```

Wait for deployment URL.

- [ ] **Step 7.3: Smoke-test `/api/v2/predictions`**

```bash
curl "https://dashboard-web-green-mu.vercel.app/api/v2/predictions?plan_access=base" | jq '.meta'
```

Expected:
```json
{
  "source": "database",
  "count": 0,
  "generated_at": "2026-..."
}
```

Count of 0 is OK before first cron run. Verify no 500 error.

- [ ] **Step 7.4: Trigger a prediction refresh to populate unified_predictions**

```bash
curl -X POST "https://dashboard-web-green-mu.vercel.app/api/predictions" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `{ "stored": N, "synced_to_unified": N, ... }`

- [ ] **Step 7.5: Verify predictions appear in `/api/v2/predictions`**

```bash
curl "https://dashboard-web-green-mu.vercel.app/api/v2/predictions?plan_access=base" | jq '.meta.count'
```

Expected: N > 0

- [ ] **Step 7.6: Test access control — public should not see pick**

```bash
curl "https://dashboard-web-green-mu.vercel.app/api/v2/predictions?plan_access=public" | \
  jq '.predictions[0] | keys'
```

Expected: array of keys that does NOT include `"edge_percent"` or `"confidence_score"`.

- [ ] **Step 7.7: Test World Cup filter**

```bash
curl "https://dashboard-web-green-mu.vercel.app/api/v2/predictions?competition=World+Cup&plan_access=base" | jq '.meta'
```

Expected: `{ "count": 0 }` until WC fixtures are fetched (after June 1 WC qualifying data available).

- [ ] **Step 7.8: Final commit (tag or update version)**

```bash
git tag -a "quality-layer-v1" -m "World Cup Bets Quality Layer — unified_predictions live"
git push && git push --tags
```

---

## Open Items (not in this plan — track separately)

| Item | Why deferred |
|---|---|
| Tennis sync to `unified_predictions` | Tennis model runs Python-side; needs a separate sync agent or API POST endpoint. After football MVP is stable. |
| Casino/bookmaker odds integration | Pending partner agreements (Andrea + Michele decision). When ready: update `bookmaker` field and populate `closing_line_value`. |
| Admin settlement endpoint `PATCH /api/v2/predictions/:id` | For marking won/lost/void + setting `is_historical = TRUE`. Ship after first matches are settled. |
| Free user signal quota enforcement | `totalVisible: 2, perSport: { football: 1, tennis: 1 }` — requires user auth session check. After client-auth is live. |
| `/api/client-auth/status` (currently 404) | Prerequisite for per-user plan enforcement on the frontend. Separate plan. |

---

*Plan written 2026-05-26 — Andrea + Claude Code*
