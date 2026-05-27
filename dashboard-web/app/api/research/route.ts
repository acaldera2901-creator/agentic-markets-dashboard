import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

/** GET — returns all recent research summaries (match_id → summary) */
export async function GET() {
  const rows = await dbQuery<{ match_id: string; summary: string; created_at: string }>(
    `SELECT match_id, summary, created_at FROM match_research
     WHERE created_at > NOW() - INTERVAL '48 hours'
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ research: rows });
}

/** POST — stores a research summary from the Python ResearchAgent (Ollama) */
export async function POST(req: Request) {
  const secret = process.env.RESEARCH_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: { match_id: string; summary: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.match_id || !body.summary) {
    return NextResponse.json({ error: "match_id and summary required" }, { status: 400 });
  }

  await dbQuery(
    `INSERT INTO match_research (match_id, summary, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (match_id) DO UPDATE SET summary = EXCLUDED.summary, created_at = NOW()`,
    [body.match_id, body.summary]
  );

  return NextResponse.json({ ok: true });
}
