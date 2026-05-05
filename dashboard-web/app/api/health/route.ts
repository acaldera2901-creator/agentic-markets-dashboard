import { NextResponse } from "next/server";

const DB_URL = process.env.DATABASE_URL;

interface HeartbeatRow {
  agent_name: string;
  last_seen: string;
  status_detail: string | null;
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

const KNOWN_AGENTS = [
  "DataCollector", "ModelAgent", "AnalystAgent", "StrategistAgent",
  "RiskManagerAgent", "TraderAgent", "MonitorAgent", "ResearchAgent", "AHCollectorAgent",
];

function parseStatus(lastSeen: string | null): "alive" | "stale" | "offline" {
  if (!lastSeen) return "offline";
  const age = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  return age < 90 ? "alive" : age < 300 ? "stale" : "offline";
}

export async function GET() {
  await ensureTable();

  const rows = await dbQuery<HeartbeatRow>(
    `SELECT agent_name, last_seen, status_detail FROM agent_heartbeats`
  );

  const hbMap: Record<string, HeartbeatRow> = {};
  for (const r of rows) hbMap[r.agent_name] = r;

  const agents = KNOWN_AGENTS.map((name) => {
    const row = hbMap[name];
    const lastSeen = row?.last_seen ?? null;
    const ageSec = lastSeen ? Math.round((Date.now() - new Date(lastSeen).getTime()) / 1000) : null;
    return {
      name,
      status: parseStatus(lastSeen),
      last_seen: lastSeen,
      age_seconds: ageSec,
      detail: row?.status_detail ?? null,
    };
  });

  const alive = agents.filter((a) => a.status === "alive").length;
  const offline = agents.filter((a) => a.status === "offline").length;

  return NextResponse.json({
    status: offline > 0 ? "degraded" : alive < KNOWN_AGENTS.length ? "warning" : "ok",
    timestamp: new Date().toISOString(),
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
