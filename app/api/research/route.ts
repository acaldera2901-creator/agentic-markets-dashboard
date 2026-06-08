import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";

/** GET — returns all recent research summaries (match_id → summary).
 *  Bearer-gated (same RESEARCH_SECRET as POST): these are internal model
 *  research notes, not a public surface, and no client consumes this route.
 *  Default-deny — a missing secret closes the endpoint. */
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.RESEARCH_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await dbQuery<{ match_id: string; summary: string; created_at: string }>(
    `SELECT match_id, summary, created_at FROM match_research
     WHERE created_at > NOW() - INTERVAL '48 hours'
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ research: rows });
}

/** POST — stores a research summary from the Python ResearchAgent (Ollama) */
export async function POST(req: Request) {
  // Default-deny: a missing RESEARCH_SECRET must close the endpoint, not open
  // it (same pattern as the cron routes). Unauthenticated writes are never ok.
  if (!verifyBearer(req, process.env.RESEARCH_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
