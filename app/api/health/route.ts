import { NextResponse } from "next/server";

const DB_URL = process.env.DATABASE_URL;

interface HeartbeatRow {
  agent_name: string;
  last_seen: string;
  status_detail: string | null;
}

interface TennisActivityRow {
  latest_prediction: string | null;
  latest_signal: string | null;
  predictions: string;
  signals: string;
}

async function dbQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(sql, params)) ?? []) as T[];
  } catch {
    return [];
  }
}

async function ensureTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS agent_heartbeats (
      agent_name VARCHAR PRIMARY KEY,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status_detail TEXT
    )
  `);
}

const CORE_AGENTS = [
  "DataCollector", "ModelAgent", "AnalystAgent", "StrategistAgent",
  "RiskManagerAgent", "TraderAgent", "MonitorAgent", "ResearchAgent",
  "AHCollectorAgent", "ResultSettlementAgent",
];

const SIGNAL_ONLY_AGENTS = [
  "TennisDataCollectorAgent", "TennisModelAgent", "TennisAnalystAgent",
  "TennisRiskManagerAgent", "TennisTraderAgent", "TennisSettlementAgent",
];

const KNOWN_AGENTS = [...CORE_AGENTS, ...SIGNAL_ONLY_AGENTS];
const TENNIS_SIGNAL_FRESH_SECONDS = 60 * 60;

function parseStatus(lastSeen: string | null): "alive" | "stale" | "offline" {
  if (!lastSeen) return "offline";
  const age = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  return age < 90 ? "alive" : age < 300 ? "stale" : "offline";
}

export async function GET() {
  await ensureTable();

  const [rows, tennisActivityRows] = await Promise.all([
    dbQuery<HeartbeatRow>(
      `SELECT agent_name, last_seen, status_detail FROM agent_heartbeats`
    ),
    dbQuery<TennisActivityRow>(`
      SELECT
        (SELECT MAX(computed_at) FROM tennis_predictions) AS latest_prediction,
        (SELECT MAX(placed_at) FROM tennis_bets) AS latest_signal,
        (SELECT COUNT(*) FROM tennis_predictions) AS predictions,
        (SELECT COUNT(*) FROM tennis_bets) AS signals
    `),
  ]);

  const tennisActivity = tennisActivityRows[0];
  const latestTennisAt = [tennisActivity?.latest_prediction, tennisActivity?.latest_signal]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const tennisActive = latestTennisAt ? (Date.now() - latestTennisAt) / 1000 < TENNIS_SIGNAL_FRESH_SECONDS : false;

  const hbMap: Record<string, HeartbeatRow> = {};
  for (const r of rows) hbMap[r.agent_name] = r;

  const agents = KNOWN_AGENTS.map((name) => {
    const row = hbMap[name];
    const lastSeen = row?.last_seen ?? null;
    const ageSec = lastSeen ? Math.round((Date.now() - new Date(lastSeen).getTime()) / 1000) : null;
    const isTennis = SIGNAL_ONLY_AGENTS.includes(name);
    const inferredTennisStatus = isTennis && tennisActive ? "alive" : "offline";
    return {
      name,
      status: lastSeen ? parseStatus(lastSeen) : inferredTennisStatus,
      last_seen: lastSeen,
      age_seconds: ageSec,
      detail: row?.status_detail ?? (
        isTennis && tennisActive
          ? `Tennis signal pipeline active: ${tennisActivity?.predictions ?? 0} predictions, ${tennisActivity?.signals ?? 0} signals.`
          : null
      ),
    };
  });

  const coreAgents = agents.filter((a) => CORE_AGENTS.includes(a.name));
  const coreAlive = coreAgents.filter((a) => a.status === "alive").length;
  const coreOffline = coreAgents.filter((a) => a.status === "offline").length;
  const coreStale = coreAgents.filter((a) => a.status === "stale").length;
  const signalAgents = agents.filter((a) => SIGNAL_ONLY_AGENTS.includes(a.name));
  const signalAlive = signalAgents.filter((a) => a.status === "alive").length;
  const signalOffline = signalAgents.filter((a) => a.status === "offline").length;

  return NextResponse.json({
    status: coreOffline > 0 ? "degraded" : coreStale > 0 ? "warning" : "ok",
    timestamp: new Date().toISOString(),
    core: {
      total: CORE_AGENTS.length,
      alive: coreAlive,
      stale: coreStale,
      offline: coreOffline,
    },
    signal_only: {
      total: SIGNAL_ONLY_AGENTS.length,
      alive: signalAlive,
      offline: signalOffline,
      mode: tennisActive ? "active_signal" : "gated",
      latest_activity: latestTennisAt ? new Date(latestTennisAt).toISOString() : null,
      predictions: Number(tennisActivity?.predictions ?? 0),
      signals: Number(tennisActivity?.signals ?? 0),
    },
    agents,
  });
}

// Python agents POST heartbeats here via DASHBOARD_URL/api/health
export async function POST(req: Request) {
  const secret = process.env.RESEARCH_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const body = await req.json() as { agent_name?: string; detail?: string };
  const name = body.agent_name;
  if (!name) return NextResponse.json({ error: "agent_name required" }, { status: 400 });

  await dbQuery(
    `INSERT INTO agent_heartbeats (agent_name, last_seen, status_detail)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (agent_name) DO UPDATE SET last_seen = NOW(), status_detail = EXCLUDED.status_detail`,
    [name, body.detail ?? null]
  );

  return NextResponse.json({ ok: true });
}
